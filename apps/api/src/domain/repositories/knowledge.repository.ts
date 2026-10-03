import type { KnowledgeDocument } from '../entities/knowledge-document.entity';
import type { KnowledgeResult } from '../value-objects/knowledge-result.vo';

export const KNOWLEDGE_REPOSITORY = Symbol('KnowledgeRepository');

export interface KnowledgeRepository {
  search(clinicId: string, query: string, limit?: number): Promise<KnowledgeResult[]>;
  findByClinicId(clinicId: string): Promise<KnowledgeDocument[]>;
  create(document: KnowledgeDocument): Promise<KnowledgeDocument>;
}
