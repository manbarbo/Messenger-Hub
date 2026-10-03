import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { Conversation } from '@domain/entities/conversation.entity';
import type { Message } from '@domain/entities/message.entity';
import { ConversationStatus } from '@domain/enums/conversation-status.enum';
import {
  CONVERSATION_REPOSITORY,
  MESSAGE_REPOSITORY,
  type ConversationRepository,
  type MessageRepository,
} from '@domain/repositories';
import { LOGGER, QUEUE_SERVICE, type Logger, type QueueService } from '@domain/services';
import { ProcessIncomingMessageCommand } from './process-incoming-message.command';

export interface ProcessIncomingMessageResult {
  readonly conversationId: string;
  readonly duplicate: boolean;
}

@CommandHandler(ProcessIncomingMessageCommand)
@Injectable()
export class ProcessIncomingMessageHandler
  implements ICommandHandler<ProcessIncomingMessageCommand>
{
  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messageRepository: MessageRepository,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
  ) {}

  async execute(command: ProcessIncomingMessageCommand): Promise<ProcessIncomingMessageResult> {
    const existingMessage = await this.messageRepository.findByMessageId(command.messageId);

    if (existingMessage) {
      this.logger.debug('Duplicate message detected', {
        context: 'ProcessIncomingMessage',
        messageId: command.messageId,
        conversationId: existingMessage.conversationId,
        duplicate: true,
      });
      return { conversationId: existingMessage.conversationId, duplicate: true };
    }

    let conversation = await this.conversationRepository.findByPatientPhone(
      command.clinicId,
      command.from,
    );

    if (!conversation) {
      conversation = await this.conversationRepository.create(this.buildConversation(command));
      this.logger.info('New conversation created', {
        context: 'ProcessIncomingMessage',
        conversationId: conversation.id,
        clinicId: command.clinicId,
      });
    }

    await this.messageRepository.create(this.buildMessage(command, conversation.id));

    await this.queueService.push({
      conversationId: conversation.id,
      messageId: command.messageId,
      from: command.from,
      text: command.text,
      clinicId: command.clinicId,
    });

    this.logger.info('Message persisted and queued', {
      context: 'ProcessIncomingMessage',
      messageId: command.messageId,
      conversationId: conversation.id,
    });

    return { conversationId: conversation.id, duplicate: false };
  }

  private buildConversation(command: ProcessIncomingMessageCommand): Conversation {
    return {
      id: randomUUID(),
      clinicId: command.clinicId,
      patientPhone: command.from,
      status: ConversationStatus.ACTIVE,
      createdAt: command.timestamp,
      updatedAt: command.timestamp,
      lastMessageAt: command.timestamp,
    };
  }

  private buildMessage(command: ProcessIncomingMessageCommand, conversationId: string): Message {
    return {
      id: randomUUID(),
      conversationId,
      clinicId: command.clinicId,
      direction: 'inbound',
      role: 'user',
      content: command.text,
      messageId: command.messageId,
      createdAt: command.timestamp,
    };
  }
}
