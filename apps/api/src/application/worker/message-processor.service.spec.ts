import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIOrchestratorService, OrchestratorTurnResult } from '../llm/ai-orchestrator.service';
import { ConversationStatus } from '@domain/enums/conversation-status.enum';
import type { Message } from '@domain/entities/message.entity';
import type { ConversationRepository, MessageRepository } from '@domain/repositories';
import type { QueueJob } from '@domain/value-objects/queue-job.vo';
import {
  buildAssistantMessageId,
  MessageProcessorService,
} from './message-processor.service';

const job: QueueJob = {
  conversationId: 'conv-1',
  messageId: 'wamid.001',
  from: '+573001112233',
  text: 'Hola, quiero una cita',
  clinicId: 'clinic-1',
};

function turnResult(overrides: Partial<OrchestratorTurnResult> = {}): OrchestratorTurnResult {
  return {
    response: '¡Hola! ¿Con qué especialidad necesitas la cita?',
    status: ConversationStatus.ACTIVE,
    ...overrides,
  };
}

describe('MessageProcessorService', () => {
  let orchestrator: { processTurn: ReturnType<typeof vi.fn> };
  let messageRepository: {
    findByMessageId: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let conversationRepository: {
    findById: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let service: MessageProcessorService;

  beforeEach(() => {
    orchestrator = { processTurn: vi.fn() };
    messageRepository = { findByMessageId: vi.fn().mockResolvedValue(null), create: vi.fn() };
    conversationRepository = {
      findById: vi.fn().mockResolvedValue({ id: 'conv-1' }),
      updateStatus: vi.fn(),
    };
    service = new MessageProcessorService(
      orchestrator as unknown as AIOrchestratorService,
      messageRepository as unknown as MessageRepository,
      conversationRepository as unknown as ConversationRepository,
    );
  });

  it('builds a deterministic assistant messageId for idempotency', () => {
    expect(buildAssistantMessageId('wamid.001')).toBe('assistant:wamid.001');
  });

  it('calls the orchestrator, saves outbound assistant message, and updates status', async () => {
    orchestrator.processTurn.mockResolvedValue(
      turnResult({ response: 'Cita agendada.', status: ConversationStatus.APPOINTMENT_BOOKED }),
    );

    await service.process(job);

    expect(orchestrator.processTurn).toHaveBeenCalledWith('conv-1', 'clinic-1', job.text);
    expect(messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        clinicId: 'clinic-1',
        direction: 'outbound',
        role: 'assistant',
        content: 'Cita agendada.',
        messageId: 'assistant:wamid.001',
      }),
    );
    expect(messageRepository.create.mock.calls[0][0].id).toEqual(expect.any(String));
    expect(messageRepository.create.mock.calls[0][0].createdAt).toBeInstanceOf(Date);
    expect(conversationRepository.updateStatus).toHaveBeenCalledWith(
      'conv-1',
      ConversationStatus.APPOINTMENT_BOOKED,
    );
  });

  it('is idempotent when the assistant response was already saved', async () => {
    const existing: Message = {
      id: 'out-1',
      conversationId: 'conv-1',
      clinicId: 'clinic-1',
      direction: 'outbound',
      role: 'assistant',
      content: 'Cita agendada.',
      messageId: 'assistant:wamid.001',
      createdAt: new Date('2026-10-02T15:00:00Z'),
    };
    messageRepository.findByMessageId.mockResolvedValue(existing);

    await service.process(job);

    expect(messageRepository.findByMessageId).toHaveBeenCalledWith('assistant:wamid.001');
    expect(orchestrator.processTurn).not.toHaveBeenCalled();
    expect(messageRepository.create).not.toHaveBeenCalled();
    expect(conversationRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('throws when the conversation does not exist', async () => {
    conversationRepository.findById.mockResolvedValue(null);

    await expect(service.process(job)).rejects.toThrow('Conversation not found: conv-1');
    expect(orchestrator.processTurn).not.toHaveBeenCalled();
    expect(messageRepository.create).not.toHaveBeenCalled();
  });

  it('propagates orchestrator failures so the queue can retry', async () => {
    orchestrator.processTurn.mockRejectedValue(new Error('db timeout'));

    await expect(service.process(job)).rejects.toThrow('db timeout');
    expect(messageRepository.create).not.toHaveBeenCalled();
    expect(conversationRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('propagates message save failures after a successful turn', async () => {
    orchestrator.processTurn.mockResolvedValue(turnResult());
    messageRepository.create.mockRejectedValue(new Error('mongo down'));

    await expect(service.process(job)).rejects.toThrow('mongo down');
    expect(conversationRepository.updateStatus).not.toHaveBeenCalled();
  });
});
