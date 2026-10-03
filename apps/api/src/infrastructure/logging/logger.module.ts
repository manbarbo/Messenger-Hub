import { Global, Module } from '@nestjs/common';
import { LOGGER } from '@domain/services';
import { WinstonLoggerService } from './winston/winston-logger.service';

@Global()
@Module({
  providers: [
    WinstonLoggerService,
    { provide: LOGGER, useExisting: WinstonLoggerService },
  ],
  exports: [LOGGER, WinstonLoggerService],
})
export class LoggerModule {}