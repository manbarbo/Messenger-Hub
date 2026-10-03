import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { WebhookController } from './controllers/webhook.controller';

@Module({
  imports: [CqrsModule],
  controllers: [WebhookController],
})
export class PresentationModule {}
