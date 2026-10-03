import { Inject, Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import type { Conversation } from '@domain/entities/conversation.entity';
import { CLINIC_REPOSITORY, CONVERSATION_REPOSITORY } from '@domain/repositories';
import type { ClinicRepository, ConversationRepository } from '@domain/repositories';
import type { PaginatedResult } from '@domain/value-objects/pagination.vo';
import type { ConversationSummary } from '../../dto/conversation-view';
import { ListConversationsQuery } from './list-conversations.query';

@QueryHandler(ListConversationsQuery)
@Injectable()
export class ListConversationsHandler
  implements IQueryHandler<ListConversationsQuery, PaginatedResult<ConversationSummary>>
{
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    @Inject(CLINIC_REPOSITORY) private readonly clinicRepository: ClinicRepository,
  ) {}

  async execute(
    query: ListConversationsQuery,
  ): Promise<PaginatedResult<ConversationSummary>> {
    const page = await this.conversationRepository.findAll(
      query.filters,
      query.pagination,
    );

    const clinicNameCache = new Map<string, string | null>();
    const items: ConversationSummary[] = [];

    for (const conversation of page.items) {
      items.push(await this.toSummary(conversation, clinicNameCache));
    }

    return {
      items,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: page.totalPages,
    };
  }

  private async toSummary(
    conversation: Conversation,
    cache: Map<string, string | null>,
  ): Promise<ConversationSummary> {
    let clinicName = cache.get(conversation.clinicId);

    if (clinicName === undefined) {
      const clinic = await this.clinicRepository.findById(conversation.clinicId);
      clinicName = clinic?.name ?? null;
      cache.set(conversation.clinicId, clinicName);
    }

    return {
      id: conversation.id,
      clinicId: conversation.clinicId,
      clinicName,
      patientPhone: conversation.patientPhone,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
    };
  }
}
