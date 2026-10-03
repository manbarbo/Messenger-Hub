import {
  ConversationStatus,
  CONVERSATION_TRANSITIONS,
  canTransitionConversation,
} from '../enums/conversation-status.enum';
import { ValidationError } from '../errors/validation.error';

export interface Conversation {
  readonly id: string;
  readonly clinicId: string;
  readonly patientPhone: string;
  readonly status: ConversationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastMessageAt: Date;
}

export function isTerminalConversation(status: ConversationStatus): boolean {
  return CONVERSATION_TRANSITIONS[status].length === 0;
}

export function assertConversationTransition(
  from: ConversationStatus,
  to: ConversationStatus,
): void {
  if (!canTransitionConversation(from, to)) {
    throw new ValidationError(
      `Invalid conversation status transition: ${from} → ${to}`,
      [{ field: 'status', message: `cannot transition from ${from} to ${to}` }],
    );
  }
}

export function transitionConversation(
  conversation: Conversation,
  to: ConversationStatus,
  now: Date = new Date(),
): Conversation {
  assertConversationTransition(conversation.status, to);
  return {
    ...conversation,
    status: to,
    updatedAt: now,
  };
}
