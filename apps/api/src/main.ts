import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LOGGER } from '@domain/services';
import { LoggingInterceptor } from './presentation/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = app.get(LOGGER);
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    credentials: true,
  });
  app.useGlobalInterceptors(new LoggingInterceptor(logger));
  app.enableShutdownHooks();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.info(`API listening on http://localhost:${port}`, {
    context: 'Main',
    port,
  });
}
void bootstrap();
