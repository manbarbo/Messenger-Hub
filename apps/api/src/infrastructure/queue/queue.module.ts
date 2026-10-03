import { Global, Module } from '@nestjs/common';
import { QUEUE_SERVICE } from '@domain/services';
import { BullBoardService } from './bull-board.service';
import { BullMQQueueService } from './bullmq-queue.service';

@Global()
@Module({
  providers: [
    BullMQQueueService,
    BullBoardService,
    { provide: QUEUE_SERVICE, useExisting: BullMQQueueService },
  ],
  exports: [BullMQQueueService, BullBoardService, QUEUE_SERVICE],
})
export class QueueModule {}
