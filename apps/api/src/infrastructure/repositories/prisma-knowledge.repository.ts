import { Inject, Injectable } from '@nestjs/common';
import type { KnowledgeDocument } from '@domain/entities/knowledge-document.entity';
import { ValidationError } from '@domain/errors/validation.error';
import type { KnowledgeRepository } from '@domain/repositories/knowledge.repository';
import { EMBEDDING_SERVICE, type EmbeddingService } from '@domain/services/embedding.service';
import { LOGGER, type Logger } from '@domain/services';
import { RAG_SIMILARITY_THRESHOLD, type KnowledgeResult } from '@domain/value-objects/knowledge-result.vo';
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

    return toDomain(created, embedding);
  }
}
