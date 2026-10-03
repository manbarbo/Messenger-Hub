import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import type { QueueJob } from '@domain/value-objects/queue-job.vo';
import { MessageProcessorService } from '@application/worker/message-processor.service';
import { LOGGER, type Logger } from '@domain/services';
import {
  MESSAGE_PROCESSING_QUEUE,
  BullMQQueueService,
} from './bullmq-queue.service';

const DEFAULT_MAX_ATTEMPTS = 3;

@Injectable()
export class BullMQMessageWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly messageProcessor: MessageProcessorService,
    @Inject(BullMQQueueService) private readonly queueService: BullMQQueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = {
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: Number(this.configService.get<string | number>('REDIS_PORT') || 6379),
    };

    this.worker = new Worker<QueueJob>(
      MESSAGE_PROCESSING_QUEUE,
      async (job: Job<QueueJob>) => {
        await this.messageProcessor.process(job.data);
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      if (!job) {
        return;
      }

      const maxAttempts = job.opts.attempts ?? DEFAULT_MAX_ATTEMPTS;
      if (job.attemptsMade < maxAttempts) {
        this.logger.warn('Job attempt failed', {
          context: 'BullMQMessageWorker',
          jobId: job.id,
          attempt: job.attemptsMade,
          maxAttempts,
          error: error?.message ?? 'unknown',
        });
        return;
      }

      this.logger.error('Job exhausted attempts, moving to DLQ', {
        context: 'BullMQMessageWorker',
        jobId: job.id,
        maxAttempts,
        error: error?.message ?? 'unknown',
      });
      void this.queueService.pushToDlq(job.data).catch((dlqError) => {
        this.logger.error('Failed to push job to DLQ', {
          context: 'BullMQMessageWorker',
          jobId: job.id,
          error: String(dlqError),
        });
      });
    });

    this.worker.on('completed', (job) => {
      this.logger.debug('Job completed', {
        context: 'BullMQMessageWorker',
        jobId: job.id,
      });
    });

    this.logger.info('Worker listening on queue', {
      context: 'BullMQMessageWorker',
      queue: MESSAGE_PROCESSING_QUEUE,
      event: 'worker_started',
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.logger.info('BullMQ worker closed', {
        context: 'BullMQMessageWorker',
        event: 'worker_closed',
      });
    }
  }
}
