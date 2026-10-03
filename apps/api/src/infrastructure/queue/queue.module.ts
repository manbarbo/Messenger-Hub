import { Global, Module } from '@nestjs/common';
import { QUEUE_SERVICE } from '@domain/services';
import { BullMQQueueService } from './bullmq-queue.service';

@Global()
@Module({
  providers: [
    BullMQQueueService,
    { provide: QUEUE_SERVICE, useExisting: BullMQQueueService },
  ],
  exports: [BullMQQueueService, QUEUE_SERVICE],
})
export class QueueModule {}
