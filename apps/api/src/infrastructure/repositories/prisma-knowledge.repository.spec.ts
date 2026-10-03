import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeDocument } from '@domain/entities/knowledge-document.entity';
import { ValidationError } from '@domain/errors/validation.error';
import type { EmbeddingService } from '@domain/services/embedding.service';
import { RAG_SIMILARITY_THRESHOLD } from '@domain/value-objects/knowledge-result.vo';
import { PrismaKnowledgeRepository } from './prisma-knowledge.repository';

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

describe('PrismaKnowledgeRepository', () => {
  let embeddingService: { embed: ReturnType<typeof vi.fn> };
  let prisma: {
    knowledgeDocument: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
    $executeRaw: ReturnType<typeof vi.fn>;
  };
  let repository: PrismaKnowledgeRepository;

  beforeEach(() => {
    embeddingService = { embed: vi.fn() };
    prisma = {
      knowledgeDocument: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
    };
    repository = new PrismaKnowledgeRepository(prisma as never, embeddingService as EmbeddingService);
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
      const { embedding: _embedding, ...persisted } = baseDocument;
      prisma.knowledgeDocument.findMany.mockResolvedValue([persisted]);

      const results = await repository.findByClinicId('clinic-1');

      expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith({
        where: { clinicId: 'clinic-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(results).toEqual([
        {
          ...persisted,
          embedding: undefined,
        },
      ]);
    });
  });

  describe('create', () => {
    it('creates the document without embedding when not provided', async () => {
      const { embedding: _embedding, ...persisted } = baseDocument;
      prisma.knowledgeDocument.create.mockResolvedValue(persisted);

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
    });

    it('persists embedding via raw vector update when provided', async () => {
      const { embedding: _embedding, ...persisted } = baseDocument;
      prisma.knowledgeDocument.create.mockResolvedValue(persisted);
      prisma.$executeRaw.mockResolvedValue(1);

      const result = await repository.create(baseDocument);

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual(baseDocument);
    });
  });
});
