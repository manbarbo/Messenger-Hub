export interface KnowledgeDocumentSummary {
  readonly id: string;
  readonly clinicId: string;
  readonly title: string;
  readonly category: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface KnowledgeDocumentDetail {
  readonly id: string;
  readonly clinicId: string;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListKnowledgeDocumentsParams {
  readonly clinicId: string;
  readonly category?: string;
  readonly page?: number;
  readonly limit?: number;
}
