import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import type { Logger, LogMetadata } from '@domain/services';
import { createWinstonConfig } from './winston.config';

@Injectable()
export class WinstonLoggerService implements LoggerService, Logger {
  private readonly logger: winston.Logger;

  constructor(private readonly configService: ConfigService) {
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    this.logger = winston.createLogger(createWinstonConfig(isProduction));
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.logger.debug(message, metadata);
  }

  info(message: string, metadata?: LogMetadata): void {
    this.logger.info(message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.logger.warn(message, metadata);
  }

  error(message: string, metadata?: LogMetadata): void {
    this.logger.error(message, metadata);
  }

  log(message: string, context?: string): void {
    this.info(message, context ? { context } : undefined);
  }

  fatal(message: string, context?: string): void {
    this.error(message, context ? { context } : undefined);
  }
}