import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AITrace } from '@domain/entities/ai-trace.entity';
import { MONGO_COLLECTIONS } from '../database/mongo.service';
import { MongoAITraceRepository } from './mongo-ai-trace.repository';

const baseTrace: AITrace = {
  id: 'trace-1',
  conversationId: 'conv-1',
  clinicId: 'clinic-1',
  turnIndex: 1,
  model: 'gemini-2.0-flash',
  inputTokens: 120,
  outputTokens: 80,
  latencyMs: 450,
  costUsd: 0.0002,
  toolsCalled: [
    {
      name: 'find_available_slots',
      arguments: { specialty: 'Cardiología' },
      result: [],
      success: true,
    },
  ],
  finalStatus: 'escalada',
  createdAt: new Date('2026-10-01T10:00:00Z'),
};

const mongoDoc = {
  _id: baseTrace.id,
  conversationId: baseTrace.conversationId,
  clinicId: baseTrace.clinicId,
  turnIndex: baseTrace.turnIndex,
  model: baseTrace.model,
  inputTokens: baseTrace.inputTokens,
  outputTokens: baseTrace.outputTokens,
  latencyMs: baseTrace.latencyMs,
  costUsd: baseTrace.costUsd,
  toolsCalled: baseTrace.toolsCalled,
  finalStatus: baseTrace.finalStatus,
  createdAt: baseTrace.createdAt,
};

describe('MongoAITraceRepository', () => {
  let collection: {
    insertOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
  };
  let findCursor: {
    sort: ReturnType<typeof vi.fn>;
    toArray: ReturnType<typeof vi.fn>;
  };
  let mongo: { getCollection: ReturnType<typeof vi.fn> };
  let logger: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let repository: MongoAITraceRepository;

  beforeEach(() => {
    findCursor = {
      sort: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    };
    collection = {
      insertOne: vi.fn(),
      find: vi.fn().mockReturnValue(findCursor),
    };
    mongo = { getCollection: vi.fn().mockReturnValue(collection) };
    logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    repository = new MongoAITraceRepository(mongo as never, logger as never);
  });

  it('uses the ai_traces collection', () => {
    void repository.findByConversationId('conv-1');
    expect(mongo.getCollection).toHaveBeenCalledWith(MONGO_COLLECTIONS.aiTraces);
  });

  describe('create', () => {
    it('inserts trace document with _id from domain id', async () => {
      collection.insertOne.mockResolvedValue({ insertedId: baseTrace.id });

      await repository.create(baseTrace);

      expect(collection.insertOne).toHaveBeenCalledWith(mongoDoc);
    });
  });

  describe('findByConversationId', () => {
    it('returns traces ordered by turnIndex ascending', async () => {
      findCursor.toArray.mockResolvedValue([mongoDoc]);

      const result = await repository.findByConversationId('conv-1');

      expect(collection.find).toHaveBeenCalledWith({ conversationId: 'conv-1' });
      expect(findCursor.sort).toHaveBeenCalledWith({ turnIndex: 1 });
      expect(result).toEqual([baseTrace]);
    });

    it('returns empty array when no traces exist', async () => {
      findCursor.toArray.mockResolvedValue([]);

      expect(await repository.findByConversationId('conv-empty')).toEqual([]);
    });
  });
});
