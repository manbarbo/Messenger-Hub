import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import type { Response } from 'express';
import { ProcessIncomingMessageCommand } from '@application/commands/process-incoming-message/process-incoming-message.command';
import type { ProcessIncomingMessageResult } from '@application/commands/process-incoming-message/process-incoming-message.handler';
import { LOGGER, type Logger } from '@domain/services';
import {
  formatWebhookValidationErrors,
  WebhookMessageSchema,
} from '../dto/webhook-message.schema';

export interface WebhookMessageResponse {
  readonly status: 'accepted' | 'duplicate';
  readonly conversationId: string;
}

@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  @Post('messages')
  @HttpCode(HttpStatus.ACCEPTED)
  async receiveMessage(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WebhookMessageResponse> {
    const parsed = WebhookMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'ValidationError',
        message: formatWebhookValidationErrors(parsed.error),
      });
    }

    const clinicId =
      parsed.data.clinic_id ??
      this.configService.get<string>('DEFAULT_CLINIC_ID') ??
      undefined;

    if (!clinicId) {
      throw new BadRequestException({
        error: 'ValidationError',
        message: 'clinic_id is required (request body or DEFAULT_CLINIC_ID env)',
      });
    }

    const result = (await this.commandBus.execute(
      new ProcessIncomingMessageCommand(
        parsed.data.message_id,
        parsed.data.from,
        parsed.data.text,
        new Date(parsed.data.timestamp),
        clinicId,
      ),
    )) as ProcessIncomingMessageResult;

    if (result.duplicate) {
      this.logger.info('Duplicate message received', {
        context: 'WebhookController',
        messageId: parsed.data.message_id,
        conversationId: result.conversationId,
        duplicate: true,
      });
      res.status(HttpStatus.OK);
      return { status: 'duplicate', conversationId: result.conversationId };
    }

    this.logger.info('Message accepted', {
      context: 'WebhookController',
      messageId: parsed.data.message_id,
      clinicId,
    });
    res.status(HttpStatus.ACCEPTED);
    return { status: 'accepted', conversationId: result.conversationId };
  }
}
