import type { AITrace } from './ai-trace.model';
import type { ConversationMessage } from './message.model';

export type ConversationStatus =
  | 'active'
  | 'resolved_by_ai'
  | 'appointment_booked'
  | 'escalated';

export const CONVERSATION_STATUSES: readonly ConversationStatus[] = [
  'active',
  'resolved_by_ai',
  'appointment_booked',
  'escalated',
];

export interface ConversationSummary {
  readonly id: string;
  readonly clinicId: string;
  readonly clinicName: string | null;
  readonly patientPhone: string;
  readonly status: ConversationStatus;
  readonly messageCount?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastMessageAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  readonly messages: readonly ConversationMessage[];
  readonly aiTraces: readonly AITrace[];
}

export type { ConversationMessage, AITrace };
