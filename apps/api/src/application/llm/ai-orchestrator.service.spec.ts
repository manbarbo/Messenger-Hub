import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandBus } from '@nestjs/cqrs';
import type { AITrace } from '@domain/entities/ai-trace.entity';
import type { Clinic } from '@domain/entities/clinic.entity';
import type { Message } from '@domain/entities/message.entity';
import { ConversationStatus } from '@domain/enums/conversation-status.enum';
import { LLMProviderError } from '@domain/errors/llm-provider.error';
import { SlotAlreadyBookedError } from '@domain/errors/slot-already-booked.error';
import type {
  AITraceRepository,
  ClinicRepository,
  KnowledgeRepository,
  MessageRepository,
  SlotRepository,
} from '@domain/repositories';
import type { Logger } from '@domain/services';
import type { LLMChatResult, LLMToolCall } from '@domain/value-objects/llm-chat.vo';
import { MockLLMService } from '@infrastructure/llm/mock-llm.service';
import { AIOrchestratorService, MAX_TOOL_ITERATIONS } from './ai-orchestrator.service';
import { PromptBuilder } from './prompt-builder';
import { ToolValidator } from './tool-validator';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const clinic: Clinic = {
  id: 'clinic-1',
  name: 'Clínica Norte',
  address: 'Calle 10',
  phone: '+5715551234',
  timezone: 'America/Bogota',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function buildLlmResult(overrides: Partial<LLMChatResult> = {}): LLMChatResult {
  return {
    content: null,
    toolCalls: [],
    model: 'gemini-2.5-flash',
    inputTokens: 10,
    outputTokens: 5,
    latencyMs: 20,
    costUsd: 0.0001,
    finishReason: 'stop',
    ...overrides,
  };
}

function buildToolCall(overrides: Partial<LLMToolCall> = {}): LLMToolCall {
  return {
    id: 'call-1',
    name: 'buscar_conocimiento',
    arguments: { pregunta: 'horario' },
    ...overrides,
  };
}

describe('AIOrchestratorService', () => {
  let llmService: MockLLMService;
  let clinicRepository: { findById: ReturnType<typeof vi.fn> };
  let messageRepository: { findByConversationId: ReturnType<typeof vi.fn> };
  let knowledgeRepository: { search: ReturnType<typeof vi.fn> };
  let slotRepository: { findAvailable: ReturnType<typeof vi.fn> };
  let aiTraceRepository: { create: ReturnType<typeof vi.fn> };
  let commandBus: { execute: ReturnType<typeof vi.fn> };
  let toolValidator: { validate: ReturnType<typeof vi.fn> };
  let logger: Logger;
  let orchestrator: AIOrchestratorService;

  const history: Message[] = [
    {
      id: 'm1',
      conversationId: 'conv-1',
      clinicId: 'clinic-1',
      direction: 'inbound',
      role: 'user',
      content: 'Hola',
      createdAt: new Date('2026-10-01T10:00:00Z'),
    },
  ];

  beforeEach(() => {
    llmService = new MockLLMService();
    clinicRepository = { findById: vi.fn().mockResolvedValue(clinic) };
    messageRepository = { findByConversationId: vi.fn().mockResolvedValue(history) };
    knowledgeRepository = { search: vi.fn() };
    slotRepository = { findAvailable: vi.fn() };
    aiTraceRepository = { create: vi.fn().mockResolvedValue(undefined) };
    commandBus = { execute: vi.fn() };
    toolValidator = { validate: vi.fn() };
    logger = createMockLogger();

    orchestrator = new AIOrchestratorService(
      logger,
      llmService,
      clinicRepository as unknown as ClinicRepository,
      messageRepository as unknown as MessageRepository,
      knowledgeRepository as unknown as KnowledgeRepository,
      slotRepository as unknown as SlotRepository,
      aiTraceRepository as unknown as AITraceRepository,
      commandBus as unknown as CommandBus,
      toolValidator as unknown as ToolValidator,
      new PromptBuilder(),
    );
  });

  function expectSavedTrace(
    finalStatus: AITrace['finalStatus'],
    expectedModel = 'gemini-2.5-flash',
  ): AITrace {
    expect(aiTraceRepository.create).toHaveBeenCalledTimes(1);
    const trace = aiTraceRepository.create.mock.calls[0][0] as AITrace;
    expect(trace.conversationId).toBe('conv-1');
    expect(trace.clinicId).toBe('clinic-1');
    expect(trace.finalStatus).toBe(finalStatus);
    expect(trace.turnIndex).toBe(1);
    expect(trace.model).toBe(expectedModel);
    return trace;
  }

  it('returns AI response and saves trace when the LLM does not call tools', async () => {
    llmService.setResponses([
      buildLlmResult({ content: 'Atendemos de lunes a viernes.', finishReason: 'stop' }),
    ]);

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', '¿A qué hora atienden?');

    expect(result).toEqual({
      response: 'Atendemos de lunes a viernes.',
      status: ConversationStatus.RESOLVED_BY_AI,
    });
    const trace = expectSavedTrace('resuelta_por_ia');
    expect(trace.toolsCalled).toEqual([]);
    expect(trace.inputTokens).toBe(10);
    expect(trace.outputTokens).toBe(5);
  });

  it('includes system prompt with clinic name and Colombia time in LLM messages', async () => {
    llmService.setResponses([buildLlmResult({ content: 'ok' })]);

    await orchestrator.processTurn('conv-1', 'clinic-1', 'hola');

    const params = llmService.calls[0];
    expect(params.messages[0].role).toBe('system');
    expect(params.messages[0].content).toContain('Clínica Norte');
    expect(params.messages[0].content).toContain('(UTC-5)');
    expect(params.tools?.map((t) => t.name)).toEqual([
      'buscar_conocimiento',
      'consultar_disponibilidad',
      'agendar_cita',
      'escalar_a_humano',
    ]);
  });

  it('does not duplicate the current user message when it is already persisted in history', async () => {
    messageRepository.findByConversationId.mockResolvedValue([
      {
        id: 'm-in',
        conversationId: 'conv-1',
        clinicId: 'clinic-1',
        direction: 'inbound',
        role: 'user',
        content: 'Hola, quiero una cita',
        messageId: 'wamid.001',
        createdAt: new Date('2026-10-02T15:00:00Z'),
      },
    ]);
    llmService.setResponses([buildLlmResult({ content: 'ok' })]);

    await orchestrator.processTurn('conv-1', 'clinic-1', 'Hola, quiero una cita');

    const userMessages = llmService.calls[0].messages.filter((m) => m.role === 'user');
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].content).toBe('Hola, quiero una cita');
  });

  it('feeds validation errors back to the LLM and continues the loop', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: false,
      error: 'Invalid arguments: pregunta: required',
    });
    llmService.setResponses([
      buildLlmResult({ toolCalls: [buildToolCall()] }),
      buildLlmResult({ content: 'Lo siento, no entendí.', finishReason: 'stop' }),
    ]);

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', 'hola');

    expect(result.status).toBe(ConversationStatus.RESOLVED_BY_AI);
    expect(toolValidator.validate).toHaveBeenCalledWith('buscar_conocimiento', { pregunta: 'horario' }, {
      clinicId: 'clinic-1',
    });

    const secondCallMessages = llmService.calls[1].messages;
    expect(secondCallMessages).toEqual(
      expect.arrayContaining([
        { role: 'tool', toolCallId: 'call-1', content: 'Invalid arguments: pregunta: required' },
      ]),
    );

    const trace = expectSavedTrace('resuelta_por_ia');
    expect(trace.toolsCalled[0]).toMatchObject({
      name: 'buscar_conocimiento',
      success: false,
      result: 'Invalid arguments: pregunta: required',
    });
  });

  it('executes knowledge search and returns relevant documents to the LLM', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: true,
      parsed: { pregunta: 'horario' },
    });
    knowledgeRepository.search.mockResolvedValue([
      {
        id: 'k1',
        title: 'Horario',
        content: 'Lunes a viernes 8am-6pm',
        category: 'horarios',
        similarity: 0.92,
      },
    ]);
    llmService.setResponses([
      buildLlmResult({ toolCalls: [buildToolCall()] }),
      buildLlmResult({ content: 'Atendemos de lunes a viernes.' }),
    ]);

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', '¿A qué hora?');

    expect(knowledgeRepository.search).toHaveBeenCalledWith('clinic-1', 'horario');
    expect(result.status).toBe(ConversationStatus.RESOLVED_BY_AI);

    const toolMessage = llmService.calls[1].messages.find((m) => m.role === 'tool');
    expect(toolMessage?.content).toContain('Lunes a viernes 8am-6pm');
  });

  it('returns hallucination-control message when knowledge search has no relevant docs', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: true,
      parsed: { pregunta: 'precio' },
    });
    knowledgeRepository.search.mockResolvedValue([]);
    llmService.setResponses([
      buildLlmResult({ toolCalls: [buildToolCall({ arguments: { pregunta: 'precio' } })] }),
      buildLlmResult({ content: 'No tengo esa información.' }),
    ]);

    await orchestrator.processTurn('conv-1', 'clinic-1', '¿Cuánto cuesta?');

    const toolMessage = llmService.calls[1].messages.find((m) => m.role === 'tool');
    expect(toolMessage?.content).toContain('No relevant information found');
  });

  it('books an appointment through CommandBus and returns appointment_booked', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: true,
      parsed: {
        especialidad: 'Dermatologia',
        sede: 'Clínica Norte',
        fecha: '2026-10-05',
        hora: '08:30',
        paciente_telefono: '+573001234567',
        clinicId: 'clinic-1',
        slotId: 'slot-9',
        doctorId: 'doc-9',
        startUtc: '2026-10-05T13:30:00.000Z',
      },
    });
    commandBus.execute.mockResolvedValue({
      id: 'apt-1',
      clinicId: 'clinic-1',
      doctorId: 'doc-9',
      slotId: 'slot-9',
      patientPhone: '+573001234567',
      patientName: 'Ana',
      status: 'CONFIRMED',
    });
    llmService.setResponses([
      buildLlmResult({
        toolCalls: [
          buildToolCall({
            id: 'call-book',
            name: 'agendar_cita',
            arguments: { paciente_telefono: '+573001234567' },
          }),
        ],
      }),
    ]);

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', 'agendar cita');

    expect(result).toEqual({
      response: 'Cita agendada exitosamente. Te esperamos.',
      status: ConversationStatus.APPOINTMENT_BOOKED,
    });
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expectSavedTrace('cita_agendada');
  });

  it('feeds booking execution errors back to the LLM without terminal status', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: true,
      parsed: {
        slotId: 'slot-9',
        doctorId: 'doc-9',
        paciente_telefono: '+573001234567',
      },
    });
    commandBus.execute.mockRejectedValue(new Error('Slot slot-9 is already booked'));
    llmService.setResponses([
      buildLlmResult({
        toolCalls: [buildToolCall({ id: 'call-book', name: 'agendar_cita', arguments: {} })],
      }),
      buildLlmResult({ content: 'El horario ya no está disponible.' }),
    ]);

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', 'agendar cita');

    expect(result.status).toBe(ConversationStatus.RESOLVED_BY_AI);
    const toolMessage = llmService.calls[1].messages.find((m) => m.role === 'tool');
    expect(toolMessage?.content).toContain('Slot slot-9 is already booked');
  });

  it('escalates immediately when the LLM calls escalar_a_humano', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: true,
      parsed: { motivo: 'Necesita un humano' },
    });
    llmService.setResponses([
      buildLlmResult({
        toolCalls: [
          buildToolCall({
            id: 'call-esc',
            name: 'escalar_a_humano',
            arguments: { motivo: 'Necesita un humano' },
          }),
        ],
      }),
    ]);

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', 'quiero hablar con alguien');

    expect(result).toEqual({
      response: 'Te estoy transfiriendo a un agente humano.',
      status: ConversationStatus.ESCALATED,
    });
    expectSavedTrace('escalada');
  });

  it('forces escalation after MAX_TOOL_ITERATIONS without a terminal tool', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: true,
      parsed: { pregunta: 'x' },
    });
    knowledgeRepository.search.mockResolvedValue([]);

    const toolCallTurn = buildLlmResult({
      toolCalls: [buildToolCall({ id: `call-${Math.random()}` })],
    });
    llmService.setResponses(Array.from({ length: MAX_TOOL_ITERATIONS }, () => toolCallTurn));

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', 'hola');

    expect(result.status).toBe(ConversationStatus.ESCALATED);
    expect(llmService.callCount).toBe(MAX_TOOL_ITERATIONS);

    const trace = expectSavedTrace('escalada');
    expect(trace.toolsCalled.at(-1)).toMatchObject({
      name: 'escalar_a_humano',
      success: true,
    });
  });

  it('escalates gracefully when the LLM provider fails', async () => {
    llmService.setResponses([
      buildLlmResult(),
    ]);
    vi.spyOn(llmService, 'chat').mockRejectedValueOnce(
      new LLMProviderError('Rate limit exceeded'),
    );

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', 'hola');

    expect(result.status).toBe(ConversationStatus.ESCALATED);
    expect(result.response).toContain('humano');
    expectSavedTrace('escalada', 'unknown');
  });

  it('aggregates token usage across iterations in the saved trace', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: true,
      parsed: { pregunta: 'a' },
    });
    knowledgeRepository.search.mockResolvedValue([]);
    llmService.setResponses([
      buildLlmResult({
        toolCalls: [buildToolCall({ id: 'c1', arguments: { pregunta: 'a' } })],
        inputTokens: 100,
        outputTokens: 20,
        latencyMs: 30,
        costUsd: 0.001,
      }),
      buildLlmResult({
        content: 'Listo',
        inputTokens: 50,
        outputTokens: 10,
        latencyMs: 15,
        costUsd: 0.0005,
      }),
    ]);

    await orchestrator.processTurn('conv-1', 'clinic-1', 'hola');

    const trace = expectSavedTrace('resuelta_por_ia');
    expect(trace.inputTokens).toBe(150);
    expect(trace.outputTokens).toBe(30);
    expect(trace.latencyMs).toBe(45);
    expect(trace.costUsd).toBeCloseTo(0.0015, 6);
  });

  it('falls back to a default response when the LLM returns null content and no tools', async () => {
    llmService.setResponses([buildLlmResult({ content: null, finishReason: 'stop' })]);

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', 'hola');

    expect(result).toEqual({
      response: 'No tengo esa información.',
      status: ConversationStatus.RESOLVED_BY_AI,
    });
  });

  it('feeds executeTool unknown-tool errors back to the LLM as failed tool results', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: true,
      parsed: { pregunta: 'x' },
    });
    llmService.setResponses([
      buildLlmResult({
        toolCalls: [
          {
            id: 'call-unknown',
            name: 'inventar_tool',
            arguments: { pregunta: 'x' },
          },
        ],
      }),
      buildLlmResult({ content: 'Lo siento, no conozco esa herramienta.' }),
    ]);

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', 'hola');

    expect(result.status).toBe(ConversationStatus.RESOLVED_BY_AI);
    const toolMessage = llmService.calls[1].messages.find((m) => m.role === 'tool');
    expect(toolMessage?.content).toContain('Unknown tool: inventar_tool');

    const trace = expectSavedTrace('resuelta_por_ia');
    expect(trace.toolsCalled[0]).toMatchObject({
      name: 'inventar_tool',
      success: false,
      result: expect.stringContaining('Unknown tool: inventar_tool'),
    });
  });

  it('continues escalation when the force-escalate side-effect fails', async () => {
    llmService.setResponses([buildLlmResult()]);
    vi.spyOn(llmService, 'chat').mockRejectedValueOnce(
      new LLMProviderError('Rate limit exceeded'),
    );
    toolValidator.validate.mockResolvedValue({
      valid: false,
      error: 'Unknown tool: escalar_a_humano',
    });

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', 'hola');

    expect(result.status).toBe(ConversationStatus.ESCALATED);
    expect(result.response).toContain('humano');
  });

  it('reports SlotAlreadyBookedError with a patient-friendly tool message', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: true,
      parsed: {
        slotId: 'slot-9',
        doctorId: 'doc-9',
        paciente_telefono: '+573001234567',
      },
    });
    commandBus.execute.mockRejectedValue(new SlotAlreadyBookedError('slot-9'));
    llmService.setResponses([
      buildLlmResult({
        toolCalls: [buildToolCall({ id: 'call-book', name: 'agendar_cita', arguments: {} })],
      }),
      buildLlmResult({ content: 'El horario ya no está disponible.' }),
    ]);

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', 'agendar cita');

    expect(result.status).toBe(ConversationStatus.RESOLVED_BY_AI);
    const toolMessage = llmService.calls[1].messages.find((m) => m.role === 'tool');
    expect(toolMessage?.content).toContain('El horario ya fue reservado');
  });

  it('maps non-Error tool failures to a generic tool message', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: true,
      parsed: { pregunta: 'horario' },
    });
    knowledgeRepository.search.mockRejectedValue('string failure');
    llmService.setResponses([
      buildLlmResult({ toolCalls: [buildToolCall()] }),
      buildLlmResult({ content: 'No pude consultar.' }),
    ]);

    const result = await orchestrator.processTurn('conv-1', 'clinic-1', 'hola');

    expect(result.status).toBe(ConversationStatus.RESOLVED_BY_AI);
    const toolMessage = llmService.calls[1].messages.find((m) => m.role === 'tool');
    expect(toolMessage?.content).toBe('Error al ejecutar la herramienta');
  });

  it('passes paciente_nombre through when provided for agendar_cita', async () => {
    toolValidator.validate.mockResolvedValue({
      valid: true,
      parsed: {
        slotId: 'slot-9',
        doctorId: 'doc-9',
        paciente_telefono: '+573001234567',
        paciente_nombre: 'Ana Pérez',
      },
    });
    commandBus.execute.mockResolvedValue({
      id: 'apt-1',
      clinicId: 'clinic-1',
      doctorId: 'doc-9',
      slotId: 'slot-9',
      patientPhone: '+573001234567',
      patientName: 'Ana Pérez',
      status: 'CONFIRMED',
    });
    llmService.setResponses([
      buildLlmResult({
        toolCalls: [
          buildToolCall({
            id: 'call-book',
            name: 'agendar_cita',
            arguments: {
              doctorId: 'doc-9',
              slotId: 'slot-9',
              paciente_telefono: '+573001234567',
              paciente_nombre: 'Ana Pérez',
            },
          }),
        ],
      }),
    ]);

    await orchestrator.processTurn('conv-1', 'clinic-1', 'agendar cita');

    const command = commandBus.execute.mock.calls[0][0];
    expect(command.patientName).toBe('Ana Pérez');
  });
});
