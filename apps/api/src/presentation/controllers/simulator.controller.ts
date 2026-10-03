import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { ProcessIncomingMessageCommand } from '@application/commands/process-incoming-message/process-incoming-message.command';
import type { ProcessIncomingMessageResult } from '@application/commands/process-incoming-message/process-incoming-message.handler';
import {
  formatZodErrors,
  SimulatorMessageSchema,
} from '../dto/simulator.schema';

export interface SimulatorMessageResponse {
  readonly status: 'accepted';
  readonly messageId: string;
  readonly conversationId: string;
}

@Controller('api/simulator')
export class SimulatorController {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async sendMessage(@Body() body: unknown): Promise<SimulatorMessageResponse> {
    const parsed = SimulatorMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'ValidationError',
        message: formatZodErrors(parsed.error),
      });
    }

    const clinicId =
      parsed.data.clinicId ??
      this.configService.get<string>('DEFAULT_CLINIC_ID') ??
      undefined;

    if (!clinicId) {
      throw new BadRequestException({
        error: 'ValidationError',
        message: 'clinicId is required (request body or DEFAULT_CLINIC_ID env)',
      });
    }

    const messageId = `wamid.sim.${randomUUID()}`;

    const result = (await this.commandBus.execute(
      new ProcessIncomingMessageCommand(
        messageId,
        parsed.data.from,
        parsed.data.text,
        new Date(),
        clinicId,
      ),
    )) as ProcessIncomingMessageResult;

    return {
      status: 'accepted',
      messageId,
      conversationId: result.conversationId,
    };
  }
}
