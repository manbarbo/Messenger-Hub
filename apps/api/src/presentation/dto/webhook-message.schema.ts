import { z } from 'zod';
import { formatZodErrors } from './zod-errors';

export const WebhookMessageSchema = z.object({
  message_id: z.string().trim().min(1, 'message_id is required'),
  from: z.string().trim().min(1, 'from is required'),
  text: z.string().trim().min(1, 'text is required'),
  timestamp: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'timestamp must be a valid ISO-8601 date'),
  clinic_id: z.string().trim().min(1).optional(),
});

export type WebhookMessageInput = z.infer<typeof WebhookMessageSchema>;

export const formatWebhookValidationErrors = formatZodErrors;
