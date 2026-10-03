import { z } from 'zod';
import { formatZodErrors } from './zod-errors';

export const SimulatorMessageSchema = z.object({
  from: z.string().trim().min(1, 'from is required'),
  text: z.string().trim().min(1, 'text is required'),
  clinicId: z.string().trim().min(1, 'clinicId must not be empty').optional(),
});

export type SimulatorMessageInput = z.infer<typeof SimulatorMessageSchema>;

export { formatZodErrors };
