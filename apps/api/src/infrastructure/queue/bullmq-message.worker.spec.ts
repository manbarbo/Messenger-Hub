import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { MessageProcessorService } from '@application/worker/message-processor.service';
import type { Logger } from '@domain/services';
import type { QueueJob } from '@domain/value-objects/queue-job.vo';
import { BullMQQueueService, MESSAGE_PROCESSING_QUEUE } from './bullmq-queue.service';
import { BullMQMessageWorker } from './bullmq-message.worker';

const { workerInstances, workerConstructorMock } = vi.hoisted(() => ({
  workerInstances: [] as Array<{
    queueName: string;
    processor: (job: { data: QueueJob; opts: { attempts?: number }; attemptsMade: number }) => Promise<void>;
    opts: unknown;
    on: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }>,
  workerConstructorMock: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Worker: class MockWorker {
    readonly on: ReturnType<typeof vi.fn>;
    readonly close: ReturnType<typeof vi.fn>;
    readonly queueName: string;
    readonly processor: (job: unknown) => Promise<void>;

    constructor(
      queueName: string,
      processor: (job: unknown) => Promise<void>,
      opts: unknown,
    ) {
      this.queueName = queueName;
      this.processor = processor;
      this.on = vi.fn();
      this.close = vi.fn().mockResolvedValue(undefined);
      workerConstructorMock(queueName, processor, opts);
      workerInstances.push(this as unknown as (typeof workerInstances)[number]);
    }
  },
}));

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createConfigService(): ConfigService {
  const values: Record<string, string> = {
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
  };
  return {
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      (values[key] as T | undefined) ?? defaultValue,
  } as unknown as ConfigService;
}

function getFailedHandler(instance: (typeof workerInstances)[number]): (job: unknown, error?: Error) => void {
  const failedCall = instance.on.mock.calls.find(([event]) => event === 'failed');
  return failedCall?.[1] as (job: unknown, error?: Error) => void;
}

describe('BullMQMessageWorker', () => {
  let messageProcessor: { process: ReturnType<typeof vi.fn> };
  let queueService: { pushToDlq: ReturnType<typeof vi.fn> };
  let logger: Logger;

  beforeEach(() => {
    workerInstances.length = 0;
    workerConstructorMock.mockReset();
    messageProcessor = { process: vi.fn().mockResolvedValue(undefined) };
    queueService = { pushToDlq: vi.fn().mockResolvedValue(undefined) };
    logger = createMockLogger();
  });

  function createWorker(): BullMQMessageWorker {
    return new BullMQMessageWorker(
      logger,
      createConfigService(),
      messageProcessor as unknown as MessageProcessorService,
      queueService as unknown as BullMQQueueService,
    );
  }

  it('starts a BullMQ worker on the message-processing queue', async () => {
    const worker = createWorker();
    await worker.onModuleInit();

    expect(workerConstructorMock).toHaveBeenCalledTimes(1);
    expect(workerInstances[0].queueName).toBe(MESSAGE_PROCESSING_QUEUE);
  });

  it('delegates job payloads to MessageProcessorService', async () => {
    const worker = createWorker();
    await worker.onModuleInit();

    const job: QueueJob = {
      conversationId: 'conv-1',
      messageId: 'wamid.001',
      from: '+573001112233',
      text: 'hola',
      clinicId: 'clinic-1',
    };

    await workerInstances[0].processor({ data: job, opts: { attempts: 3 }, attemptsMade: 0 });

    expect(messageProcessor.process).toHaveBeenCalledWith(job);
  });

  it('does not push to DLQ on intermediate failures (retries remain)', async () => {
    const worker = createWorker();
    await worker.onModuleInit();

    const failed = getFailedHandler(workerInstances[0]);
    failed({ id: 'job-1', data: { messageId: 'm1' }, opts: { attempts: 3 }, attemptsMade: 1 }, new Error('boom'));

    expect(queueService.pushToDlq).not.toHaveBeenCalled();
  });

  it('pushes job data to the DLQ after the final failed attempt', async () => {
    const worker = createWorker();
    await worker.onModuleInit();

    const data: QueueJob = {
      conversationId: 'conv-1',
      messageId: 'wamid.001',
      from: '+573001112233',
      text: 'hola',
      clinicId: 'clinic-1',
    };
    const failed = getFailedHandler(workerInstances[0]);
    failed({ id: 'job-1', data, opts: { attempts: 3 }, attemptsMade: 3 }, new Error('final boom'));

    expect(queueService.pushToDlq).toHaveBeenCalledWith(data);
  });

  it('closes the BullMQ worker on module destroy', async () => {
    const worker = createWorker();
    await worker.onModuleInit();
    await worker.onModuleDestroy();

    expect(workerInstances[0].close).toHaveBeenCalled();
  });

  it('handles missing failed jobs without throwing', async () => {
    const worker = createWorker();
    await worker.onModuleInit();

    const failed = getFailedHandler(workerInstances[0]);
    expect(() => failed(null, new Error('no job'))).not.toThrow();
    expect(queueService.pushToDlq).not.toHaveBeenCalled();
  });

  it('uses DEFAULT_MAX_ATTEMPTS when job options omit attempts', async () => {
    const worker = createWorker();
    await worker.onModuleInit();

    const data: QueueJob = {
      conversationId: 'conv-1',
      messageId: 'wamid.002',
      from: '+573001112233',
      text: 'hola',
      clinicId: 'clinic-1',
    };
    const failed = getFailedHandler(workerInstances[0]);
    failed({ id: 'job-2', data, opts: {}, attemptsMade: 3 }, new Error('default attempts'));

    expect(queueService.pushToDlq).toHaveBeenCalledWith(data);
  });

  it('logs DLQ push failures without throwing', async () => {
    queueService.pushToDlq.mockRejectedValue(new Error('dlq down'));
    const worker = createWorker();
    await worker.onModuleInit();

    const failed = getFailedHandler(workerInstances[0]);
    failed(
      {
        id: 'job-3',
        data: { messageId: 'm3' },
        opts: { attempts: 1 },
        attemptsMade: 1,
      },
      new Error('boom'),
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(queueService.pushToDlq).toHaveBeenCalled();
    expect(logger.error).toHaveBeenNthCalledWith(2, 'Failed to push job to DLQ', {
      context: 'BullMQMessageWorker',
      jobId: 'job-3',
      error: expect.stringContaining('dlq down'),
    });
  });

  it('logs completed jobs', async () => {
    const worker = createWorker();
    await worker.onModuleInit();

    const completedCall = workerInstances[0].on.mock.calls.find(([event]) => event === 'completed');
    expect(completedCall).toBeDefined();
    completedCall?.[1]({ id: 'job-done' });

    expect(logger.debug).toHaveBeenCalledWith('Job completed', {
      context: 'BullMQMessageWorker',
      jobId: 'job-done',
    });
  });
});
