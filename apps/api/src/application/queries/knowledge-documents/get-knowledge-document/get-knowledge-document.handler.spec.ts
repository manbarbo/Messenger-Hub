import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeDocument } from '@domain/entities/knowledge-document.entity';
import { KnowledgeDocumentNotFoundError } from '@domain/errors';
import type { KnowledgeRepository } from '@domain/repositories';
import type { Logger } from '@domain/services';
import { GetKnowledgeDocumentQuery } from './get-knowledge-document.query';
import { GetKnowledgeDocumentHandler } from './get-knowledge-document.handler';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const document: KnowledgeDocument = {
  id: 'doc-1',
  clinicId: 'clinic-1',
  title: 'Horarios',
  content: 'Lunes a viernes 8am a 6pm',
  category: 'horarios',
  embedding: [0.1, 0.2, 0.3],
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
};

describe('GetKnowledgeDocumentHandler', () => {
  let knowledgeRepository: { findById: ReturnType<typeof vi.fn> };
  let logger: Logger;
  let handler: GetKnowledgeDocumentHandler;

  beforeEach(() => {
    knowledgeRepository = { findById: vi.fn() };
    logger = createMockLogger();
    handler = new GetKnowledgeDocumentHandler(
      logger,
      knowledgeRepository as unknown as KnowledgeRepository,
    );
  });

  it('returns document detail without embedding', async () => {
    knowledgeRepository.findById.mockResolvedValue(document);

    const result = await handler.execute(new GetKnowledgeDocumentQuery('doc-1'));

    expect(knowledgeRepository.findById).toHaveBeenCalledWith('doc-1');
    expect(result).toEqual({
      id: 'doc-1',
      clinicId: 'clinic-1',
      title: 'Horarios',
      content: 'Lunes a viernes 8am a 6pm',
      category: 'horarios',
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
    expect(result).not.toHaveProperty('embedding');
  });

  it('throws KnowledgeDocumentNotFoundError when document is missing', async () => {
    knowledgeRepository.findById.mockResolvedValue(null);

    await expect(handler.execute(new GetKnowledgeDocumentQuery('missing'))).rejects.toThrow(
      KnowledgeDocumentNotFoundError,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Knowledge document not found',
      expect.objectContaining({ reason: 'not_found' }),
    );
  });
});
