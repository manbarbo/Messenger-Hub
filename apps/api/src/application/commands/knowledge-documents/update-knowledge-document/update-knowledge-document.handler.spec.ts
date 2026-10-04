import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeDocument } from '@domain/entities/knowledge-document.entity';
import { KnowledgeDocumentNotFoundError, ValidationError } from '@domain/errors';
import type { KnowledgeRepository } from '@domain/repositories';
import type { EmbeddingService, Logger } from '@domain/services';
import { UpdateKnowledgeDocumentCommand } from './update-knowledge-document.command';
import { UpdateKnowledgeDocumentHandler } from './update-knowledge-document.handler';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const existing: KnowledgeDocument = {
  id: 'doc-1',
  clinicId: 'clinic-1',
  title: 'Horarios',
  content: 'Lunes a viernes 8am a 6pm',
  category: 'horarios',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
};

describe('UpdateKnowledgeDocumentHandler', () => {
  let knowledgeRepository: {
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let embeddingService: { embed: ReturnType<typeof vi.fn> };
  let logger: Logger;
  let handler: UpdateKnowledgeDocumentHandler;

  beforeEach(() => {
    knowledgeRepository = { findById: vi.fn(), update: vi.fn() };
    embeddingService = { embed: vi.fn().mockResolvedValue([0.4, 0.5, 0.6]) };
    logger = createMockLogger();
    handler = new UpdateKnowledgeDocumentHandler(
      logger,
      knowledgeRepository as unknown as KnowledgeRepository,
      embeddingService as EmbeddingService,
    );
  });

  it('throws ValidationError when no fields are provided', async () => {
    await expect(handler.execute(new UpdateKnowledgeDocumentCommand('doc-1'))).rejects.toThrow(
      ValidationError,
    );
    expect(knowledgeRepository.findById).not.toHaveBeenCalled();
  });

  it('throws KnowledgeDocumentNotFoundError when document does not exist', async () => {
    knowledgeRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new UpdateKnowledgeDocumentCommand('doc-1', 'Nuevo título')),
    ).rejects.toThrow(KnowledgeDocumentNotFoundError);
    expect(knowledgeRepository.update).not.toHaveBeenCalled();
    expect(embeddingService.embed).not.toHaveBeenCalled();
  });

  it('re-embeds and updates when title/content change', async () => {
    knowledgeRepository.findById.mockResolvedValue(existing);
    const updated = {
      ...existing,
      title: 'Horarios actualizados',
      content: 'Lunes a sábado',
      category: 'horarios',
      embedding: [0.4, 0.5, 0.6],
      updatedAt: new Date('2026-10-02T10:00:00Z'),
    };
    knowledgeRepository.update.mockResolvedValue(updated);

    const result = await handler.execute(
      new UpdateKnowledgeDocumentCommand('doc-1', 'Horarios actualizados', 'Lunes a sábado'),
    );

    expect(embeddingService.embed).toHaveBeenCalledWith(
      'Horarios actualizados\n\nLunes a sábado',
    );
    expect(knowledgeRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc-1',
        title: 'Horarios actualizados',
        content: 'Lunes a sábado',
        category: 'horarios',
        embedding: [0.4, 0.5, 0.6],
      }),
    );
    expect(result).toEqual({
      id: 'doc-1',
      clinicId: 'clinic-1',
      title: 'Horarios actualizados',
      content: 'Lunes a sábado',
      category: 'horarios',
      createdAt: existing.createdAt,
      updatedAt: updated.updatedAt,
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Knowledge document updated',
      expect.objectContaining({ reembedded: true }),
    );
  });

  it('does not re-embed when only category changes', async () => {
    knowledgeRepository.findById.mockResolvedValue(existing);
    const updated = {
      ...existing,
      category: 'politicas_cancelacion',
      updatedAt: new Date('2026-10-02T10:00:00Z'),
    };
    knowledgeRepository.update.mockResolvedValue(updated);

    const result = await handler.execute(
      new UpdateKnowledgeDocumentCommand('doc-1', undefined, undefined, 'politicas_cancelacion'),
    );

    expect(embeddingService.embed).not.toHaveBeenCalled();
    expect(knowledgeRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'politicas_cancelacion',
        embedding: undefined,
      }),
    );
    expect(result.category).toBe('politicas_cancelacion');
    expect(logger.info).toHaveBeenCalledWith(
      'Knowledge document updated',
      expect.objectContaining({ reembedded: false }),
    );
  });

  it('keeps existing fields when partial update is provided', async () => {
    knowledgeRepository.findById.mockResolvedValue(existing);
    knowledgeRepository.update.mockResolvedValue({
      ...existing,
      title: 'Solo título',
      embedding: [0.4, 0.5, 0.6],
    });

    await handler.execute(new UpdateKnowledgeDocumentCommand('doc-1', 'Solo título'));

    expect(knowledgeRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Solo título',
        content: existing.content,
        category: existing.category,
      }),
    );
  });

  it('throws ValidationError when updated fields are empty strings', async () => {
    knowledgeRepository.findById.mockResolvedValue(existing);

    await expect(
      handler.execute(new UpdateKnowledgeDocumentCommand('doc-1', '   ')),
    ).rejects.toThrow(ValidationError);
    expect(knowledgeRepository.update).not.toHaveBeenCalled();
  });
});
