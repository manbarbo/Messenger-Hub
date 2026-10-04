import { Inject, Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { KnowledgeDocumentNotFoundError } from '@domain/errors';
import { KNOWLEDGE_REPOSITORY, type KnowledgeRepository } from '@domain/repositories';
import { LOGGER, type Logger } from '@domain/services';
import {
  toKnowledgeDocumentDetail,
  type KnowledgeDocumentDetail,
} from '../../../dto/knowledge-document-view';
import { GetKnowledgeDocumentQuery } from './get-knowledge-document.query';

@QueryHandler(GetKnowledgeDocumentQuery)
@Injectable()
export class GetKnowledgeDocumentHandler
  implements IQueryHandler<GetKnowledgeDocumentQuery, KnowledgeDocumentDetail>
{
  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(KNOWLEDGE_REPOSITORY) private readonly knowledgeRepository: KnowledgeRepository,
  ) {}

  async execute(query: GetKnowledgeDocumentQuery): Promise<KnowledgeDocumentDetail> {
    this.logger.debug('Getting knowledge document', {
      context: 'GetKnowledgeDocumentQueryHandler',
      documentId: query.id,
    });

    const document = await this.knowledgeRepository.findById(query.id);

    if (!document) {
      this.logger.warn('Knowledge document not found', {
        context: 'GetKnowledgeDocumentQueryHandler',
        documentId: query.id,
        reason: 'not_found',
      });
      throw new KnowledgeDocumentNotFoundError(query.id);
    }

    this.logger.debug('Knowledge document loaded', {
      context: 'GetKnowledgeDocumentQueryHandler',
      documentId: document.id,
      clinicId: document.clinicId,
    });

    return toKnowledgeDocumentDetail(document);
  }
}
