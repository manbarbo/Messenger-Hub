export class ConversationNotFoundError extends Error {
  readonly conversationId?: string;

  constructor(conversationId?: string, message?: string) {
    super(message ?? `Conversation ${conversationId ?? '(unknown)'} was not found`);
    this.name = 'ConversationNotFoundError';
    this.conversationId = conversationId;
  }
}
