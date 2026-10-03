import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, type JobsOptions } from 'bullmq';
import type { QueueJob } from '@domain/value-objects/queue-job.vo';
import type { QueueService } from '@domain/services/queue.service';

export const MESSAGE_PROCESSING_QUEUE = 'message-processing';
export const MESSAGE_PROCESSING_DLQ = 'message-processing-dlq';
export const PROCESS_MESSAGE_JOB = 'process-message';

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

@Injectable()
export class BullMQQueueService implements QueueService, OnModuleDestroy {
  private readonly logger = new Logger(BullMQQueueService.name);
  private readonly queue: Queue;
  private readonly dlq: Queue;

  constructor(private readonly configService: ConfigService) {
    const connection = {
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: Number(this.configService.get<string | number>('REDIS_PORT') || 6379),
    };

    this.queue = new Queue(MESSAGE_PROCESSING_QUEUE, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    this.dlq = new Queue(MESSAGE_PROCESSING_DLQ, { connection });
  }

  async push(job: QueueJob): Promise<void> {
    await this.queue.add(PROCESS_MESSAGE_JOB, job);
  }

  async pushToDlq(job: QueueJob): Promise<void> {
    await this.dlq.add(PROCESS_MESSAGE_JOB, job);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.queue.close(), this.dlq.close()]);
    this.logger.log('BullMQ queues closed');
  }
}
