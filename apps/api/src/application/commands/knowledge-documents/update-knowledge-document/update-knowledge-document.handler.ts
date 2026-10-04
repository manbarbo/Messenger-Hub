import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { KnowledgeDocument } from '@domain/entities/knowledge-document.entity';
import { KnowledgeDocumentNotFoundError, ValidationError } from '@domain/errors';
import { KNOWLEDGE_REPOSITORY, type KnowledgeRepository } from '@domain/repositories';
import { EMBEDDING_SERVICE, LOGGER, type EmbeddingService, type Logger } from '@domain/services';
import {
  buildKnowledgeEmbeddingText,
  toKnowledgeDocumentDetail,
  type KnowledgeDocumentDetail,
} from '../../../dto/knowledge-document-view';
import { UpdateKnowledgeDocumentCommand } from './update-knowledge-document.command';

function requireNonEmpty(field: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${field} must not be empty`, [
      { field, message: 'must not be empty' },
    ]);
  }
  return trimmed;
}

@CommandHandler(UpdateKnowledgeDocumentCommand)
@Injectable()
export class UpdateKnowledgeDocumentHandler
  implements ICommandHandler<UpdateKnowledgeDocumentCommand, KnowledgeDocumentDetail>
{
  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(KNOWLEDGE_REPOSITORY) private readonly knowledgeRepository: KnowledgeRepository,
    @Inject(EMBEDDING_SERVICE) private readonly embeddingService: EmbeddingService,
  ) {}

  async execute(command: UpdateKnowledgeDocumentCommand): Promise<KnowledgeDocumentDetail> {
    const hasTitle = command.title !== undefined;
    const hasContent = command.content !== undefined;
    const hasCategory = command.category !== undefined;

    if (!hasTitle && !hasContent && !hasCategory) {
      throw new ValidationError('At least one of title, content, or category is required', [
        { field: 'body', message: 'provide title, content, or category' },
      ]);
    }

    const existing = await this.knowledgeRepository.findById(command.id);

    if (!existing) {
      this.logger.warn('Knowledge document not found', {
        context: 'UpdateKnowledgeDocumentHandler',
        documentId: command.id,
        reason: 'not_found',
      });
      throw new KnowledgeDocumentNotFoundError(command.id);
    }

    const nextTitle = hasTitle ? requireNonEmpty('title', command.title as string) : existing.title;
    const nextContent = hasContent
      ? requireNonEmpty('content', command.content as string)
      : existing.content;
    const nextCategory = hasCategory
      ? requireNonEmpty('category', command.category as string)
      : existing.category;

    const textChanged = nextTitle !== existing.title || nextContent !== existing.content;

    this.logger.debug('Updating knowledge document', {
      context: 'UpdateKnowledgeDocumentHandler',
      documentId: existing.id,
      clinicId: existing.clinicId,
      textChanged,
    });

    let embedding: number[] | undefined;
    if (textChanged) {
      embedding = await this.embeddingService.embed(
        buildKnowledgeEmbeddingText(nextTitle, nextContent),
      );

      if (!embedding || embedding.length === 0) {
        throw new ValidationError('Embedding service returned an empty vector', [
          { field: 'content', message: 'could not generate embedding' },
        ]);
      }
    }

    const nextDocument: KnowledgeDocument = {
      ...existing,
      title: nextTitle,
      content: nextContent,
      category: nextCategory,
      embedding,
      updatedAt: new Date(),
    };

    const updated = await this.knowledgeRepository.update(nextDocument);

    this.logger.info('Knowledge document updated', {
      context: 'UpdateKnowledgeDocumentHandler',
      documentId: updated.id,
      clinicId: updated.clinicId,
      category: updated.category,
      reembedded: textChanged,
    });

    return toKnowledgeDocumentDetail(updated);
  }
}
