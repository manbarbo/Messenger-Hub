import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AIOrchestratorService } from '../llm/ai-orchestrator.service';
import type { QueueJob } from '@domain/value-objects/queue-job.vo';
import type { ConversationRepository, MessageRepository } from '@domain/repositories';
import { CONVERSATION_REPOSITORY, MESSAGE_REPOSITORY } from '@domain/repositories';
import { LOGGER, type Logger } from '@domain/services';

export const MESSAGE_PROCESSOR_SERVICE = Symbol('MessageProcessorService');

export function buildAssistantMessageId(inboundMessageId: string): string {
  return `assistant:${inboundMessageId}`;
}

@Injectable()
export class MessageProcessorService {
  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    private readonly aiOrchestrator: AIOrchestratorService,
    @Inject(MESSAGE_REPOSITORY) private readonly messageRepository: MessageRepository,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
  ) {}

  async process(job: QueueJob): Promise<void> {
    const assistantMessageId = buildAssistantMessageId(job.messageId);

    this.logger.info('Processing incoming message', {
      context: 'MessageProcessor',
      messageId: job.messageId,
      conversationId: job.conversationId,
      clinicId: job.clinicId,
    });

    const existing = await this.messageRepository.findByMessageId(assistantMessageId);
    if (existing) {
      this.logger.debug('Message already processed', {
        context: 'MessageProcessor',
        messageId: job.messageId,
        conversationId: job.conversationId,
        duplicate: true,
      });
      return;
    }

    const conversation = await this.conversationRepository.findById(job.conversationId);
    if (!conversation) {
      this.logger.error('Conversation not found', {
        context: 'MessageProcessor',
        conversationId: job.conversationId,
        reason: 'conversation_not_found',
      });
      throw new Error(`Conversation not found: ${job.conversationId}`);
    }

    const result = await this.aiOrchestrator.processTurn(
      job.conversationId,
      job.clinicId,
      job.text,
    );

    this.logger.info('Orchestrator turn completed', {
      context: 'MessageProcessor',
      conversationId: job.conversationId,
      finalStatus: result.status,
      responseLength: result.response.length,
    });

    await this.messageRepository.create({
      id: randomUUID(),
      conversationId: job.conversationId,
      clinicId: job.clinicId,
      direction: 'outbound',
      role: 'assistant',
      content: result.response,
      messageId: assistantMessageId,
      createdAt: new Date(),
    });

    await this.conversationRepository.updateStatus(job.conversationId, result.status);

    this.logger.debug('Conversation status updated', {
      context: 'MessageProcessor',
      conversationId: job.conversationId,
      newStatus: result.status,
    });
  }
}
