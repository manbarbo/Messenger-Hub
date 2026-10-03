import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '@domain/entities/conversation.entity';
import { ConversationStatus } from '@domain/enums/conversation-status.enum';
import type { PaginationParams } from '@domain/value-objects/pagination.vo';
import { MONGO_COLLECTIONS } from '../database/mongo.service';
import { MongoConversationRepository } from './mongo-conversation.repository';

const baseConversation: Conversation = {
  id: 'conv-1',
  clinicId: 'clinic-1',
  patientPhone: '+573001112233',
  status: ConversationStatus.ACTIVE,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:05:00Z'),
  lastMessageAt: new Date('2026-10-01T10:05:00Z'),
};

const mongoDoc = {
  _id: baseConversation.id,
  clinicId: baseConversation.clinicId,
  patientPhone: baseConversation.patientPhone,
  status: baseConversation.status,
  createdAt: baseConversation.createdAt,
  updatedAt: baseConversation.updatedAt,
  lastMessageAt: baseConversation.lastMessageAt,
};

describe('MongoConversationRepository', () => {
  let collection: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    countDocuments: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
    updateOne: ReturnType<typeof vi.fn>;
  };
  let findCursor: {
    sort: ReturnType<typeof vi.fn>;
    skip: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    toArray: ReturnType<typeof vi.fn>;
  };
  let mongo: { getCollection: ReturnType<typeof vi.fn> };
  let logger: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let repository: MongoConversationRepository;

  beforeEach(() => {
    findCursor = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    };
    collection = {
      findOne: vi.fn(),
      find: vi.fn().mockReturnValue(findCursor),
      countDocuments: vi.fn(),
      insertOne: vi.fn(),
      updateOne: vi.fn(),
    };
    mongo = { getCollection: vi.fn().mockReturnValue(collection) };
    logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    repository = new MongoConversationRepository(mongo as never, logger as never);
  });

  it('uses the conversations collection', () => {
    void repository.findById('conv-1');
    expect(mongo.getCollection).toHaveBeenCalledWith(MONGO_COLLECTIONS.conversations);
  });

  describe('findByPatientPhone', () => {
    it('returns non-escalated conversation scoped by clinicId and phone', async () => {
      collection.findOne.mockResolvedValue(mongoDoc);

      const result = await repository.findByPatientPhone('clinic-1', '+573001112233');

      expect(collection.findOne).toHaveBeenCalledWith({
        clinicId: 'clinic-1',
        patientPhone: '+573001112233',
        status: { $nin: [ConversationStatus.ESCALATED] },
      });
      expect(result).toEqual(baseConversation);
    });

    it('returns null when no conversation exists', async () => {
      collection.findOne.mockResolvedValue(null);

      expect(await repository.findByPatientPhone('clinic-1', '+57300000000')).toBeNull();
    });
  });

  describe('findById', () => {
    it('finds conversation by _id', async () => {
      collection.findOne.mockResolvedValue(mongoDoc);

      const result = await repository.findById('conv-1');

      expect(collection.findOne).toHaveBeenCalledWith({ _id: 'conv-1' });
      expect(result).toEqual(baseConversation);
    });

    it('returns null when not found', async () => {
      collection.findOne.mockResolvedValue(null);

      expect(await repository.findById('missing')).toBeNull();
    });
  });

  describe('findAll', () => {
    const pagination: PaginationParams = { page: 2, pageSize: 10 };

    it('filters by status and clinicId with pagination sorted by lastMessageAt', async () => {
      collection.countDocuments.mockResolvedValue(25);
      findCursor.toArray.mockResolvedValue([mongoDoc]);

      const result = await repository.findAll(
        { clinicId: 'clinic-1', status: ConversationStatus.ACTIVE },
        pagination,
      );

      expect(collection.find).toHaveBeenCalledWith({
        clinicId: 'clinic-1',
        status: ConversationStatus.ACTIVE,
      });
      expect(findCursor.sort).toHaveBeenCalledWith({ lastMessageAt: -1 });
      expect(findCursor.skip).toHaveBeenCalledWith(10);
      expect(findCursor.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        items: [baseConversation],
        total: 25,
        page: 2,
        pageSize: 10,
        totalPages: 3,
      });
    });

    it('supports patientPhone filter and empty result set', async () => {
      collection.countDocuments.mockResolvedValue(0);
      findCursor.toArray.mockResolvedValue([]);

      const result = await repository.findAll(
        { patientPhone: '+573001112233' },
        { page: 1, pageSize: 20 },
      );

      expect(collection.find).toHaveBeenCalledWith({
        patientPhone: '+573001112233',
      });
      expect(result.totalPages).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  describe('create', () => {
    it('inserts document using domain id as _id and returns conversation', async () => {
      collection.insertOne.mockResolvedValue({ insertedId: baseConversation.id });

      const result = await repository.create(baseConversation);

      expect(collection.insertOne).toHaveBeenCalledWith(mongoDoc);
      expect(result).toEqual(baseConversation);
    });
  });

  describe('updateStatus', () => {
    it('sets status and updatedAt timestamp', async () => {
      collection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      vi.useFakeTimers();
      const now = new Date('2026-10-02T12:00:00Z');
      vi.setSystemTime(now);

      await repository.updateStatus('conv-1', ConversationStatus.ESCALATED);

      expect(collection.updateOne).toHaveBeenCalledWith(
        { _id: 'conv-1' },
        { $set: { status: ConversationStatus.ESCALATED, updatedAt: now } },
      );

      vi.useRealTimers();
    });
  });
});
