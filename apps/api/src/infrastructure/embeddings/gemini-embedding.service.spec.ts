import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Logger } from '@domain/services';
import { LLMProviderError } from '@domain/errors/llm-provider.error';
import { ValidationError } from '@domain/errors/validation.error';
import { GeminiEmbeddingService } from './gemini-embedding.service';

const { createMock, embeddingsConstructor } = vi.hoisted(() => ({
  createMock: vi.fn(),
  embeddingsConstructor: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    readonly config: unknown;
    readonly embeddings = { create: createMock };

    constructor(config: unknown) {
      this.config = config;
      embeddingsConstructor(config);
    }
  },
}));

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createConfigService(
  overrides: Record<string, string | undefined> = {},
): ConfigService {
  const values: Record<string, string | undefined> = {
    LLM_API_KEY: 'test-key',
    LLM_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    EMBEDDING_MODEL: 'gemini-embedding-001',
    EMBEDDING_DIMENSIONS: '768',
    ...overrides,
  };

  return {
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      (values[key] as T | undefined) ?? defaultValue,
  } as unknown as ConfigService;
}

function createVector(length = 768, fill = 0.01): number[] {
  return Array.from({ length }, () => fill);
}

function createService(config: ConfigService = createConfigService()): GeminiEmbeddingService {
  return new GeminiEmbeddingService(createMockLogger(), config);
}

describe('GeminiEmbeddingService', () => {
  beforeEach(() => {
    createMock.mockReset();
    embeddingsConstructor.mockReset();
  });

  it('configures OpenAI client from LLM env vars', () => {
    createService(createConfigService());

    expect(embeddingsConstructor).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
  });

  it('embeds text with the configured model and returns the vector', async () => {
    const vector = createVector();
    createMock.mockResolvedValue({ data: [{ embedding: vector }] });

    const service = createService();
    const result = await service.embed('¿A qué hora atienden?');

    expect(createMock).toHaveBeenCalledWith({
      model: 'gemini-embedding-001',
      input: '¿A qué hora atienden?',
      dimensions: 768,
    });
    expect(result).toEqual(vector);
    expect(result).toHaveLength(768);
  });

  it('trims input text before embedding', async () => {
    createMock.mockResolvedValue({ data: [{ embedding: createVector() }] });

    const service = createService();
    await service.embed('  horario de atencion  ');

    expect(createMock).toHaveBeenCalledWith({
      model: 'gemini-embedding-001',
      input: 'horario de atencion',
      dimensions: 768,
    });
  });

  it('supports custom embedding model and dimensions from config', async () => {
    const vector = createVector(1536, 0.02);
    createMock.mockResolvedValue({ data: [{ embedding: vector }] });

    const service = createService(
      createConfigService({
        EMBEDDING_MODEL: 'gemini-embedding-2',
        EMBEDDING_DIMENSIONS: '1536',
      }),
    );
    const result = await service.embed('consulta');

    expect(createMock).toHaveBeenCalledWith({
      model: 'gemini-embedding-2',
      input: 'consulta',
      dimensions: 1536,
    });
    expect(result).toHaveLength(1536);
  });

  it('throws ValidationError for empty or whitespace-only text', async () => {
    const service = createService();

    await expect(service.embed('')).rejects.toBeInstanceOf(ValidationError);
    await expect(service.embed('   ')).rejects.toBeInstanceOf(ValidationError);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('throws LLMProviderError when the provider fails', async () => {
    createMock.mockRejectedValue(new Error('Rate limit exceeded'));
    const service = createService();

    await expect(service.embed('consulta')).rejects.toMatchObject({
      name: 'LLMProviderError',
      message: expect.stringContaining('Rate limit exceeded'),
    });
  });

  it('throws LLMProviderError when the provider returns an empty vector', async () => {
    createMock.mockResolvedValue({ data: [{ embedding: [] }] });
    const service = createService();

    await expect(service.embed('consulta')).rejects.toBeInstanceOf(LLMProviderError);
  });

  it('throws ValidationError on dimension mismatch', async () => {
    createMock.mockResolvedValue({ data: [{ embedding: createVector(10) }] });
    const service = createService();

    await expect(service.embed('consulta')).rejects.toBeInstanceOf(ValidationError);
  });

  it('falls back to default embedding model and dimensions when config is missing', async () => {
    const vector = createVector();
    createMock.mockResolvedValue({ data: [{ embedding: vector }] });

    const service = createService(
      createConfigService({
        EMBEDDING_MODEL: undefined,
        EMBEDDING_DIMENSIONS: undefined,
      }),
    );
    await service.embed('consulta');

    expect(createMock).toHaveBeenCalledWith({
      model: 'gemini-embedding-001',
      input: 'consulta',
      dimensions: 768,
    });
  });

  it('falls back to default dimensions when EMBEDDING_DIMENSIONS is invalid', async () => {
    const vector = createVector();
    createMock.mockResolvedValue({ data: [{ embedding: vector }] });

    const service = createService(
      createConfigService({ EMBEDDING_DIMENSIONS: 'not-a-number' }),
    );
    await service.embed('consulta');

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ dimensions: 768 }),
    );
  });

  it('wraps non-Error provider failures as LLMProviderError', async () => {
    createMock.mockRejectedValue('provider string failure');
    const service = createService();

    await expect(service.embed('consulta')).rejects.toMatchObject({
      name: 'LLMProviderError',
      message: expect.stringContaining('Unknown embedding provider error'),
    });
  });
});
