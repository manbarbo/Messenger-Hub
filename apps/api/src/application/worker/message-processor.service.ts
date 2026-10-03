import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AIOrchestratorService } from '../llm/ai-orchestrator.service';
import type { QueueJob } from '@domain/value-objects/queue-job.vo';
import type { ConversationRepository, MessageRepository } from '@domain/repositories';
import { CONVERSATION_REPOSITORY, MESSAGE_REPOSITORY } from '@domain/repositories';

export const MESSAGE_PROCESSOR_SERVICE = Symbol('MessageProcessorService');

export function buildAssistantMessageId(inboundMessageId: string): string {
  return `assistant:${inboundMessageId}`;
}

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);

  constructor(
    private readonly aiOrchestrator: AIOrchestratorService,
    @Inject(MESSAGE_REPOSITORY) private readonly messageRepository: MessageRepository,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
  ) {}

  async process(job: QueueJob): Promise<void> {
    const assistantMessageId = buildAssistantMessageId(job.messageId);

    const existing = await this.messageRepository.findByMessageId(assistantMessageId);
    if (existing) {
      this.logger.log(`Skipping already-processed message ${job.messageId}`);
      return;
    }

    const conversation = await this.conversationRepository.findById(job.conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${job.conversationId}`);
    }

    const result = await this.aiOrchestrator.processTurn(
      job.conversationId,
      job.clinicId,
      job.text,
    );

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
  }
}
