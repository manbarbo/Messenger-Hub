import { ConversationStatus } from '../enums/conversation-status.enum';

export interface ConversationFilters {
  readonly clinicId?: string;
  readonly status?: ConversationStatus;
  readonly patientPhone?: string;
}
