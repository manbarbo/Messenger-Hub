export enum ConversationStatus {
  ACTIVE = 'active',
  RESOLVED_BY_AI = 'resolved_by_ai',
  APPOINTMENT_BOOKED = 'appointment_booked',
  ESCALATED = 'escalated',
}

/**
 * Conversation lifecycle (DESIGN.md §3):
 * active → resolved_by_ai | appointment_booked | escalated
 * Terminal states do not revert.
 */
export const CONVERSATION_TRANSITIONS: Readonly<
  Record<ConversationStatus, readonly ConversationStatus[]>
> = {
  [ConversationStatus.ACTIVE]: [
    ConversationStatus.RESOLVED_BY_AI,
    ConversationStatus.APPOINTMENT_BOOKED,
    ConversationStatus.ESCALATED,
  ],
  [ConversationStatus.RESOLVED_BY_AI]: [],
  [ConversationStatus.APPOINTMENT_BOOKED]: [],
  [ConversationStatus.ESCALATED]: [],
};

export function canTransitionConversation(
  from: ConversationStatus,
  to: ConversationStatus,
): boolean {
  return CONVERSATION_TRANSITIONS[from]?.includes(to) ?? false;
}
