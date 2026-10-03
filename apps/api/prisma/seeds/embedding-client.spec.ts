import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, embeddingsConstructor } = vi.hoisted(() => ({
  createMock: vi.fn(),
  embeddingsConstructor: vi.fn(),
}));

vi.mock('openai', () => {
  class OpenAI {
    readonly embeddings = { create: createMock };

    constructor(config: unknown) {
      embeddingsConstructor(config);
    }
  }

  return { default: OpenAI };
});

import { createEmbeddingClient } from './embedding-client';

describe('createEmbeddingClient', () => {
  beforeEach(() => {
    createMock.mockReset();
    embeddingsConstructor.mockReset();
  });

  it('configures OpenAI client from env defaults', () => {
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_BASE_URL = 'https://example.test/v1/';
    process.env.EMBEDDING_MODEL = 'gemini-embedding-001';
    process.env.EMBEDDING_DIMENSIONS = '768';

    createEmbeddingClient();

    expect(embeddingsConstructor).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1/',
    });
  });

  it('throws when LLM_API_KEY is missing', () => {
    delete process.env.LLM_API_KEY;
    delete process.env.EMBEDDING_MODEL;

    expect(() => createEmbeddingClient()).toThrow(/LLM_API_KEY is required/);
  });

  it('embeds text and validates dimension', async () => {
    process.env.LLM_API_KEY = 'test-key';
    process.env.EMBEDDING_MODEL = 'gemini-embedding-001';
    process.env.EMBEDDING_DIMENSIONS = '3';

    createMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });

    const client = createEmbeddingClient();
    const result = await client.embed('  horario de atencion  ');

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(createMock).toHaveBeenCalledWith({
      model: 'gemini-embedding-001',
      input: 'horario de atencion',
      dimensions: 3,
    });
  });

  it('rejects empty text', async () => {
    process.env.LLM_API_KEY = 'test-key';
    process.env.EMBEDDING_DIMENSIONS = '3';

    const client = createEmbeddingClient();
    await expect(client.embed('   ')).rejects.toThrow(/empty text/);
  });

  it('rejects empty vectors from the provider', async () => {
    process.env.LLM_API_KEY = 'test-key';
    process.env.EMBEDDING_DIMENSIONS = '3';
    createMock.mockResolvedValue({ data: [{ embedding: [] }] });

    const client = createEmbeddingClient();
    await expect(client.embed('consulta')).rejects.toThrow(/empty vector/);
  });

  it('rejects dimension mismatches', async () => {
    process.env.LLM_API_KEY = 'test-key';
    process.env.EMBEDDING_DIMENSIONS = '768';
    createMock.mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] });

    const client = createEmbeddingClient();
    await expect(client.embed('consulta')).rejects.toThrow(/dimension mismatch/);
  });
});
