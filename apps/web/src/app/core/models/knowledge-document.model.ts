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

export interface CreateKnowledgeDocumentBody {
  readonly clinicId: string;
  readonly title: string;
  readonly content: string;
  readonly category: string;
}

export interface UpdateKnowledgeDocumentBody {
  readonly title?: string;
  readonly content?: string;
  readonly category?: string;
}

export interface DeleteKnowledgeDocumentResult {
  readonly deleted: true;
  readonly documentId: string;
}
