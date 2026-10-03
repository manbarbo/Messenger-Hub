import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '@domain/entities/conversation.entity';
import type { Message } from '@domain/entities/message.entity';
import { ConversationStatus } from '@domain/enums/conversation-status.enum';
import type { ConversationRepository, MessageRepository } from '@domain/repositories';
import type { Logger, QueueService } from '@domain/services';
import { ProcessIncomingMessageCommand } from './process-incoming-message.command';
import { ProcessIncomingMessageHandler } from './process-incoming-message.handler';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const command = new ProcessIncomingMessageCommand(
  'wamid.001',
  '+573001112233',
  'Hola, quiero una cita',
  new Date('2026-10-02T15:00:00Z'),
  'clinic-1',
);

function buildConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: overrides.id ?? 'conv-1',
    clinicId: overrides.clinicId ?? 'clinic-1',
    patientPhone: overrides.patientPhone ?? '+573001112233',
    status: overrides.status ?? ConversationStatus.ACTIVE,
    createdAt: overrides.createdAt ?? new Date('2026-10-01T10:00:00Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-10-01T10:00:00Z'),
    lastMessageAt: overrides.lastMessageAt ?? new Date('2026-10-01T10:00:00Z'),
  };
}

describe('ProcessIncomingMessageHandler', () => {
  let conversationRepository: {
    findByPatientPhone: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let messageRepository: {
    findByMessageId: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let queueService: { push: ReturnType<typeof vi.fn> };
  let handler: ProcessIncomingMessageHandler;

  beforeEach(() => {
    conversationRepository = { findByPatientPhone: vi.fn(), create: vi.fn() };
    messageRepository = { findByMessageId: vi.fn(), create: vi.fn() };
    queueService = { push: vi.fn() };
    handler = new ProcessIncomingMessageHandler(
      createMockLogger(),
      conversationRepository as unknown as ConversationRepository,
      messageRepository as unknown as MessageRepository,
      queueService as QueueService,
    );
  });

  it('creates conversation, inserts message, and pushes queue job for new patient', async () => {
    conversationRepository.findByPatientPhone.mockResolvedValue(null);
    const conversation = buildConversation();
    conversationRepository.create.mockResolvedValue(conversation);
    messageRepository.findByMessageId.mockResolvedValue(null);

    const result = await handler.execute(command);

    expect(conversationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-1',
        patientPhone: '+573001112233',
        status: ConversationStatus.ACTIVE,
        lastMessageAt: command.timestamp,
      }),
    );
    expect(messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: conversation.id,
        clinicId: 'clinic-1',
        direction: 'inbound',
        role: 'user',
        content: command.text,
        messageId: 'wamid.001',
        createdAt: command.timestamp,
      }),
    );
    expect(queueService.push).toHaveBeenCalledWith({
      conversationId: conversation.id,
      messageId: 'wamid.001',
      from: '+573001112233',
      text: command.text,
      clinicId: 'clinic-1',
    });
    expect(result).toEqual({ conversationId: conversation.id, duplicate: false });
  });

  it('reuses existing non-escalated conversation for the phone number', async () => {
    const existing = buildConversation({ id: 'conv-existing' });
    conversationRepository.findByPatientPhone.mockResolvedValue(existing);
    messageRepository.findByMessageId.mockResolvedValue(null);

    const result = await handler.execute(command);

    expect(conversationRepository.create).not.toHaveBeenCalled();
    expect(conversationRepository.findByPatientPhone).toHaveBeenCalledWith(
      'clinic-1',
      '+573001112233',
    );
    expect(messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-existing' }),
    );
    expect(result).toEqual({ conversationId: 'conv-existing', duplicate: false });
  });

  it('is idempotent when messageId already exists', async () => {
    const existingMessage: Message = {
      id: 'msg-existing',
      conversationId: 'conv-existing',
      clinicId: 'clinic-1',
      direction: 'inbound',
      role: 'user',
      content: 'Hola',
      messageId: 'wamid.001',
      createdAt: command.timestamp,
    };
    messageRepository.findByMessageId.mockResolvedValue(existingMessage);

    const result = await handler.execute(command);

    expect(result).toEqual({ conversationId: 'conv-existing', duplicate: true });
    expect(conversationRepository.findByPatientPhone).not.toHaveBeenCalled();
    expect(messageRepository.create).not.toHaveBeenCalled();
    expect(queueService.push).not.toHaveBeenCalled();
  });
});
