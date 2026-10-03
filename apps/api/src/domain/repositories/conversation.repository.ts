import type { Conversation } from '../entities/conversation.entity';
import type { ConversationStatus } from '../enums/conversation-status.enum';
import type { ConversationFilters } from '../value-objects/conversation-filters.vo';
import type { PaginatedResult, PaginationParams } from '../value-objects/pagination.vo';

export const CONVERSATION_REPOSITORY = Symbol('ConversationRepository');

export interface ConversationRepository {
  findByPatientPhone(clinicId: string, phone: string): Promise<Conversation | null>;
  findById(id: string): Promise<Conversation | null>;
  findAll(
    filters: ConversationFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Conversation>>;
  create(conversation: Conversation): Promise<Conversation>;
  updateStatus(id: string, status: ConversationStatus): Promise<void>;
}
