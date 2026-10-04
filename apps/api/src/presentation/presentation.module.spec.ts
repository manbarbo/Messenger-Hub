import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { CqrsModule } from '@nestjs/cqrs';
import { APP_FILTER } from '@nestjs/core';
import { ClinicsController } from './controllers/clinics.controller';
import { ConversationsController } from './controllers/conversations.controller';
import { SimulatorController } from './controllers/simulator.controller';
import { WebhookController } from './controllers/webhook.controller';
import { DomainExceptionFilter } from './filters/domain-exception.filter';
import { PresentationModule } from './presentation.module';

describe('PresentationModule', () => {
  it('registers WebhookController, ConversationsController, SimulatorController, and ClinicsController', () => {
    const controllers = Reflect.getMetadata('controllers', PresentationModule) as unknown[] | undefined;
    expect(controllers ?? []).toContain(WebhookController);
    expect(controllers ?? []).toContain(ConversationsController);
    expect(controllers ?? []).toContain(SimulatorController);
    expect(controllers ?? []).toContain(ClinicsController);
  });

  it('imports CqrsModule so CommandBus and QueryBus are available to controllers', () => {
    const imports = Reflect.getMetadata('imports', PresentationModule) as unknown[] | undefined;
    expect(imports ?? []).toContain(CqrsModule);
  });

  it('registers DomainExceptionFilter as a global APP_FILTER', () => {
    const providers = Reflect.getMetadata('providers', PresentationModule) as
      | Array<{ provide?: unknown; useClass?: unknown }>
      | undefined;

    const filterProvider = (providers ?? []).find(
      (provider) => provider.provide === APP_FILTER,
    );
    expect(filterProvider?.useClass).toBe(DomainExceptionFilter);
  });
});
