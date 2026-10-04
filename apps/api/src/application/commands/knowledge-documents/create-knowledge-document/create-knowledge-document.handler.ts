import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { KnowledgeDocument } from '@domain/entities/knowledge-document.entity';
import { ValidationError } from '@domain/errors';
import { KNOWLEDGE_REPOSITORY, type KnowledgeRepository } from '@domain/repositories';
import { EMBEDDING_SERVICE, LOGGER, type EmbeddingService, type Logger } from '@domain/services';
import {
  buildKnowledgeEmbeddingText,
  toKnowledgeDocumentDetail,
  type KnowledgeDocumentDetail,
} from '../../../dto/knowledge-document-view';
import { CreateKnowledgeDocumentCommand } from './create-knowledge-document.command';

function requireNonEmpty(field: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${field} is required`, [
      { field, message: 'must not be empty' },
    ]);
  }
  return trimmed;
}

@CommandHandler(CreateKnowledgeDocumentCommand)
@Injectable()
export class CreateKnowledgeDocumentHandler
  implements ICommandHandler<CreateKnowledgeDocumentCommand, KnowledgeDocumentDetail>
{
  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(KNOWLEDGE_REPOSITORY) private readonly knowledgeRepository: KnowledgeRepository,
    @Inject(EMBEDDING_SERVICE) private readonly embeddingService: EmbeddingService,
  ) {}

  async execute(command: CreateKnowledgeDocumentCommand): Promise<KnowledgeDocumentDetail> {
    const clinicId = requireNonEmpty('clinicId', command.clinicId);
    const title = requireNonEmpty('title', command.title);
    const content = requireNonEmpty('content', command.content);
    const category = requireNonEmpty('category', command.category);

    this.logger.debug('Creating knowledge document', {
      context: 'CreateKnowledgeDocumentHandler',
      clinicId,
      category,
    });

    const embeddingText = buildKnowledgeEmbeddingText(title, content);
    const embedding = await this.embeddingService.embed(embeddingText);

    if (!embedding || embedding.length === 0) {
      throw new ValidationError('Embedding service returned an empty vector', [
        { field: 'content', message: 'could not generate embedding' },
      ]);
    }

    const now = new Date();
    const draft: KnowledgeDocument = {
      id: randomUUID(),
      clinicId,
      title,
      content,
      category,
      embedding,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.knowledgeRepository.create(draft);

    this.logger.info('Knowledge document created', {
      context: 'CreateKnowledgeDocumentHandler',
      documentId: created.id,
      clinicId: created.clinicId,
      category: created.category,
    });

    return toKnowledgeDocumentDetail(created);
  }
}
