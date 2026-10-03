import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LOGGER } from '@domain/services';
import { LoggerModule } from './logger.module';
import { WinstonLoggerService } from './winston/winston-logger.service';

const mockConfigService = {
  get: (key: string) => (key === 'NODE_ENV' ? 'development' : undefined),
};

describe('LoggerModule', () => {
  async function createTestModule() {
    return Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), LoggerModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();
  }

  it('exports LOGGER token resolving to WinstonLoggerService', async () => {
    const moduleRef = await createTestModule();
    const logger = moduleRef.get(LOGGER);
    expect(logger).toBeInstanceOf(WinstonLoggerService);
  });

  it('exports WinstonLoggerService directly', async () => {
    const moduleRef = await createTestModule();
    const service = moduleRef.get(WinstonLoggerService);
    expect(service).toBeInstanceOf(WinstonLoggerService);
  });

  it('LOGGER and WinstonLoggerService are the same instance', async () => {
    const moduleRef = await createTestModule();
    expect(moduleRef.get(LOGGER)).toBe(moduleRef.get(WinstonLoggerService));
  });

  it('is marked @Global', () => {
    expect(Reflect.getMetadata('__module:global__', LoggerModule)).toBe(true);
  });
});