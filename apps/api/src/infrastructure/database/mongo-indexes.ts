import type { CreateIndexesOptions, IndexDescription } from 'mongodb';

export interface MongoIndexSpec {
  readonly collection: string;
  readonly key: Record<string, 1 | -1>;
  readonly options?: CreateIndexesOptions;
}

/**
 * Canonical MongoDB index definitions for MessengerHub.
 * Kept pure so unit tests can assert them without a live database.
 */
export const MONGO_INDEX_SPECS: readonly MongoIndexSpec[] = [
  {
    collection: 'messages',
    key: { messageId: 1 },
    options: { unique: true, sparse: true },
  },
  {
    collection: 'messages',
    key: { conversationId: 1, createdAt: 1 },
  },
  {
    collection: 'messages',
    key: { clinicId: 1, createdAt: -1 },
  },
  {
    collection: 'conversations',
    key: { clinicId: 1, status: 1 },
  },
  {
    collection: 'conversations',
    key: { clinicId: 1, patientPhone: 1 },
  },
  {
    collection: 'conversations',
    key: { lastMessageAt: -1 },
  },
  {
    collection: 'ai_traces',
    key: { conversationId: 1, turnIndex: 1 },
  },
  {
    collection: 'ai_traces',
    key: { clinicId: 1, createdAt: -1 },
  },
  {
    collection: 'ai_traces',
    key: { finalStatus: 1 },
  },
] as const;

export function toIndexDescription(spec: MongoIndexSpec): IndexDescription {
  if (!spec.options) {
    return { key: spec.key };
  }
  return { key: spec.key, ...spec.options };
}
