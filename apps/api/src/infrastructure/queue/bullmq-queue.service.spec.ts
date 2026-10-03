import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { QueueJob } from '@domain/value-objects/queue-job.vo';
import {
  BullMQQueueService,
  MESSAGE_PROCESSING_DLQ,
  MESSAGE_PROCESSING_QUEUE,
  PROCESS_MESSAGE_JOB,
} from './bullmq-queue.service';

const { addMock, closeMock, queueConstructorMock } = vi.hoisted(() => ({
  addMock: vi.fn(),
  closeMock: vi.fn(),
  queueConstructorMock: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: class MockQueue {
    readonly name: string;
    readonly add: (jobName: string, data: unknown) => Promise<void>;
    readonly close: () => Promise<void>;

    constructor(name: string, _opts: unknown) {
      this.name = name;
      queueConstructorMock(name, _opts);
      this.add = async (jobName: string, data: unknown) => {
        await addMock(name, jobName, data);
      };
      this.close = async () => {
        closeMock(name);
      };
    }
  },
}));

function createConfigService(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    ...overrides,
  };

  return {
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      (values[key] as T | undefined) ?? defaultValue,
  } as unknown as ConfigService;
}

function sampleJob(overrides: Partial<QueueJob> = {}): QueueJob {
  return {
    conversationId: 'conv-1',
    messageId: 'm1',
    from: '+573001112233',
    text: 'hola',
    clinicId: 'clinic-1',
    ...overrides,
  };
}

describe('BullMQQueueService', () => {
  beforeEach(() => {
    addMock.mockReset();
    closeMock.mockReset();
    queueConstructorMock.mockReset();
  });

  it('configures main and DLQ queues from Redis env vars', () => {
    new BullMQQueueService(createConfigService({ REDIS_HOST: 'redis', REDIS_PORT: '6380' }));

    expect(queueConstructorMock).toHaveBeenCalledWith(
      MESSAGE_PROCESSING_QUEUE,
      expect.objectContaining({
        connection: { host: 'redis', port: 6380 },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
    );
    expect(queueConstructorMock).toHaveBeenCalledWith(
      MESSAGE_PROCESSING_DLQ,
      expect.objectContaining({
        connection: { host: 'redis', port: 6380 },
      }),
    );
  });

  it('falls back to localhost:6379 when Redis env vars are missing', () => {
    new BullMQQueueService(createConfigService({ REDIS_HOST: '', REDIS_PORT: '' }));

    expect(queueConstructorMock).toHaveBeenCalledWith(
      MESSAGE_PROCESSING_QUEUE,
      expect.objectContaining({
        connection: { host: 'localhost', port: 6379 },
      }),
    );
  });

  it('push() adds a process-message job to the main queue with full payload', async () => {
    const service = new BullMQQueueService(createConfigService());
    const job = sampleJob();

    await service.push(job);

    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith(MESSAGE_PROCESSING_QUEUE, PROCESS_MESSAGE_JOB, job);
  });

  it('pushToDlq() adds a process-message job to the dead letter queue', async () => {
    const service = new BullMQQueueService(createConfigService());
    const job = sampleJob({ messageId: 'failed-1' });

    await service.pushToDlq(job);

    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith(MESSAGE_PROCESSING_DLQ, PROCESS_MESSAGE_JOB, job);
  });

  it('propagates queue failures from push()', async () => {
    addMock.mockRejectedValueOnce(new Error('redis down'));
    const service = new BullMQQueueService(createConfigService());

    await expect(service.push(sampleJob())).rejects.toThrow('redis down');
  });

  it('closes both queues on module destroy', async () => {
    const service = new BullMQQueueService(createConfigService());

    await service.onModuleDestroy();

    expect(closeMock).toHaveBeenCalledWith(MESSAGE_PROCESSING_QUEUE);
    expect(closeMock).toHaveBeenCalledWith(MESSAGE_PROCESSING_DLQ);
  });
});
