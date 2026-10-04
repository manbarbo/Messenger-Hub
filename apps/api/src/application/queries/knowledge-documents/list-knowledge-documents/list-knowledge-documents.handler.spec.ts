import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeDocument } from '@domain/entities/knowledge-document.entity';
import { ValidationError } from '@domain/errors';
import type { KnowledgeRepository } from '@domain/repositories';
import type { Logger } from '@domain/services';
import { createPaginationParams, createPaginatedResult } from '@domain/value-objects/pagination.vo';
import { ListKnowledgeDocumentsQuery } from './list-knowledge-documents.query';
import { ListKnowledgeDocumentsHandler } from './list-knowledge-documents.handler';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const documents: KnowledgeDocument[] = [
  {
    id: 'doc-1',
    clinicId: 'clinic-1',
    title: 'Horarios',
    content: 'Lunes a viernes',
    category: 'horarios',
    embedding: [0.1, 0.2],
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-01T10:00:00Z'),
  },
  {
    id: 'doc-2',
    clinicId: 'clinic-1',
    title: 'Sedes',
    content: 'Calle 10',
    category: 'sedes',
    createdAt: new Date('2026-10-02T10:00:00Z'),
    updatedAt: new Date('2026-10-02T10:00:00Z'),
  },
];

describe('ListKnowledgeDocumentsHandler', () => {
  let knowledgeRepository: { findMany: ReturnType<typeof vi.fn> };
  let logger: Logger;
  let handler: ListKnowledgeDocumentsHandler;

  beforeEach(() => {
    knowledgeRepository = { findMany: vi.fn() };
    logger = createMockLogger();
    handler = new ListKnowledgeDocumentsHandler(
      logger,
      knowledgeRepository as unknown as KnowledgeRepository,
    );
  });

  it('returns paginated summaries without embeddings', async () => {
    knowledgeRepository.findMany.mockResolvedValue(
      createPaginatedResult(documents, 2, 1, 20),
    );

    const result = await handler.execute(
      new ListKnowledgeDocumentsQuery({ clinicId: 'clinic-1' }, createPaginationParams(1, 20)),
    );

    expect(knowledgeRepository.findMany).toHaveBeenCalledWith(
      { clinicId: 'clinic-1', category: undefined },
      { page: 1, pageSize: 20 },
    );
    expect(result.items).toEqual([
      {
        id: 'doc-1',
        clinicId: 'clinic-1',
        title: 'Horarios',
        category: 'horarios',
        createdAt: documents[0].createdAt,
        updatedAt: documents[0].updatedAt,
      },
      {
        id: 'doc-2',
        clinicId: 'clinic-1',
        title: 'Sedes',
        category: 'sedes',
        createdAt: documents[1].createdAt,
        updatedAt: documents[1].updatedAt,
      },
    ]);
    expect(result.items[0]).not.toHaveProperty('content');
    expect(result.items[0]).not.toHaveProperty('embedding');
    expect(result.total).toBe(2);
    expect(logger.info).toHaveBeenCalledWith(
      'Knowledge documents listed',
      expect.objectContaining({ resultCount: 2, total: 2 }),
    );
  });

  it('passes optional category filter to the repository', async () => {
    knowledgeRepository.findMany.mockResolvedValue(createPaginatedResult([], 0, 1, 20));

    await handler.execute(
      new ListKnowledgeDocumentsQuery(
        { clinicId: 'clinic-1', category: 'horarios' },
        createPaginationParams(1, 20),
      ),
    );

    expect(knowledgeRepository.findMany).toHaveBeenCalledWith(
      { clinicId: 'clinic-1', category: 'horarios' },
      { page: 1, pageSize: 20 },
    );
  });

  it('throws ValidationError when clinicId is missing or empty', async () => {
    await expect(
      handler.execute(
        new ListKnowledgeDocumentsQuery({ clinicId: '' }, createPaginationParams(1, 20)),
      ),
    ).rejects.toThrow(ValidationError);
    expect(knowledgeRepository.findMany).not.toHaveBeenCalled();
  });

  it('returns empty page when no documents match', async () => {
    knowledgeRepository.findMany.mockResolvedValue(createPaginatedResult([], 0, 1, 20));

    const result = await handler.execute(
      new ListKnowledgeDocumentsQuery({ clinicId: 'clinic-1' }, createPaginationParams(1, 20)),
    );

    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(0);
  });
});
