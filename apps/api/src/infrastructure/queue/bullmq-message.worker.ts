import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import type { QueueJob } from '@domain/value-objects/queue-job.vo';
import { MessageProcessorService } from '@application/worker/message-processor.service';
import {
  MESSAGE_PROCESSING_QUEUE,
  BullMQQueueService,
} from './bullmq-queue.service';

const DEFAULT_MAX_ATTEMPTS = 3;

@Injectable()
export class BullMQMessageWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullMQMessageWorker.name);
  private worker?: Worker;

  constructor(
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
        this.logger.warn(
          `Job ${job.id} attempt ${job.attemptsMade}/${maxAttempts} failed: ${error?.message ?? 'unknown'}`,
        );
        return;
      }

      this.logger.error(
        `Job ${job.id} exhausted ${maxAttempts} attempts, moving to DLQ: ${error?.message ?? 'unknown'}`,
      );
      void this.queueService.pushToDlq(job.data).catch((dlqError) => {
        this.logger.error(`Failed to push job ${job.id} to DLQ: ${String(dlqError)}`);
      });
    });

    this.worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed`);
    });

    this.logger.log(`Worker listening on queue "${MESSAGE_PROCESSING_QUEUE}"`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('BullMQ worker closed');
    }
  }
}
