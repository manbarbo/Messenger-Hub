export class KnowledgeDocumentNotFoundError extends Error {
  readonly documentId?: string;

  constructor(documentId?: string, message?: string) {
    super(message ?? `Knowledge document ${documentId ?? '(unknown)'} was not found`);
    this.name = 'KnowledgeDocumentNotFoundError';
    this.documentId = documentId;
  }
}
