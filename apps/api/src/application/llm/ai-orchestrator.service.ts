import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { AITrace, AITraceFinalStatus, AITraceToolCall } from '@domain/entities/ai-trace.entity';
import { ConversationStatus } from '@domain/enums/conversation-status.enum';
import { LLMProviderError } from '@domain/errors/llm-provider.error';
import { SlotAlreadyBookedError } from '@domain/errors/slot-already-booked.error';
import type { LLMChatResult, LLMMessage, LLMToolCall } from '@domain/value-objects/llm-chat.vo';
import { isRelevantKnowledgeResult } from '@domain/value-objects/knowledge-result.vo';
import {
  AI_TRACE_REPOSITORY,
  CLINIC_REPOSITORY,
  KNOWLEDGE_REPOSITORY,
  MESSAGE_REPOSITORY,
  SLOT_REPOSITORY,
  type AITraceRepository,
  type ClinicRepository,
  type KnowledgeRepository,
  type MessageRepository,
  type SlotRepository,
} from '@domain/repositories';
import { LLM_SERVICE, type LLMService } from '@domain/services';
import { CreateAppointmentCommand } from '../commands/create-appointment/create-appointment.command';
import { parseColombiaDate } from './colombia-time';
import { PromptBuilder } from './prompt-builder';
import { TOOL_DEFINITIONS } from './tool-definitions';
import { ToolValidator } from './tool-validator';

export const MAX_TOOL_ITERATIONS = 5;

export interface OrchestratorTurnResult {
  readonly response: string;
  readonly status: ConversationStatus;
}

interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  model: string;
}

function toTraceStatus(status: ConversationStatus): AITraceFinalStatus {
  switch (status) {
    case ConversationStatus.APPOINTMENT_BOOKED:
      return 'cita_agendada';
    case ConversationStatus.ESCALATED:
      return 'escalada';
    default:
      return 'resuelta_por_ia';
  }
}

function createEmptyUsage(): TurnUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 0,
    costUsd: 0,
    model: 'unknown',
  };
}

function accumulateUsage(usage: TurnUsage, result: LLMChatResult): TurnUsage {
  return {
    inputTokens: usage.inputTokens + result.inputTokens,
    outputTokens: usage.outputTokens + result.outputTokens,
    latencyMs: usage.latencyMs + result.latencyMs,
    costUsd: Number((usage.costUsd + result.costUsd).toFixed(6)),
    model: result.model || usage.model,
  };
}

function assistantMessageFromToolCalls(toolCalls: LLMToolCall[]): LLMMessage {
  return {
    role: 'assistant',
    content: '',
    toolCalls,
  };
}

@Injectable()
export class AIOrchestratorService {
  private readonly logger = new Logger(AIOrchestratorService.name);

  constructor(
    @Inject(LLM_SERVICE) private readonly llmService: LLMService,
    @Inject(CLINIC_REPOSITORY) private readonly clinicRepository: ClinicRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messageRepository: MessageRepository,
    @Inject(KNOWLEDGE_REPOSITORY) private readonly knowledgeRepository: KnowledgeRepository,
    @Inject(SLOT_REPOSITORY) private readonly slotRepository: SlotRepository,
    @Inject(AI_TRACE_REPOSITORY) private readonly aiTraceRepository: AITraceRepository,
    private readonly commandBus: CommandBus,
    private readonly toolValidator: ToolValidator,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  async processTurn(
    conversationId: string,
    clinicId: string,
    userMessage: string,
  ): Promise<OrchestratorTurnResult> {
    const clinic = await this.clinicRepository.findById(clinicId);
    const clinicName = clinic?.name ?? 'la clínica';
    const history = await this.messageRepository.findByConversationId(conversationId);
    const messages = this.promptBuilder.buildTurnMessages(clinicName, history, userMessage);

    let toolsCalled: AITraceToolCall[] = [];
    let usage = createEmptyUsage();

    try {
      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const result = await this.llmService.chat({
          messages,
          tools: [...TOOL_DEFINITIONS],
        });
        usage = accumulateUsage(usage, result);

        if (result.toolCalls.length === 0) {
          const response = result.content ?? 'No tengo esa información.';
          await this.saveTrace({
            conversationId,
            clinicId,
            turnIndex: history.length,
            usage,
            toolsCalled,
            finalStatus: ConversationStatus.RESOLVED_BY_AI,
          });
          return { response, status: ConversationStatus.RESOLVED_BY_AI };
        }

        for (const toolCall of result.toolCalls) {
          const outcome = await this.processToolCall(
            toolCall,
            messages,
            clinicId,
          );
          toolsCalled = [...toolsCalled, outcome.traceEntry];

          if (outcome.terminal) {
            await this.saveTrace({
              conversationId,
              clinicId,
              turnIndex: history.length,
              usage,
              toolsCalled,
              finalStatus: outcome.status,
            });
            return { response: outcome.response, status: outcome.status };
          }
        }
      }

      await this.forceEscalate(
        conversationId,
        clinicId,
        history.length,
        usage,
        toolsCalled,
        'Límite de iteraciones alcanzado',
      );
      return {
        response: 'No pude resolver tu consulta. Te transfiero a un agente.',
        status: ConversationStatus.ESCALATED,
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        this.logger.warn(`LLM provider failed during turn: ${error.message}`);
        await this.forceEscalate(
          conversationId,
          clinicId,
          history.length,
          usage,
          toolsCalled,
          `Fallo del proveedor LLM: ${error.message}`,
        );
        return {
          response: 'No pude procesar tu mensaje ahora. Te transfiero a un agente humano.',
          status: ConversationStatus.ESCALATED,
        };
      }
      throw error;
    }
  }

  private async processToolCall(
    toolCall: LLMToolCall,
    messages: LLMMessage[],
    clinicId: string,
  ): Promise<{
    traceEntry: AITraceToolCall;
    terminal: boolean;
    response: string;
    status: ConversationStatus;
  }> {
    const validation = await this.toolValidator.validate(toolCall.name, toolCall.arguments, {
      clinicId,
    });

    if (!validation.valid) {
      this.appendToolExchange(messages, toolCall, validation.error);
      return {
        traceEntry: {
          name: toolCall.name,
          arguments: toolCall.arguments,
          result: validation.error,
          success: false,
        },
        terminal: false,
        response: '',
        status: ConversationStatus.ACTIVE,
      };
    }

    try {
      const toolResult = await this.executeTool(toolCall.name, validation.parsed, clinicId);
      this.appendToolExchange(messages, toolCall, JSON.stringify(toolResult));

      if (toolCall.name === 'agendar_cita') {
        return {
          traceEntry: {
            name: toolCall.name,
            arguments: toolCall.arguments,
            result: toolResult,
            success: true,
          },
          terminal: true,
          response: 'Cita agendada exitosamente. Te esperamos.',
          status: ConversationStatus.APPOINTMENT_BOOKED,
        };
      }

      if (toolCall.name === 'escalar_a_humano') {
        return {
          traceEntry: {
            name: toolCall.name,
            arguments: toolCall.arguments,
            result: toolResult,
            success: true,
          },
          terminal: true,
          response: 'Te estoy transfiriendo a un agente humano.',
          status: ConversationStatus.ESCALATED,
        };
      }

      return {
        traceEntry: {
          name: toolCall.name,
          arguments: toolCall.arguments,
          result: toolResult,
          success: true,
        },
        terminal: false,
        response: '',
        status: ConversationStatus.ACTIVE,
      };
    } catch (error) {
      const errorMessage =
        error instanceof SlotAlreadyBookedError
          ? `El horario ya fue reservado. ${error.message}. Consulta otros horarios.`
          : error instanceof Error
            ? error.message
            : 'Error al ejecutar la herramienta';

      this.appendToolExchange(messages, toolCall, errorMessage);
      return {
        traceEntry: {
          name: toolCall.name,
          arguments: toolCall.arguments,
          result: errorMessage,
          success: false,
        },
        terminal: false,
        response: '',
        status: ConversationStatus.ACTIVE,
      };
    }
  }

  private appendToolExchange(
    messages: LLMMessage[],
    toolCall: LLMToolCall,
    resultContent: string,
  ): void {
    messages.push(assistantMessageFromToolCalls([toolCall]));
    messages.push({
      role: 'tool',
      toolCallId: toolCall.id,
      content: resultContent,
    });
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    clinicId: string,
  ): Promise<unknown> {
    switch (name) {
      case 'buscar_conocimiento': {
        const results = await this.knowledgeRepository.search(
          clinicId,
          String(args.pregunta),
        );
        if (!results[0] || !isRelevantKnowledgeResult(results[0])) {
          return { documents: [], message: 'No relevant information found' };
        }
        return {
          documents: results.map((doc) => ({
            title: doc.title,
            content: doc.content,
            category: doc.category,
            similarity: doc.similarity,
          })),
        };
      }

      case 'consultar_disponibilidad': {
        const date = parseColombiaDate(String(args.fecha));
        const slots = await this.slotRepository.findAvailable(
          clinicId,
          String(args.especialidad),
          date,
        );
        return {
          slots: slots.map((slot) => ({
            id: slot.id,
            doctorId: slot.doctorId,
            startTime: slot.startTime.toISOString(),
            endTime: slot.endTime.toISOString(),
          })),
        };
      }

      case 'agendar_cita': {
        const appointment = await this.commandBus.execute(
          new CreateAppointmentCommand(
            clinicId,
            String(args.doctorId),
            String(args.slotId),
            String(args.paciente_telefono),
            typeof args.paciente_nombre === 'string' ? args.paciente_nombre : undefined,
          ),
        );
        return {
          appointmentId: appointment.id,
          status: appointment.status,
          slotId: appointment.slotId,
          doctorId: appointment.doctorId,
        };
      }

      case 'escalar_a_humano':
        return { escalated: true, reason: String(args.motivo ?? '') };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async forceEscalate(
    conversationId: string,
    clinicId: string,
    turnIndex: number,
    usage: TurnUsage,
    toolsCalled: AITraceToolCall[],
    reason: string,
  ): Promise<void> {
    try {
      await this.executeTool('escalar_a_humano', { motivo: reason }, clinicId);
    } catch (error) {
      this.logger.warn(`Force escalation side-effect failed: ${String(error)}`);
    }

    await this.saveTrace({
      conversationId,
      clinicId,
      turnIndex,
      usage,
      toolsCalled: [
        ...toolsCalled,
        {
          name: 'escalar_a_humano',
          arguments: { motivo: reason },
          result: { escalated: true, reason },
          success: true,
        },
      ],
      finalStatus: ConversationStatus.ESCALATED,
    });
  }

  private async saveTrace(params: {
    conversationId: string;
    clinicId: string;
    turnIndex: number;
    usage: TurnUsage;
    toolsCalled: AITraceToolCall[];
    finalStatus: ConversationStatus;
  }): Promise<void> {
    const trace: AITrace = {
      id: randomUUID(),
      conversationId: params.conversationId,
      clinicId: params.clinicId,
      turnIndex: params.turnIndex,
      model: params.usage.model,
      inputTokens: params.usage.inputTokens,
      outputTokens: params.usage.outputTokens,
      latencyMs: params.usage.latencyMs,
      costUsd: params.usage.costUsd,
      toolsCalled: params.toolsCalled,
      finalStatus: toTraceStatus(params.finalStatus),
      createdAt: new Date(),
    };

    await this.aiTraceRepository.create(trace);
  }
}
