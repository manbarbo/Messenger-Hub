import type { Message } from '../entities/message.entity';

export const MESSAGE_REPOSITORY = Symbol('MessageRepository');

export interface MessageRepository {
  create(message: Message): Promise<void>;
  findByConversationId(conversationId: string): Promise<Message[]>;
  findByMessageId(messageId: string): Promise<Message | null>;
}
