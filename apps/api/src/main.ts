import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LOGGER } from '@domain/services';
import { LoggingInterceptor } from './presentation/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    credentials: true,
  });
  app.useGlobalInterceptors(new LoggingInterceptor(app.get(LOGGER)));
  app.enableShutdownHooks();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.info(`API listening on http://localhost:${port}`);
}
void bootstrap();
