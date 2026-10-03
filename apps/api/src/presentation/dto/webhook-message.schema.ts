import { z } from 'zod';

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

export function formatWebhookValidationErrors(
  error: z.ZodError,
): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(', ');
}
