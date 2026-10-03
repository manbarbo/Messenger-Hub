import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { CqrsModule } from '@nestjs/cqrs';
import { WebhookController } from './controllers/webhook.controller';
import { PresentationModule } from './presentation.module';

describe('PresentationModule', () => {
  it('registers WebhookController', () => {
    const controllers = Reflect.getMetadata('controllers', PresentationModule) as unknown[] | undefined;
    expect(controllers ?? []).toContain(WebhookController);
  });

  it('imports CqrsModule so CommandBus is available to controllers', () => {
    const imports = Reflect.getMetadata('imports', PresentationModule) as unknown[] | undefined;
    expect(imports ?? []).toContain(CqrsModule);
  });
});
