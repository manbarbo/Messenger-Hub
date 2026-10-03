import { NestFactory } from '@nestjs/core';
import { LOGGER } from '@domain/services';
import { WorkerModule } from './application/worker/worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  const logger = app.get(LOGGER);
  logger.info('MessengerHub worker started', { context: 'Worker', queue: 'message-processing' });
}

void bootstrap();
