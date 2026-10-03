import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { EmbeddingService } from '@domain/services/embedding.service';
import { LLMProviderError } from '@domain/errors/llm-provider.error';
import { ValidationError } from '@domain/errors/validation.error';

const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_EMBEDDING_DIMENSIONS = 768;

@Injectable()
export class GeminiEmbeddingService implements EmbeddingService {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly dimensions: number;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('LLM_API_KEY'),
      baseURL: this.configService.get<string>('LLM_BASE_URL'),
    });
    this.model = this.configService.get<string>('EMBEDDING_MODEL') || DEFAULT_EMBEDDING_MODEL;
    const dimensionsRaw = this.configService.get<string>('EMBEDDING_DIMENSIONS');
    const parsedDimensions = dimensionsRaw ? Number(dimensionsRaw) : NaN;
    this.dimensions =
      Number.isFinite(parsedDimensions) && parsedDimensions > 0
        ? parsedDimensions
        : DEFAULT_EMBEDDING_DIMENSIONS;
  }

  async embed(text: string): Promise<number[]> {
    const input = text?.trim();
    if (!input) {
      throw new ValidationError('Cannot embed empty text', [
        { field: 'text', message: 'must be a non-empty string' },
      ]);
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input,
        dimensions: this.dimensions,
      });

      const embedding = response.data?.[0]?.embedding;

      if (!embedding || embedding.length === 0) {
        throw new LLMProviderError('Embedding provider returned an empty vector');
      }

      if (embedding.length !== this.dimensions) {
        throw new ValidationError(
          `Embedding dimension mismatch: expected ${this.dimensions}, got ${embedding.length}`,
          [
            {
              field: 'embedding',
              message: `model ${this.model} returned ${embedding.length} dimensions`,
            },
          ],
        );
      }

      return embedding;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof LLMProviderError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown embedding provider error';
      throw new LLMProviderError(`Embedding request failed: ${message}`, error);
    }
  }
}
