export interface KnowledgeDocumentSummary {
  readonly id: string;
  readonly clinicId: string;
  readonly title: string;
  readonly category: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface KnowledgeDocumentDetail {
  readonly id: string;
  readonly clinicId: string;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function toKnowledgeDocumentSummary(document: {
  id: string;
  clinicId: string;
  title: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}): KnowledgeDocumentSummary {
  return {
    id: document.id,
    clinicId: document.clinicId,
    title: document.title,
    category: document.category,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function toKnowledgeDocumentDetail(document: {
  id: string;
  clinicId: string;
  title: string;
  content: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}): KnowledgeDocumentDetail {
  return {
    id: document.id,
    clinicId: document.clinicId,
    title: document.title,
    content: document.content,
    category: document.category,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function buildKnowledgeEmbeddingText(title: string, content: string): string {
  return `${title.trim()}\n\n${content.trim()}`;
}
