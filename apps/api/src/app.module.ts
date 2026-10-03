import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AIModule } from './application/llm/ai.module';
import { ApplicationModule } from './application/application.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { EmbeddingModule } from './infrastructure/embeddings/embedding.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { LlmModule } from './infrastructure/llm/llm.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { PresentationModule } from './presentation/presentation.module';

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
    AIModule,
    ApplicationModule,
    PresentationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
