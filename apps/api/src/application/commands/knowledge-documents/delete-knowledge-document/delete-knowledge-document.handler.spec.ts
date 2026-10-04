import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeDocument } from '@domain/entities/knowledge-document.entity';
import { KnowledgeDocumentNotFoundError } from '@domain/errors';
import type { KnowledgeRepository } from '@domain/repositories';
import type { Logger } from '@domain/services';
import { DeleteKnowledgeDocumentCommand } from './delete-knowledge-document.command';
import { DeleteKnowledgeDocumentHandler } from './delete-knowledge-document.handler';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const existing: KnowledgeDocument = {
  id: 'doc-1',
  clinicId: 'clinic-1',
  title: 'Horarios',
  content: 'Lunes a viernes',
  category: 'horarios',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
};

describe('DeleteKnowledgeDocumentHandler', () => {
  let knowledgeRepository: {
    findById: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let logger: Logger;
  let handler: DeleteKnowledgeDocumentHandler;

  beforeEach(() => {
    knowledgeRepository = { findById: vi.fn(), delete: vi.fn() };
    logger = createMockLogger();
    handler = new DeleteKnowledgeDocumentHandler(
      logger,
      knowledgeRepository as unknown as KnowledgeRepository,
    );
  });

  it('deletes an existing document and returns confirmation', async () => {
    knowledgeRepository.findById.mockResolvedValue(existing);
    knowledgeRepository.delete.mockResolvedValue(undefined);

    const result = await handler.execute(new DeleteKnowledgeDocumentCommand('doc-1'));

    expect(knowledgeRepository.delete).toHaveBeenCalledWith('doc-1');
    expect(result).toEqual({ deleted: true, documentId: 'doc-1' });
    expect(logger.info).toHaveBeenCalledWith(
      'Knowledge document deleted',
      expect.objectContaining({
        context: 'DeleteKnowledgeDocumentHandler',
        documentId: 'doc-1',
        clinicId: 'clinic-1',
      }),
    );
  });

  it('throws KnowledgeDocumentNotFoundError when document does not exist', async () => {
    knowledgeRepository.findById.mockResolvedValue(null);

    await expect(handler.execute(new DeleteKnowledgeDocumentCommand('missing'))).rejects.toThrow(
      KnowledgeDocumentNotFoundError,
    );
    expect(knowledgeRepository.delete).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Knowledge document not found',
      expect.objectContaining({ reason: 'not_found' }),
    );
  });
});
