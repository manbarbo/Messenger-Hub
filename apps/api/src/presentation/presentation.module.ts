import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { APP_FILTER } from '@nestjs/core';
import { DomainExceptionFilter } from './filters/domain-exception.filter';
import { ConversationsController } from './controllers/conversations.controller';
import { SimulatorController } from './controllers/simulator.controller';
import { WebhookController } from './controllers/webhook.controller';

@Module({
  imports: [CqrsModule],
  controllers: [WebhookController, ConversationsController, SimulatorController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
  ],
})
export class PresentationModule {}
