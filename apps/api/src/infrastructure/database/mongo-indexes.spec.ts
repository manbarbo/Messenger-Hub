import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  MONGO_INDEX_SPECS,
  toIndexDescription,
} from './mongo-indexes';

describe('MongoDB index specs', () => {
  it('defines unique sparse index on messages.messageId (idempotency)', () => {
    const spec = MONGO_INDEX_SPECS.find(
      (s) => s.collection === 'messages' && 'messageId' in s.key,
    );
    expect(spec).toBeDefined();
    expect(spec?.options?.unique).toBe(true);
    expect(spec?.options?.sparse).toBe(true);
  });

  it('defines messages conversation history index', () => {
    const spec = MONGO_INDEX_SPECS.find(
      (s) => s.collection === 'messages' && 'conversationId' in s.key,
    );
    expect(spec?.key).toEqual({ conversationId: 1, createdAt: 1 });
  });

  it('defines conversations clinic+status index', () => {
    const spec = MONGO_INDEX_SPECS.find(
      (s) => s.collection === 'conversations' && 'status' in s.key,
    );
    expect(spec?.key).toEqual({ clinicId: 1, status: 1 });
  });

  it('converts specs to driver index descriptions', () => {
    const description = toIndexDescription({
      collection: 'messages',
      key: { messageId: 1 },
      options: { unique: true, sparse: true },
    });
    expect(description).toEqual({
      key: { messageId: 1 },
      unique: true,
      sparse: true,
    });
  });

  it('converts specs without options to key-only descriptions', () => {
    const description = toIndexDescription({
      collection: 'messages',
      key: { conversationId: 1, createdAt: 1 },
    });
    expect(description).toEqual({ key: { conversationId: 1, createdAt: 1 } });
  });

  it('has no duplicate collection+key pairs', () => {
    const seen = new Set(
      MONGO_INDEX_SPECS.map((s) => `${s.collection}:${JSON.stringify(s.key)}`),
    );
    expect(seen.size).toBe(MONGO_INDEX_SPECS.length);
  });
});
