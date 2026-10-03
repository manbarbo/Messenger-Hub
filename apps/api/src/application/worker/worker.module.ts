import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { EmbeddingModule } from '@infrastructure/embeddings/embedding.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { LlmModule } from '@infrastructure/llm/llm.module';
import { QueueModule } from '@infrastructure/queue/queue.module';
import { BullMQMessageWorker } from '@infrastructure/queue/bullmq-message.worker';
import { ApplicationModule } from '../application.module';
import { AIModule } from '../llm/ai.module';
import { MessageProcessorService } from './message-processor.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    EmbeddingModule,
    LlmModule,
    QueueModule,
    InfrastructureModule,
    CqrsModule,
    AIModule,
    ApplicationModule,
  ],
  providers: [MessageProcessorService, BullMQMessageWorker],
  exports: [MessageProcessorService],
})
export class WorkerModule {}
