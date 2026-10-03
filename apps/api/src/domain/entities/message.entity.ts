export type MessageDirection = 'inbound' | 'outbound';
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  readonly id: string;
  readonly conversationId: string;
  readonly clinicId: string;
  readonly direction: MessageDirection;
  readonly role: MessageRole;
  readonly content: string;
  readonly messageId?: string;
  readonly createdAt: Date;
}
