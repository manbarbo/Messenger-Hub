export interface KnowledgeDocument {
  readonly id: string;
  readonly clinicId: string;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly embedding?: number[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
