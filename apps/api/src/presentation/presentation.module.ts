import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConversationsController } from './controllers/conversations.controller';
import { SimulatorController } from './controllers/simulator.controller';
import { WebhookController } from './controllers/webhook.controller';

@Module({
  imports: [CqrsModule],
  controllers: [WebhookController, ConversationsController, SimulatorController],
})
export class PresentationModule {}
