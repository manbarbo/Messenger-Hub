import type { AITrace } from '../entities/ai-trace.entity';

export const AI_TRACE_REPOSITORY = Symbol('AITraceRepository');

export interface AITraceRepository {
  create(trace: AITrace): Promise<void>;
  findByConversationId(conversationId: string): Promise<AITrace[]>;
}
