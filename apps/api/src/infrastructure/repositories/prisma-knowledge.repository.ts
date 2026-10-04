import { Inject, Injectable } from '@nestjs/common';
import type { KnowledgeDocument } from '@domain/entities/knowledge-document.entity';
import { KnowledgeDocumentNotFoundError } from '@domain/errors/knowledge-document-not-found.error';
import { ValidationError } from '@domain/errors/validation.error';
import type {
  KnowledgeDocumentFilters,
  KnowledgeRepository,
} from '@domain/repositories/knowledge.repository';
import { EMBEDDING_SERVICE, type EmbeddingService } from '@domain/services/embedding.service';
import { LOGGER, type Logger } from '@domain/services';
import { RAG_SIMILARITY_THRESHOLD, type KnowledgeResult } from '@domain/value-objects/knowledge-result.vo';
import {
  createPaginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from '@domain/value-objects/pagination.vo';
import { PrismaService } from '../database/prisma.service';

const DEFAULT_SEARCH_LIMIT = 5;

interface PrismaKnowledgeDocument {
  id: string;
  clinicId: string;
  title: string;
  content: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

interface KnowledgeSearchRow {
  id: string;
  title: string;
  content: string;
  category: string;
  similarity: number | string;
}

function toDomain(row: PrismaKnowledgeDocument, embedding?: number[]): KnowledgeDocument {
  return {
    id: row.id,
    clinicId: row.clinicId,
    title: row.title,
    content: row.content,
    category: row.category,
    embedding,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPgVector(values: number[]): string {
  return `[${values.join(',')}]`;
}

function isPrismaRecordNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}

@Injectable()
export class PrismaKnowledgeRepository implements KnowledgeRepository {
  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_SERVICE) private readonly embeddingService: EmbeddingService,
  ) {}

  async search(clinicId: string, query: string, limit?: number): Promise<KnowledgeResult[]> {
    const take = limit ?? DEFAULT_SEARCH_LIMIT;

    this.logger.debug('RAG search started', {
      context: 'PrismaKnowledgeRepository',
      clinicId,
      queryLength: query.length,
      limit: take,
    });

    let vector: number[];
    try {
      vector = await this.embeddingService.embed(query);
    } catch (error) {
      this.logger.error('Embedding failed during RAG search', {
        context: 'PrismaKnowledgeRepository',
        clinicId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    if (!vector || vector.length === 0) {
      this.logger.error('Embedding service returned an empty vector', {
        context: 'PrismaKnowledgeRepository',
        clinicId,
      });
      throw new ValidationError('Embedding service returned an empty vector', [
        { field: 'query', message: 'could not generate embedding' },
      ]);
    }

    const vectorLiteral = toPgVector(vector);
    const threshold = RAG_SIMILARITY_THRESHOLD;

    const rows = await this.prisma.$queryRaw<KnowledgeSearchRow[]>`
      SELECT id, title, content, category,
             1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM knowledge_documents
      WHERE clinic_id = ${clinicId}::uuid
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${vectorLiteral}::vector) > ${threshold}
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${take}
    `;

    const results = rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      similarity: Number(row.similarity),
    }));

    this.logger.info('RAG search completed', {
      context: 'PrismaKnowledgeRepository',
      clinicId,
      resultCount: results.length,
      topSimilarity: results[0]?.similarity ?? null,
    });

    return results;
  }

  async findByClinicId(clinicId: string): Promise<KnowledgeDocument[]> {
    const rows = await this.prisma.knowledgeDocument.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toDomain(row));
  }

  async findById(id: string): Promise<KnowledgeDocument | null> {
    this.logger.debug('Finding knowledge document by id', {
      context: 'PrismaKnowledgeRepository',
      documentId: id,
    });

    const row = await this.prisma.knowledgeDocument.findUnique({ where: { id } });

    if (!row) {
      this.logger.debug('Knowledge document not found', {
        context: 'PrismaKnowledgeRepository',
        documentId: id,
      });
      return null;
    }

    return toDomain(row);
  }

  async findMany(
    filters: KnowledgeDocumentFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeDocument>> {
    this.logger.debug('Listing knowledge documents', {
      context: 'PrismaKnowledgeRepository',
      clinicId: filters.clinicId,
      category: filters.category ?? null,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });

    const where = {
      clinicId: filters.clinicId,
      ...(filters.category ? { category: filters.category } : {}),
    };
    const skip = (pagination.page - 1) * pagination.pageSize;

    const [rows, total] = await Promise.all([
      this.prisma.knowledgeDocument.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.knowledgeDocument.count({ where }),
    ]);

    const items = rows.map((row) => toDomain(row));

    this.logger.info('Knowledge documents listed', {
      context: 'PrismaKnowledgeRepository',
      clinicId: filters.clinicId,
      resultCount: items.length,
      total,
    });

    return createPaginatedResult(items, total, pagination.page, pagination.pageSize);
  }

  async create(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    const created = await this.prisma.knowledgeDocument.create({
      data: {
        clinicId: document.clinicId,
        title: document.title,
        content: document.content,
        category: document.category,
      },
    });

    let embedding = document.embedding;

    if (embedding && embedding.length > 0) {
      const vectorLiteral = toPgVector(embedding);
      await this.prisma.$executeRaw`
        UPDATE knowledge_documents
        SET embedding = ${vectorLiteral}::vector
        WHERE id = ${created.id}::uuid
      `;
    } else {
      embedding = undefined;
    }

    this.logger.info('Knowledge document created', {
      context: 'PrismaKnowledgeRepository',
      documentId: created.id,
      clinicId: created.clinicId,
      category: created.category,
      hasEmbedding: Boolean(embedding && embedding.length > 0),
    });

    return toDomain(created, embedding);
  }

  async update(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    this.logger.debug('Updating knowledge document', {
      context: 'PrismaKnowledgeRepository',
      documentId: document.id,
      clinicId: document.clinicId,
    });

    let updated: PrismaKnowledgeDocument;
    try {
      updated = await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          title: document.title,
          content: document.content,
          category: document.category,
        },
      });
    } catch (error) {
      if (isPrismaRecordNotFound(error)) {
        this.logger.warn('Knowledge document update rejected', {
          context: 'PrismaKnowledgeRepository',
          documentId: document.id,
          reason: 'not_found',
        });
        throw new KnowledgeDocumentNotFoundError(document.id);
      }
      throw error;
    }

    let embedding = document.embedding;

    if (embedding && embedding.length > 0) {
      const vectorLiteral = toPgVector(embedding);
      await this.prisma.$executeRaw`
        UPDATE knowledge_documents
        SET embedding = ${vectorLiteral}::vector
        WHERE id = ${updated.id}::uuid
      `;
    } else {
      embedding = undefined;
    }

    this.logger.info('Knowledge document updated', {
      context: 'PrismaKnowledgeRepository',
      documentId: updated.id,
      clinicId: updated.clinicId,
      category: updated.category,
      hasEmbedding: Boolean(embedding && embedding.length > 0),
    });

    return toDomain(updated, embedding);
  }

  async delete(id: string): Promise<void> {
    this.logger.debug('Deleting knowledge document', {
      context: 'PrismaKnowledgeRepository',
      documentId: id,
    });

    try {
      await this.prisma.knowledgeDocument.delete({ where: { id } });
    } catch (error) {
      if (isPrismaRecordNotFound(error)) {
        this.logger.warn('Knowledge document delete rejected', {
          context: 'PrismaKnowledgeRepository',
          documentId: id,
          reason: 'not_found',
        });
        throw new KnowledgeDocumentNotFoundError(id);
      }
      throw error;
    }

    this.logger.info('Knowledge document deleted', {
      context: 'PrismaKnowledgeRepository',
      documentId: id,
    });
  }
}
