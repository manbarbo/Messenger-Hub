import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeDocument } from '@domain/entities/knowledge-document.entity';
import { KnowledgeDocumentNotFoundError } from '@domain/errors/knowledge-document-not-found.error';
import { ValidationError } from '@domain/errors/validation.error';
import type { EmbeddingService } from '@domain/services/embedding.service';
import type { Logger } from '@domain/services';
import { RAG_SIMILARITY_THRESHOLD } from '@domain/value-objects/knowledge-result.vo';
import { createPaginationParams } from '@domain/value-objects/pagination.vo';
import { PrismaKnowledgeRepository } from './prisma-knowledge.repository';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const baseDocument: KnowledgeDocument = {
  id: 'doc-1',
  clinicId: 'clinic-1',
  title: 'Horario de atención',
  content: 'Atendemos de lunes a viernes de 8am a 6pm.',
  category: 'horarios',
  embedding: [0.1, 0.2, 0.3],
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
};

const persistedRow = {
  id: 'doc-1',
  clinicId: 'clinic-1',
  title: 'Horario de atención',
  content: 'Atendemos de lunes a viernes de 8am a 6pm.',
  category: 'horarios',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
};

function prismaNotFound(): never {
  const error = new Error('Record to update not found.') as Error & { code: string };
  error.code = 'P2025';
  throw error;
}

describe('PrismaKnowledgeRepository', () => {
  let logger: Logger;
  let embeddingService: { embed: ReturnType<typeof vi.fn> };
  let prisma: {
    knowledgeDocument: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
    $executeRaw: ReturnType<typeof vi.fn>;
  };
  let repository: PrismaKnowledgeRepository;

  beforeEach(() => {
    logger = createMockLogger();
    embeddingService = { embed: vi.fn() };
    prisma = {
      knowledgeDocument: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
    };
    repository = new PrismaKnowledgeRepository(
      logger,
      prisma as never,
      embeddingService as EmbeddingService,
    );
  });

  describe('search', () => {
    it('embeds the query and runs cosine similarity search with threshold', async () => {
      const embedding = [0.1, 0.2, 0.3];
      embeddingService.embed.mockResolvedValue(embedding);
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'doc-1',
          title: 'Horario de atención',
          content: 'Atendemos de lunes a viernes de 8am a 6pm.',
          category: 'horarios',
          similarity: '0.92',
        },
      ]);

      const results = await repository.search('clinic-1', '¿A qué hora atienden?');

      expect(embeddingService.embed).toHaveBeenCalledWith('¿A qué hora atienden?');
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(results).toEqual([
        {
          id: 'doc-1',
          title: 'Horario de atención',
          content: 'Atendemos de lunes a viernes de 8am a 6pm.',
          category: 'horarios',
          similarity: 0.92,
        },
      ]);
    });

    it('passes cosine search params: vector, clinic, threshold, and default limit 5', async () => {
      embeddingService.embed.mockResolvedValue([0.1, 0.2]);
      prisma.$queryRaw.mockResolvedValue([]);

      await repository.search('clinic-1', 'consulta');

      const call = (prisma.$queryRaw as unknown as { mock: { calls: unknown[][] } }).mock
        .calls[0];
      const templateStrings = call[0] as TemplateStringsArray;
      const sql = Array.from(templateStrings.raw ?? templateStrings).join('');
      const values = call.slice(1);

      expect(sql).toContain('embedding <=>');
      expect(sql).toContain('knowledge_documents');
      expect(values).toEqual(
        expect.arrayContaining(['[0.1,0.2]', 'clinic-1', RAG_SIMILARITY_THRESHOLD, 5]),
      );
    });

    it('returns empty array when no documents exceed the threshold', async () => {
      embeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      prisma.$queryRaw.mockResolvedValue([]);

      const results = await repository.search('clinic-1', 'consulta sin resultados');

      expect(results).toEqual([]);
    });

    it('respects a custom limit', async () => {
      embeddingService.embed.mockResolvedValue([0.1]);
      prisma.$queryRaw.mockResolvedValue([]);

      await repository.search('clinic-1', 'consulta', 2);

      const calls = (prisma.$queryRaw as unknown as { mock: { calls: unknown[][] } }).mock
        .calls;
      expect(calls[0]).toContain(2);
    });

    it('throws ValidationError when embedding service returns empty vector', async () => {
      embeddingService.embed.mockResolvedValue([]);

      await expect(repository.search('clinic-1', 'consulta')).rejects.toThrow(ValidationError);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('findByClinicId', () => {
    it('returns knowledge documents for a clinic', async () => {
      prisma.knowledgeDocument.findMany.mockResolvedValue([persistedRow]);

      const results = await repository.findByClinicId('clinic-1');

      expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith({
        where: { clinicId: 'clinic-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(results).toEqual([
        {
          ...persistedRow,
          embedding: undefined,
        },
      ]);
    });
  });

  describe('findById', () => {
    it('returns the domain document when found', async () => {
      prisma.knowledgeDocument.findUnique.mockResolvedValue(persistedRow);

      const result = await repository.findById('doc-1');

      expect(prisma.knowledgeDocument.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });
      expect(result).toEqual({ ...persistedRow, embedding: undefined });
    });

    it('returns null when the document does not exist', async () => {
      prisma.knowledgeDocument.findUnique.mockResolvedValue(null);

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('filters by clinicId and optional category with pagination', async () => {
      prisma.knowledgeDocument.findMany.mockResolvedValue([persistedRow]);
      prisma.knowledgeDocument.count.mockResolvedValue(5);

      const result = await repository.findMany(
        { clinicId: 'clinic-1', category: 'horarios' },
        createPaginationParams(2, 2),
      );

      expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith({
        where: { clinicId: 'clinic-1', category: 'horarios' },
        orderBy: { createdAt: 'desc' },
        skip: 2,
        take: 2,
      });
      expect(prisma.knowledgeDocument.count).toHaveBeenCalledWith({
        where: { clinicId: 'clinic-1', category: 'horarios' },
      });
      expect(result).toEqual({
        items: [{ ...persistedRow, embedding: undefined }],
        total: 5,
        page: 2,
        pageSize: 2,
        totalPages: 3,
      });
    });

    it('omits category filter when not provided', async () => {
      prisma.knowledgeDocument.findMany.mockResolvedValue([]);
      prisma.knowledgeDocument.count.mockResolvedValue(0);

      const result = await repository.findMany(
        { clinicId: 'clinic-1' },
        createPaginationParams(1, 20),
      );

      expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith({
        where: { clinicId: 'clinic-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result.items).toEqual([]);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('create', () => {
    it('creates the document without embedding when not provided', async () => {
      prisma.knowledgeDocument.create.mockResolvedValue(persistedRow);

      const result = await repository.create({
        ...baseDocument,
        embedding: undefined,
      });

      expect(prisma.knowledgeDocument.create).toHaveBeenCalledWith({
        data: {
          clinicId: baseDocument.clinicId,
          title: baseDocument.title,
          content: baseDocument.content,
          category: baseDocument.category,
        },
      });
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(result.embedding).toBeUndefined();
      expect(logger.info).toHaveBeenCalledWith(
        'Knowledge document created',
        expect.objectContaining({
          context: 'PrismaKnowledgeRepository',
          documentId: 'doc-1',
          hasEmbedding: false,
        }),
      );
    });

    it('persists embedding via raw vector update when provided', async () => {
      prisma.knowledgeDocument.create.mockResolvedValue(persistedRow);
      prisma.$executeRaw.mockResolvedValue(1);

      const result = await repository.create(baseDocument);

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual(baseDocument);
      expect(logger.info).toHaveBeenCalledWith(
        'Knowledge document created',
        expect.objectContaining({ hasEmbedding: true }),
      );
    });
  });

  describe('update', () => {
    it('updates fields and re-persists embedding when provided', async () => {
      prisma.knowledgeDocument.update.mockResolvedValue({
        ...persistedRow,
        title: 'Horario actualizado',
        updatedAt: new Date('2026-10-02T10:00:00Z'),
      });
      prisma.$executeRaw.mockResolvedValue(1);

      const result = await repository.update({
        ...baseDocument,
        title: 'Horario actualizado',
      });

      expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: {
          title: 'Horario actualizado',
          content: baseDocument.content,
          category: baseDocument.category,
        },
      });
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(result.title).toBe('Horario actualizado');
      expect(result.embedding).toEqual(baseDocument.embedding);
      expect(logger.info).toHaveBeenCalledWith(
        'Knowledge document updated',
        expect.objectContaining({
          context: 'PrismaKnowledgeRepository',
          documentId: 'doc-1',
          hasEmbedding: true,
        }),
      );
    });

    it('updates without writing embedding when none is provided', async () => {
      prisma.knowledgeDocument.update.mockResolvedValue({
        ...persistedRow,
        category: 'politicas_cancelacion',
      });

      const result = await repository.update({
        ...baseDocument,
        category: 'politicas_cancelacion',
        embedding: undefined,
      });

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(result.embedding).toBeUndefined();
      expect(result.category).toBe('politicas_cancelacion');
    });

    it('throws KnowledgeDocumentNotFoundError when Prisma reports missing record', async () => {
      prisma.knowledgeDocument.update.mockImplementation(() => prismaNotFound());

      await expect(repository.update(baseDocument)).rejects.toThrow(KnowledgeDocumentNotFoundError);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Knowledge document update rejected',
        expect.objectContaining({ reason: 'not_found' }),
      );
    });
  });

  describe('delete', () => {
    it('deletes the document and logs success', async () => {
      prisma.knowledgeDocument.delete.mockResolvedValue(persistedRow);

      await repository.delete('doc-1');

      expect(prisma.knowledgeDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
      expect(logger.info).toHaveBeenCalledWith(
        'Knowledge document deleted',
        expect.objectContaining({
          context: 'PrismaKnowledgeRepository',
          documentId: 'doc-1',
        }),
      );
    });

    it('throws KnowledgeDocumentNotFoundError when Prisma reports missing record', async () => {
      prisma.knowledgeDocument.delete.mockImplementation(() => prismaNotFound());

      await expect(repository.delete('missing')).rejects.toThrow(
        KnowledgeDocumentNotFoundError,
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'Knowledge document delete rejected',
        expect.objectContaining({ reason: 'not_found' }),
      );
    });
  });
});
