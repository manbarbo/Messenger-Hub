import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggerService } from './logger.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);

  handleError(error: Error): void {
    this.logger.error('Unhandled Angular error', 'GlobalErrorHandler', {
      message: error.message,
      stack: error.stack,
    });
  }
}