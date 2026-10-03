import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { CqrsModule } from '@nestjs/cqrs';
import { ConversationsController } from './controllers/conversations.controller';
import { SimulatorController } from './controllers/simulator.controller';
import { WebhookController } from './controllers/webhook.controller';
import { PresentationModule } from './presentation.module';

describe('PresentationModule', () => {
  it('registers WebhookController, ConversationsController, and SimulatorController', () => {
    const controllers = Reflect.getMetadata('controllers', PresentationModule) as unknown[] | undefined;
    expect(controllers ?? []).toContain(WebhookController);
    expect(controllers ?? []).toContain(ConversationsController);
    expect(controllers ?? []).toContain(SimulatorController);
  });

  it('imports CqrsModule so CommandBus and QueryBus are available to controllers', () => {
    const imports = Reflect.getMetadata('imports', PresentationModule) as unknown[] | undefined;
    expect(imports ?? []).toContain(CqrsModule);
  });
});
