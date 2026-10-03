import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AITrace } from '@domain/entities/ai-trace.entity';
import type { Clinic } from '@domain/entities/clinic.entity';
import type { Conversation } from '@domain/entities/conversation.entity';
import type { Message } from '@domain/entities/message.entity';
import { ConversationStatus } from '@domain/enums/conversation-status.enum';
import { ConversationNotFoundError } from '@domain/errors';
import type {
  AITraceRepository,
  ClinicRepository,
  ConversationRepository,
  MessageRepository,
} from '@domain/repositories';
import { GetConversationDetailQuery } from './get-conversation-detail.query';
import { GetConversationDetailHandler } from './get-conversation-detail.handler';

const conversation: Conversation = {
  id: 'conv-1',
  clinicId: 'clinic-1',
  patientPhone: '+573001112233',
  status: ConversationStatus.ACTIVE,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:05:00Z'),
  lastMessageAt: new Date('2026-10-01T10:05:00Z'),
};

const clinic: Clinic = {
  id: 'clinic-1',
  name: 'Clínica Norte',
  address: 'Calle 1',
  phone: '+571',
  timezone: 'America/Bogota',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const messages: Message[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    clinicId: 'clinic-1',
    direction: 'inbound',
    role: 'user',
    content: 'Hola',
    messageId: 'wamid.1',
    createdAt: new Date('2026-10-01T10:00:00Z'),
  },
];

const aiTraces: AITrace[] = [
  {
    id: 'trace-1',
    conversationId: 'conv-1',
    clinicId: 'clinic-1',
    turnIndex: 1,
    model: 'gemini-2.0-flash',
    inputTokens: 100,
    outputTokens: 50,
    latencyMs: 200,
    costUsd: 0.0001,
    toolsCalled: [],
    finalStatus: 'resuelta_por_ia',
    createdAt: new Date('2026-10-01T10:00:01Z'),
  },
];

describe('GetConversationDetailHandler', () => {
  let conversationRepository: { findById: ReturnType<typeof vi.fn> };
  let messageRepository: { findByConversationId: ReturnType<typeof vi.fn> };
  let aiTraceRepository: { findByConversationId: ReturnType<typeof vi.fn> };
  let clinicRepository: { findById: ReturnType<typeof vi.fn>; findByName: ReturnType<typeof vi.fn> };
  let handler: GetConversationDetailHandler;

  beforeEach(() => {
    conversationRepository = { findById: vi.fn() };
    messageRepository = { findByConversationId: vi.fn() };
    aiTraceRepository = { findByConversationId: vi.fn() };
    clinicRepository = { findById: vi.fn(), findByName: vi.fn() };
    handler = new GetConversationDetailHandler(
      conversationRepository as unknown as ConversationRepository,
      messageRepository as unknown as MessageRepository,
      aiTraceRepository as unknown as AITraceRepository,
      clinicRepository as ClinicRepository,
    );
  });

  it('returns conversation with clinic name, messages, and AI traces', async () => {
    conversationRepository.findById.mockResolvedValue(conversation);
    clinicRepository.findById.mockResolvedValue(clinic);
    messageRepository.findByConversationId.mockResolvedValue(messages);
    aiTraceRepository.findByConversationId.mockResolvedValue(aiTraces);

    const result = await handler.execute(new GetConversationDetailQuery('conv-1'));

    expect(conversationRepository.findById).toHaveBeenCalledWith('conv-1');
    expect(messageRepository.findByConversationId).toHaveBeenCalledWith('conv-1');
    expect(aiTraceRepository.findByConversationId).toHaveBeenCalledWith('conv-1');
    expect(clinicRepository.findById).toHaveBeenCalledWith('clinic-1');
    expect(result).toEqual({
      id: 'conv-1',
      clinicId: 'clinic-1',
      clinicName: 'Clínica Norte',
      patientPhone: '+573001112233',
      status: ConversationStatus.ACTIVE,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      messages,
      aiTraces,
    });
  });

  it('throws ConversationNotFoundError when conversation does not exist', async () => {
    conversationRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetConversationDetailQuery('missing')),
    ).rejects.toThrow(ConversationNotFoundError);
    expect(messageRepository.findByConversationId).not.toHaveBeenCalled();
    expect(aiTraceRepository.findByConversationId).not.toHaveBeenCalled();
  });

  it('returns null clinicName when clinic row is missing', async () => {
    conversationRepository.findById.mockResolvedValue(conversation);
    clinicRepository.findById.mockResolvedValue(null);
    messageRepository.findByConversationId.mockResolvedValue([]);
    aiTraceRepository.findByConversationId.mockResolvedValue([]);

    const result = await handler.execute(new GetConversationDetailQuery('conv-1'));

    expect(result.clinicName).toBeNull();
    expect(result.messages).toEqual([]);
    expect(result.aiTraces).toEqual([]);
  });
});
