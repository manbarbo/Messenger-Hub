import type { ConversationStatus } from '@domain/enums/conversation-status.enum';
import type { AITrace } from '@domain/entities/ai-trace.entity';
import type { Message } from '@domain/entities/message.entity';

export interface ConversationSummary {
  readonly id: string;
  readonly clinicId: string;
  readonly clinicName: string | null;
  readonly patientPhone: string;
  readonly status: ConversationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastMessageAt: Date;
}

export interface ConversationDetailResult {
  readonly id: string;
  readonly clinicId: string;
  readonly clinicName: string | null;
  readonly patientPhone: string;
  readonly status: ConversationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastMessageAt: Date;
  readonly messages: Message[];
  readonly aiTraces: AITrace[];
}
