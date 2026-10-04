import type { KnowledgeDocumentFilters } from '@domain/repositories/knowledge.repository';
import type { PaginationParams } from '@domain/value-objects/pagination.vo';

export class ListKnowledgeDocumentsQuery {
  constructor(
    readonly filters: KnowledgeDocumentFilters,
    readonly pagination: PaginationParams,
  ) {}
}
