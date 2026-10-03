import type { ConversationFilters } from '@domain/value-objects/conversation-filters.vo';
import type { PaginationParams } from '@domain/value-objects/pagination.vo';

export class ListConversationsQuery {
  constructor(
    readonly filters: ConversationFilters,
    readonly pagination: PaginationParams,
  ) {}
}
