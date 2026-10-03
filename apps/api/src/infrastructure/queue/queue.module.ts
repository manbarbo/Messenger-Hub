import { Global, Module } from '@nestjs/common';
import { QUEUE_SERVICE } from '@domain/services';
import { BullMQQueueService } from './bullmq-queue.service';

@Global()
@Module({
  providers: [{ provide: QUEUE_SERVICE, useClass: BullMQQueueService }],
  exports: [QUEUE_SERVICE],
})
export class QueueModule {}
