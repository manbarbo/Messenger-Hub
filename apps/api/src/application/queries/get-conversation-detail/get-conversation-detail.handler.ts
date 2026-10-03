import { Inject, Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { ConversationNotFoundError } from '@domain/errors';
import {
  AI_TRACE_REPOSITORY,
  CLINIC_REPOSITORY,
  CONVERSATION_REPOSITORY,
  MESSAGE_REPOSITORY,
} from '@domain/repositories';
import type {
  AITraceRepository,
  ClinicRepository,
  ConversationRepository,
  MessageRepository,
} from '@domain/repositories';
import type { ConversationDetailResult } from '../../dto/conversation-view';
import { GetConversationDetailQuery } from './get-conversation-detail.query';

@QueryHandler(GetConversationDetailQuery)
@Injectable()
export class GetConversationDetailHandler
  implements IQueryHandler<GetConversationDetailQuery, ConversationDetailResult>
{
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messageRepository: MessageRepository,
    @Inject(AI_TRACE_REPOSITORY) private readonly aiTraceRepository: AITraceRepository,
    @Inject(CLINIC_REPOSITORY) private readonly clinicRepository: ClinicRepository,
  ) {}

  async execute(query: GetConversationDetailQuery): Promise<ConversationDetailResult> {
    const conversation = await this.conversationRepository.findById(query.conversationId);

    if (!conversation) {
      throw new ConversationNotFoundError(query.conversationId);
    }

    const [clinic, messages, aiTraces] = await Promise.all([
      this.clinicRepository.findById(conversation.clinicId),
      this.messageRepository.findByConversationId(query.conversationId),
      this.aiTraceRepository.findByConversationId(query.conversationId),
    ]);

    return {
      id: conversation.id,
      clinicId: conversation.clinicId,
      clinicName: clinic?.name ?? null,
      patientPhone: conversation.patientPhone,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      messages,
      aiTraces,
    };
  }
}
