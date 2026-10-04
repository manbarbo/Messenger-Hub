import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clinic } from '@domain/entities/clinic.entity';
import type { Conversation } from '@domain/entities/conversation.entity';
import { ConversationStatus } from '@domain/enums/conversation-status.enum';
import type { ClinicRepository, ConversationRepository } from '@domain/repositories';
import type { PaginatedResult } from '@domain/value-objects/pagination.vo';
import type { ConversationSummary } from '../../dto/conversation-view';
import { ListConversationsQuery } from './list-conversations.query';
import { ListConversationsHandler } from './list-conversations.handler';

function buildConversation(id: string, clinicId: string): Conversation {
  return {
    id,
    clinicId,
    patientPhone: '+573001112233',
    status: ConversationStatus.ACTIVE,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-01T10:05:00Z'),
    lastMessageAt: new Date('2026-10-01T10:05:00Z'),
  };
}

function buildClinic(id: string, name: string): Clinic {
  return {
    id,
    name,
    address: 'Calle 1',
    phone: '+571',
    timezone: 'America/Bogota',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('ListConversationsHandler', () => {
  let conversationRepository: { findAll: ReturnType<typeof vi.fn> };
  let clinicRepository: {
    findById: ReturnType<typeof vi.fn>;
    findByName: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
  };
  let logger: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let handler: ListConversationsHandler;

  beforeEach(() => {
    conversationRepository = { findAll: vi.fn() };
    clinicRepository = { findById: vi.fn(), findByName: vi.fn(), findAll: vi.fn() };
    logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    handler = new ListConversationsHandler(
      conversationRepository as unknown as ConversationRepository,
      clinicRepository as unknown as ClinicRepository,
      logger as never,
    );
  });

  it('returns paginated summaries enriched with clinic name from PostgreSQL', async () => {
    const conversations = [
      buildConversation('conv-1', 'clinic-1'),
      buildConversation('conv-2', 'clinic-1'),
      buildConversation('conv-3', 'clinic-2'),
    ];
    const page: PaginatedResult<Conversation> = {
      items: conversations,
      total: 25,
      page: 2,
      pageSize: 10,
      totalPages: 3,
    };
    conversationRepository.findAll.mockResolvedValue(page);
    clinicRepository.findById.mockImplementation(async (id: string) =>
      id === 'clinic-1' ? buildClinic('clinic-1', 'Clínica Norte') : buildClinic('clinic-2', 'Clínica Sur'),
    );

    const result = await handler.execute(
      new ListConversationsQuery(
        { status: ConversationStatus.ACTIVE, clinicId: 'clinic-1' },
        { page: 2, pageSize: 10 },
      ),
    );

    expect(conversationRepository.findAll).toHaveBeenCalledWith(
      { status: ConversationStatus.ACTIVE, clinicId: 'clinic-1' },
      { page: 2, pageSize: 10 },
    );
    expect(clinicRepository.findById).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(3);
    expect(result.items).toEqual<ConversationSummary[]>([
      expect.objectContaining({ id: 'conv-1', clinicName: 'Clínica Norte' }),
      expect.objectContaining({ id: 'conv-2', clinicName: 'Clínica Norte' }),
      expect.objectContaining({ id: 'conv-3', clinicName: 'Clínica Sur' }),
    ]);
  });

  it('sets clinicName to null when clinic is missing', async () => {
    conversationRepository.findAll.mockResolvedValue({
      items: [buildConversation('conv-1', 'clinic-missing')],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    clinicRepository.findById.mockResolvedValue(null);

    const result = await handler.execute(
      new ListConversationsQuery({}, { page: 1, pageSize: 20 }),
    );

    expect(result.items[0].clinicName).toBeNull();
  });

  it('returns empty page without querying clinics', async () => {
    conversationRepository.findAll.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    const result = await handler.execute(
      new ListConversationsQuery({}, { page: 1, pageSize: 20 }),
    );

    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(0);
    expect(clinicRepository.findById).not.toHaveBeenCalled();
  });
});
