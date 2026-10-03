import OpenAI from 'openai';

export interface EmbeddingClientOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  dimensions?: number;
}

export interface EmbeddingClient {
  embed(text: string): Promise<number[]>;
}

const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_EMBEDDING_DIMENSIONS = 768;

export function createEmbeddingClient(options: EmbeddingClientOptions = {}): EmbeddingClient {
  const apiKey = options.apiKey ?? process.env.LLM_API_KEY;
  const baseURL = options.baseURL ?? process.env.LLM_BASE_URL;
  const model = options.model ?? process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const dimensions =
    options.dimensions ??
    (process.env.EMBEDDING_DIMENSIONS
      ? Number(process.env.EMBEDDING_DIMENSIONS)
      : DEFAULT_EMBEDDING_DIMENSIONS);

  if (!apiKey) {
    throw new Error(
      'LLM_API_KEY is required to generate knowledge embeddings. Set it in apps/api/.env',
    );
  }

  const client = new OpenAI({ apiKey, baseURL });

  return {
    async embed(text: string): Promise<number[]> {
      const input = text?.trim();
      if (!input) {
        throw new Error('Cannot embed empty text');
      }

      const response = await client.embeddings.create({
        model,
        input,
        dimensions,
      });
      const embedding = response.data?.[0]?.embedding;

      if (!embedding || embedding.length === 0) {
        throw new Error('Embedding provider returned an empty vector');
      }

      if (embedding.length !== dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${dimensions}, got ${embedding.length}`,
        );
      }

      return embedding;
    },
  };
}
