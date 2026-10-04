import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeDocument } from '@domain/entities/knowledge-document.entity';
import { ValidationError } from '@domain/errors';
import type { KnowledgeRepository } from '@domain/repositories';
import type { EmbeddingService, Logger } from '@domain/services';
import { CreateKnowledgeDocumentCommand } from './create-knowledge-document.command';
import { CreateKnowledgeDocumentHandler } from './create-knowledge-document.handler';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const embedding = [0.1, 0.2, 0.3];

const persistedDocument: KnowledgeDocument = {
  id: 'doc-1',
  clinicId: 'clinic-1',
  title: 'Horarios',
  content: 'Lunes a viernes 8am a 6pm',
  category: 'horarios',
  embedding,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
};

describe('CreateKnowledgeDocumentHandler', () => {
  let knowledgeRepository: { create: ReturnType<typeof vi.fn> };
  let embeddingService: { embed: ReturnType<typeof vi.fn> };
  let logger: Logger;
  let handler: CreateKnowledgeDocumentHandler;
  let command: CreateKnowledgeDocumentCommand;

  beforeEach(() => {
    knowledgeRepository = { create: vi.fn() };
    embeddingService = { embed: vi.fn().mockResolvedValue(embedding) };
    logger = createMockLogger();
    handler = new CreateKnowledgeDocumentHandler(
      logger,
      knowledgeRepository as unknown as KnowledgeRepository,
      embeddingService as EmbeddingService,
    );
    command = new CreateKnowledgeDocumentCommand(
      'clinic-1',
      'Horarios',
      'Lunes a viernes 8am a 6pm',
      'horarios',
    );
  });

  it('embeds title+content, creates the document, and returns detail without embedding', async () => {
    knowledgeRepository.create.mockResolvedValue(persistedDocument);

    const result = await handler.execute(command);

    expect(embeddingService.embed).toHaveBeenCalledWith('Horarios\n\nLunes a viernes 8am a 6pm');
    expect(knowledgeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-1',
        title: 'Horarios',
        content: 'Lunes a viernes 8am a 6pm',
        category: 'horarios',
        embedding,
      }),
    );
    expect(result).toEqual({
      id: 'doc-1',
      clinicId: 'clinic-1',
      title: 'Horarios',
      content: 'Lunes a viernes 8am a 6pm',
      category: 'horarios',
      createdAt: persistedDocument.createdAt,
      updatedAt: persistedDocument.updatedAt,
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Knowledge document created',
      expect.objectContaining({
        context: 'CreateKnowledgeDocumentHandler',
        documentId: 'doc-1',
        clinicId: 'clinic-1',
      }),
    );
  });

  it('throws ValidationError when required fields are empty', async () => {
    await expect(
      handler.execute(new CreateKnowledgeDocumentCommand('clinic-1', ' ', 'content', 'cat')),
    ).rejects.toThrow(ValidationError);

    await expect(
      handler.execute(new CreateKnowledgeDocumentCommand('clinic-1', 'title', '', 'cat')),
    ).rejects.toThrow(ValidationError);

    await expect(
      handler.execute(new CreateKnowledgeDocumentCommand('clinic-1', 'title', 'content', ' ')),
    ).rejects.toThrow(ValidationError);

    expect(knowledgeRepository.create).not.toHaveBeenCalled();
  });

  it('throws ValidationError when embedding service returns empty vector', async () => {
    embeddingService.embed.mockResolvedValue([]);

    await expect(handler.execute(command)).rejects.toThrow(ValidationError);
    expect(knowledgeRepository.create).not.toHaveBeenCalled();
  });

  it('propagates embedding service failures without persisting', async () => {
    embeddingService.embed.mockRejectedValue(new Error('provider down'));

    await expect(handler.execute(command)).rejects.toThrow('provider down');
    expect(knowledgeRepository.create).not.toHaveBeenCalled();
  });
});
