import { Injectable, Logger } from '@nestjs/common';
import type { Message } from '@domain/entities/message.entity';
import type { MessageRepository } from '@domain/repositories/message.repository';
import { MONGO_COLLECTIONS, MongoService } from '../database/mongo.service';

const DUPLICATE_KEY_ERROR_CODE = 11000;

type MessageDocument = {
  _id: string;
  conversationId: string;
  clinicId: string;
  direction: string;
  role: string;
  content: string;
  messageId?: string;
  createdAt: Date;
};

function toDomain(doc: MessageDocument): Message {
  return {
    id: doc._id,
    conversationId: doc.conversationId,
    clinicId: doc.clinicId,
    direction: doc.direction as Message['direction'],
    role: doc.role as Message['role'],
    content: doc.content,
    messageId: doc.messageId,
    createdAt: doc.createdAt,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === DUPLICATE_KEY_ERROR_CODE
  );
}

@Injectable()
export class MongoMessageRepository implements MessageRepository {
  private readonly logger = new Logger(MongoMessageRepository.name);

  constructor(private readonly mongo: MongoService) {}

  private get collection() {
    return this.mongo.getCollection<MessageDocument>(MONGO_COLLECTIONS.messages);
  }

  async create(message: Message): Promise<void> {
    const doc: MessageDocument = {
      _id: message.id,
      conversationId: message.conversationId,
      clinicId: message.clinicId,
      direction: message.direction,
      role: message.role,
      content: message.content,
      messageId: message.messageId,
      createdAt: message.createdAt,
    };

    try {
      await this.collection.insertOne(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        this.logger.debug(
          `Duplicate messageId ignored (idempotent create): ${message.messageId ?? message.id}`,
        );
        return;
      }
      throw error;
    }
  }

  async findByConversationId(conversationId: string): Promise<Message[]> {
    const docs = await this.collection
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .toArray();
    return docs.map(toDomain);
  }

  async findByMessageId(messageId: string): Promise<Message | null> {
    const doc = await this.collection.findOne({ messageId });
    return doc ? toDomain(doc) : null;
  }
}
