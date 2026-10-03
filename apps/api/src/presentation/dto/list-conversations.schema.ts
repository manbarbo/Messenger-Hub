import { z } from 'zod';
import { ConversationStatus } from '@domain/enums/conversation-status.enum';
import { formatZodErrors } from './zod-errors';

const CONVERSATION_STATUS_VALUES = [
  ConversationStatus.ACTIVE,
  ConversationStatus.RESOLVED_BY_AI,
  ConversationStatus.APPOINTMENT_BOOKED,
  ConversationStatus.ESCALATED,
] as const;

export const ListConversationsQuerySchema = z.object({
  status: z.enum(CONVERSATION_STATUS_VALUES).optional(),
  clinicId: z.string().trim().min(1, 'clinicId must not be empty').optional(),
  page: z.coerce.number().int().min(1, 'page must be an integer >= 1').default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit must be an integer between 1 and 100')
    .max(100, 'limit must be an integer between 1 and 100')
    .default(20),
});

export type ListConversationsQueryInput = z.infer<typeof ListConversationsQuerySchema>;

export { formatZodErrors };
