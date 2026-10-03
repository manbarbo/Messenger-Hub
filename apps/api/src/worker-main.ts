import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './application/worker/worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  console.info('MessengerHub worker started (queue: message-processing)');
}

void bootstrap();
