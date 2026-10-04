import { z } from 'zod';
import { formatZodErrors } from './zod-errors';

export const ListKnowledgeQuerySchema = z.object({
  clinicId: z.string().trim().min(1, 'clinicId must not be empty'),
  category: z.string().trim().min(1, 'category must not be empty').optional(),
  page: z.coerce.number().int().min(1, 'page must be an integer >= 1').default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit must be an integer between 1 and 100')
    .max(100, 'limit must be an integer between 1 and 100')
    .default(20),
});

export const CreateKnowledgeBodySchema = z.object({
  clinicId: z.string().trim().min(1, 'clinicId must not be empty'),
  title: z.string().trim().min(1, 'title must not be empty'),
  content: z.string().trim().min(1, 'content must not be empty'),
  category: z.string().trim().min(1, 'category must not be empty'),
});

export const UpdateKnowledgeBodySchema = z
  .object({
    title: z.string().trim().min(1, 'title must not be empty').optional(),
    content: z.string().trim().min(1, 'content must not be empty').optional(),
    category: z.string().trim().min(1, 'category must not be empty').optional(),
  })
  .refine(
    (body) => body.title !== undefined || body.content !== undefined || body.category !== undefined,
    {
      message: 'at least one of title, content, or category is required',
    },
  );

export const KnowledgeIdParamSchema = z.string().trim().min(1, 'id must not be empty');

export type ListKnowledgeQueryInput = z.infer<typeof ListKnowledgeQuerySchema>;
export type CreateKnowledgeBodyInput = z.infer<typeof CreateKnowledgeBodySchema>;
export type UpdateKnowledgeBodyInput = z.infer<typeof UpdateKnowledgeBodySchema>;

export { formatZodErrors };
