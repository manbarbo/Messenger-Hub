import { Inject, Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { ValidationError } from '@domain/errors';
import { KNOWLEDGE_REPOSITORY, type KnowledgeRepository } from '@domain/repositories';
import { LOGGER, type Logger } from '@domain/services';
import type { PaginatedResult } from '@domain/value-objects/pagination.vo';
import {
  toKnowledgeDocumentSummary,
  type KnowledgeDocumentSummary,
} from '../../../dto/knowledge-document-view';
import { ListKnowledgeDocumentsQuery } from './list-knowledge-documents.query';

@QueryHandler(ListKnowledgeDocumentsQuery)
@Injectable()
export class ListKnowledgeDocumentsHandler
  implements
    IQueryHandler<ListKnowledgeDocumentsQuery, PaginatedResult<KnowledgeDocumentSummary>>
{
  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(KNOWLEDGE_REPOSITORY) private readonly knowledgeRepository: KnowledgeRepository,
  ) {}

  async execute(
    query: ListKnowledgeDocumentsQuery,
  ): Promise<PaginatedResult<KnowledgeDocumentSummary>> {
    const clinicId = query.filters.clinicId?.trim() ?? '';
    if (clinicId.length === 0) {
      throw new ValidationError('clinicId is required', [
        { field: 'clinicId', message: 'must not be empty' },
      ]);
    }

    this.logger.debug('Listing knowledge documents', {
      context: 'ListKnowledgeDocumentsQueryHandler',
      clinicId,
      category: query.filters.category ?? null,
      page: query.pagination.page,
      pageSize: query.pagination.pageSize,
    });

    const page = await this.knowledgeRepository.findMany(
      { clinicId, category: query.filters.category },
      query.pagination,
    );

    const items = page.items.map(toKnowledgeDocumentSummary);

    this.logger.info('Knowledge documents listed', {
      context: 'ListKnowledgeDocumentsQueryHandler',
      clinicId,
      resultCount: items.length,
      total: page.total,
    });

    return {
      items,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: page.totalPages,
    };
  }
}
