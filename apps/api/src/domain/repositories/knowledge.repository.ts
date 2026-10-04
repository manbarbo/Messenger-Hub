import type { KnowledgeDocument } from '../entities/knowledge-document.entity';
import type { PaginatedResult, PaginationParams } from '../value-objects/pagination.vo';
import type { KnowledgeResult } from '../value-objects/knowledge-result.vo';

export const KNOWLEDGE_REPOSITORY = Symbol('KnowledgeRepository');

export interface KnowledgeDocumentFilters {
  readonly clinicId: string;
  readonly category?: string;
}

export interface KnowledgeRepository {
  search(clinicId: string, query: string, limit?: number): Promise<KnowledgeResult[]>;
  findByClinicId(clinicId: string): Promise<KnowledgeDocument[]>;
  findById(id: string): Promise<KnowledgeDocument | null>;
  findMany(
    filters: KnowledgeDocumentFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeDocument>>;
  create(document: KnowledgeDocument): Promise<KnowledgeDocument>;
  update(document: KnowledgeDocument): Promise<KnowledgeDocument>;
  delete(id: string): Promise<void>;
}
