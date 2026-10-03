import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '@domain/entities/message.entity';
import type { Logger } from '@domain/services';
import { MONGO_COLLECTIONS } from '../database/mongo.service';
import { MongoMessageRepository } from './mongo-message.repository';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const baseMessage: Message = {
  id: 'msg-1',
  conversationId: 'conv-1',
  clinicId: 'clinic-1',
  direction: 'inbound',
  role: 'user',
  content: 'Hola, quiero una cita',
  messageId: 'wamid.001',
  createdAt: new Date('2026-10-01T10:00:00Z'),
};

const mongoDoc = {
  _id: baseMessage.id,
  conversationId: baseMessage.conversationId,
  clinicId: baseMessage.clinicId,
  direction: baseMessage.direction,
  role: baseMessage.role,
  content: baseMessage.content,
  messageId: baseMessage.messageId,
  createdAt: baseMessage.createdAt,
};

describe('MongoMessageRepository', () => {
  let collection: {
    insertOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let findCursor: {
    sort: ReturnType<typeof vi.fn>;
    toArray: ReturnType<typeof vi.fn>;
  };
  let mongo: { getCollection: ReturnType<typeof vi.fn> };
  let repository: MongoMessageRepository;

  beforeEach(() => {
    findCursor = {
      sort: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    };
    collection = {
      insertOne: vi.fn(),
      find: vi.fn().mockReturnValue(findCursor),
      findOne: vi.fn(),
    };
    mongo = { getCollection: vi.fn().mockReturnValue(collection) };
    repository = new MongoMessageRepository(createMockLogger(), mongo as never);
  });

  it('uses the messages collection', () => {
    void repository.findByMessageId('wamid.001');
    expect(mongo.getCollection).toHaveBeenCalledWith(MONGO_COLLECTIONS.messages);
  });

  describe('create', () => {
    it('inserts message document with _id from domain id', async () => {
      collection.insertOne.mockResolvedValue({ insertedId: baseMessage.id });

      await repository.create(baseMessage);

      expect(collection.insertOne).toHaveBeenCalledWith(mongoDoc);
    });

    it('ignores duplicate message_id for idempotency (error code 11000)', async () => {
      const duplicateError = Object.assign(new Error('E11000 duplicate key'), {
        code: 11000,
      });
      collection.insertOne.mockRejectedValue(duplicateError);

      await expect(repository.create(baseMessage)).resolves.toBeUndefined();
    });

    it('rethrows non-duplicate insert errors', async () => {
      const networkError = new Error('connection reset');
      collection.insertOne.mockRejectedValue(networkError);

      await expect(repository.create(baseMessage)).rejects.toThrow('connection reset');
    });
  });

  describe('findByConversationId', () => {
    it('returns messages ordered by createdAt ascending', async () => {
      findCursor.toArray.mockResolvedValue([mongoDoc]);

      const result = await repository.findByConversationId('conv-1');

      expect(collection.find).toHaveBeenCalledWith({ conversationId: 'conv-1' });
      expect(findCursor.sort).toHaveBeenCalledWith({ createdAt: 1 });
      expect(result).toEqual([baseMessage]);
    });
  });

  describe('findByMessageId', () => {
    it('finds message by WhatsApp messageId for idempotency checks', async () => {
      collection.findOne.mockResolvedValue(mongoDoc);

      const result = await repository.findByMessageId('wamid.001');

      expect(collection.findOne).toHaveBeenCalledWith({ messageId: 'wamid.001' });
      expect(result).toEqual(baseMessage);
    });

    it('returns null when messageId does not exist', async () => {
      collection.findOne.mockResolvedValue(null);

      expect(await repository.findByMessageId('wamid.missing')).toBeNull();
    });
  });
});
