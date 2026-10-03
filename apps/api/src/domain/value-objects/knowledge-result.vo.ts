export interface KnowledgeResult {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly similarity: number;
}

export const RAG_SIMILARITY_THRESHOLD = 0.7;

export function isRelevantKnowledgeResult(result: KnowledgeResult): boolean {
  return result.similarity > RAG_SIMILARITY_THRESHOLD;
}
