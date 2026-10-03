export const EMBEDDING_SERVICE = Symbol('EmbeddingService');

export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
}
