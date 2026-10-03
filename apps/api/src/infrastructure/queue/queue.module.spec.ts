import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QUEUE_SERVICE } from '@domain/services';
import { BullMQQueueService } from './bullmq-queue.service';
import { QueueModule } from './queue.module';

const { queueConstructorMock } = vi.hoisted(() => ({
  queueConstructorMock: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: class MockQueue {
    readonly add = vi.fn();
    readonly close = vi.fn();

    constructor(name: string, opts: unknown) {
      queueConstructorMock(name, opts);
    }
  },
}));

const mockConfigService = {
  get: <T>(key: string, defaultValue?: T): T | undefined => {
    const values: Record<string, string> = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
    };
    return (values[key] as T | undefined) ?? defaultValue;
  },
};

@Global()
@Module({
  providers: [{ provide: ConfigService, useValue: mockConfigService }],
  exports: [ConfigService],
})
class MockConfigModule {}

describe('QueueModule', () => {
  beforeEach(() => {
    queueConstructorMock.mockReset();
  });

  it('binds QUEUE_SERVICE to BullMQQueueService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockConfigModule, QueueModule],
    }).compile();

    expect(moduleRef.get(QUEUE_SERVICE)).toBeInstanceOf(BullMQQueueService);
  });

  it('shares a single BullMQQueueService instance for QUEUE_SERVICE and class token', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockConfigModule, QueueModule],
    }).compile();

    expect(moduleRef.get(BullMQQueueService)).toBe(moduleRef.get(QUEUE_SERVICE));
  });

  it('exports BullMQQueueService for the worker DLQ adapter', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockConfigModule, QueueModule],
    }).compile();

    expect(moduleRef.get(BullMQQueueService, { strict: false })).toBeInstanceOf(
      BullMQQueueService,
    );
  });

  it('is marked @Global so application layers can inject QUEUE_SERVICE', () => {
    expect(Reflect.getMetadata('__module:global__', QueueModule)).toBe(true);
  });

  it('exports QUEUE_SERVICE for application layers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockConfigModule, QueueModule],
    }).compile();

    expect(moduleRef.get(QUEUE_SERVICE, { strict: false })).toBeInstanceOf(BullMQQueueService);
  });
});
