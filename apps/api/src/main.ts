import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { LOGGER } from '@domain/services';
import { BullBoardService } from './infrastructure/queue/bull-board.service';
import { LoggingInterceptor } from './presentation/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = app.get(LOGGER);
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    credentials: true,
  });
  app.useGlobalInterceptors(new LoggingInterceptor(logger));
  app.get(BullBoardService).mount(app);
  app.enableShutdownHooks();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.info(`API listening on http://localhost:${port}`, {
    context: 'Main',
    port,
  });
}
void bootstrap();
