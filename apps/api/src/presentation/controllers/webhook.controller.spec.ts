import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import request from 'supertest';
import { WebhookController } from './webhook.controller';
import { ProcessIncomingMessageCommand } from '@application/commands/process-incoming-message/process-incoming-message.command';
import type { ProcessIncomingMessageResult } from '@application/commands/process-incoming-message/process-incoming-message.handler';

const validBody = {
  message_id: 'wamid.001',
  from: '+573001112233',
  text: 'Hola, quiero una cita',
  timestamp: '2026-10-06T03:40:00Z',
};

function createConfigService(values: Record<string, string> = {}): ConfigService {
  return {
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      (values[key] as T | undefined) ?? defaultValue,
  } as unknown as ConfigService;
}

describe('WebhookController', () => {
  let commandBus: { execute: ReturnType<typeof vi.fn> };
  let app: INestApplication;

  async function createApp(configValues: Record<string, string> = {}): Promise<INestApplication> {
    commandBus = { execute: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: ConfigService, useValue: createConfigService(configValues) },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    return app;
  }

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 202 Accepted for a new message and enqueues via command bus', async () => {
    await createApp({ DEFAULT_CLINIC_ID: 'clinic-env-1' });
    commandBus.execute.mockResolvedValue({
      conversationId: 'conv-1',
      duplicate: false,
    } satisfies ProcessIncomingMessageResult);

    const response = await request(app.getHttpServer())
      .post('/webhooks/messages')
      .send(validBody)
      .expect(HttpStatus.ACCEPTED);

    expect(response.body).toEqual({
      status: 'accepted',
      conversationId: 'conv-1',
    });

    const command = commandBus.execute.mock.calls[0][0] as ProcessIncomingMessageCommand;
    expect(command).toBeInstanceOf(ProcessIncomingMessageCommand);
    expect(command.messageId).toBe('wamid.001');
    expect(command.from).toBe('+573001112233');
    expect(command.text).toBe('Hola, quiero una cita');
    expect(command.timestamp.toISOString()).toBe('2026-10-06T03:40:00.000Z');
    expect(command.clinicId).toBe('clinic-env-1');
  });

  it('returns 200 OK with duplicate status when message_id already exists', async () => {
    await createApp({ DEFAULT_CLINIC_ID: 'clinic-env-1' });
    commandBus.execute.mockResolvedValue({
      conversationId: 'conv-existing',
      duplicate: true,
    } satisfies ProcessIncomingMessageResult);

    const response = await request(app.getHttpServer())
      .post('/webhooks/messages')
      .send(validBody)
      .expect(HttpStatus.OK);

    expect(response.body).toEqual({
      status: 'duplicate',
      conversationId: 'conv-existing',
    });
  });

  it('uses clinic_id from the request body when provided', async () => {
    await createApp({ DEFAULT_CLINIC_ID: 'clinic-env-1' });
    commandBus.execute.mockResolvedValue({
      conversationId: 'conv-2',
      duplicate: false,
    } satisfies ProcessIncomingMessageResult);

    await request(app.getHttpServer())
      .post('/webhooks/messages')
      .send({ ...validBody, clinic_id: 'clinic-body-1' })
      .expect(HttpStatus.ACCEPTED);

    const command = commandBus.execute.mock.calls[0][0] as ProcessIncomingMessageCommand;
    expect(command.clinicId).toBe('clinic-body-1');
  });

  it('returns 400 for an invalid request body', async () => {
    await createApp({ DEFAULT_CLINIC_ID: 'clinic-env-1' });

    const response = await request(app.getHttpServer())
      .post('/webhooks/messages')
      .send({ from: '+57300', text: 'hola' })
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body.error).toBe('ValidationError');
    expect(response.body.message).toContain('message_id');
    expect(response.body.message).toContain('timestamp');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when timestamp is not a valid date', async () => {
    await createApp({ DEFAULT_CLINIC_ID: 'clinic-env-1' });

    const response = await request(app.getHttpServer())
      .post('/webhooks/messages')
      .send({ ...validBody, timestamp: 'not-a-date' })
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body.error).toBe('ValidationError');
    expect(response.body.message).toContain('timestamp');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when clinic_id is missing from body and env', async () => {
    await createApp({});

    const response = await request(app.getHttpServer())
      .post('/webhooks/messages')
      .send(validBody)
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body.error).toBe('ValidationError');
    expect(response.body.message).toContain('clinic_id');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
