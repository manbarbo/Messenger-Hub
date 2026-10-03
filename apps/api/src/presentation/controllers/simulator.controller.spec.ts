import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import request from 'supertest';
import { SimulatorController } from './simulator.controller';
import { ProcessIncomingMessageCommand } from '@application/commands/process-incoming-message/process-incoming-message.command';
import type { ProcessIncomingMessageResult } from '@application/commands/process-incoming-message/process-incoming-message.handler';
import { LOGGER } from '@domain/services';

const validBody = {
  from: '+573009998877',
  text: '¿Qué horarios tienen para exámenes de sangre?',
};

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function createConfigService(values: Record<string, string> = {}): ConfigService {
  return {
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      (values[key] as T | undefined) ?? defaultValue,
  } as unknown as ConfigService;
}

describe('SimulatorController', () => {
  let commandBus: { execute: ReturnType<typeof vi.fn> };
  let app: INestApplication;

  async function createApp(configValues: Record<string, string> = {}): Promise<INestApplication> {
    commandBus = { execute: vi.fn() };
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [SimulatorController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: ConfigService, useValue: createConfigService(configValues) },
        { provide: LOGGER, useValue: mockLogger },
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

  it('returns 202 Accepted with generated messageId and conversationId', async () => {
    await createApp({ DEFAULT_CLINIC_ID: 'clinic-env-1' });
    commandBus.execute.mockResolvedValue({
      conversationId: 'conv-1',
      duplicate: false,
    } satisfies ProcessIncomingMessageResult);

    const response = await request(app.getHttpServer())
      .post('/api/simulator')
      .send(validBody)
      .expect(HttpStatus.ACCEPTED);

    expect(response.body.status).toBe('accepted');
    expect(response.body.conversationId).toBe('conv-1');
    expect(response.body.messageId).toMatch(/^wamid\.sim\./);

    const command = commandBus.execute.mock.calls[0][0] as ProcessIncomingMessageCommand;
    expect(command).toBeInstanceOf(ProcessIncomingMessageCommand);
    expect(command.messageId).toBe(response.body.messageId);
    expect(command.from).toBe(validBody.from);
    expect(command.text).toBe(validBody.text);
    expect(command.clinicId).toBe('clinic-env-1');
    expect(command.timestamp).toBeInstanceOf(Date);
  });

  it('uses clinicId from the request body when provided', async () => {
    await createApp({ DEFAULT_CLINIC_ID: 'clinic-env-1' });
    commandBus.execute.mockResolvedValue({
      conversationId: 'conv-2',
      duplicate: false,
    } satisfies ProcessIncomingMessageResult);

    await request(app.getHttpServer())
      .post('/api/simulator')
      .send({ ...validBody, clinicId: 'clinic-body-1' })
      .expect(HttpStatus.ACCEPTED);

    const command = commandBus.execute.mock.calls[0][0] as ProcessIncomingMessageCommand;
    expect(command.clinicId).toBe('clinic-body-1');
  });

  it('returns 400 when clinicId is missing from body and env', async () => {
    await createApp({});

    const response = await request(app.getHttpServer())
      .post('/api/simulator')
      .send(validBody)
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body.error).toBe('ValidationError');
    expect(response.body.message).toContain('clinicId');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid request body', async () => {
    await createApp({ DEFAULT_CLINIC_ID: 'clinic-env-1' });

    const response = await request(app.getHttpServer())
      .post('/api/simulator')
      .send({ text: 'hola' })
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body.error).toBe('ValidationError');
    expect(response.body.message).toContain('from');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when text is blank', async () => {
    await createApp({ DEFAULT_CLINIC_ID: 'clinic-env-1' });

    const response = await request(app.getHttpServer())
      .post('/api/simulator')
      .send({ ...validBody, text: '   ' })
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body.error).toBe('ValidationError');
    expect(response.body.message).toContain('text');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
