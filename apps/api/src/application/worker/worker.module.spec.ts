import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ApplicationModule } from '../application.module';
import { MessageProcessorService } from './message-processor.service';
import { WorkerModule } from './worker.module';

describe('WorkerModule', () => {
  it('registers MessageProcessorService as a provider', () => {
    const providers = Reflect.getMetadata('providers', WorkerModule) as unknown[] | undefined;
    expect(providers ?? []).toContain(MessageProcessorService);
  });

  it('imports ApplicationModule so CQRS booking commands resolve in the worker process', () => {
    const imports = Reflect.getMetadata('imports', WorkerModule) as unknown[] | undefined;
    expect(imports ?? []).toContain(ApplicationModule);
  });
});
