import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { KnowledgeDocumentNotFoundError } from '@domain/errors';
import { KNOWLEDGE_REPOSITORY, type KnowledgeRepository } from '@domain/repositories';
import { LOGGER, type Logger } from '@domain/services';
import { DeleteKnowledgeDocumentCommand } from './delete-knowledge-document.command';

export interface DeleteKnowledgeDocumentResult {
  readonly deleted: true;
  readonly documentId: string;
}

@CommandHandler(DeleteKnowledgeDocumentCommand)
@Injectable()
export class DeleteKnowledgeDocumentHandler
  implements ICommandHandler<DeleteKnowledgeDocumentCommand, DeleteKnowledgeDocumentResult>
{
  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(KNOWLEDGE_REPOSITORY) private readonly knowledgeRepository: KnowledgeRepository,
  ) {}

  async execute(
    command: DeleteKnowledgeDocumentCommand,
  ): Promise<DeleteKnowledgeDocumentResult> {
    const existing = await this.knowledgeRepository.findById(command.id);

    if (!existing) {
      this.logger.warn('Knowledge document not found', {
        context: 'DeleteKnowledgeDocumentHandler',
        documentId: command.id,
        reason: 'not_found',
      });
      throw new KnowledgeDocumentNotFoundError(command.id);
    }

    await this.knowledgeRepository.delete(command.id);

    this.logger.info('Knowledge document deleted', {
      context: 'DeleteKnowledgeDocumentHandler',
      documentId: existing.id,
      clinicId: existing.clinicId,
      category: existing.category,
    });

    return { deleted: true, documentId: existing.id };
  }
}
