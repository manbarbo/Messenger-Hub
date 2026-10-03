import { Inject, Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LOGGER, type Logger } from '@domain/services';
import { redactSensitive } from '../../infrastructure/logging/winston/winston.config';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, body } = request;
    const start = Date.now();

    this.logger.info('Incoming request', {
      context: 'HTTP',
      method,
      path: url,
      body: this.sanitizeBody(body),
    });

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.info('Response sent', {
            context: 'HTTP',
            method,
            path: url,
            statusCode: response.statusCode,
            duration: Date.now() - start,
          });
        },
        error: (error: Error) => {
          this.logger.error('Request failed', {
            context: 'HTTP',
            method,
            path: url,
            statusCode: response.statusCode || 500,
            duration: Date.now() - start,
            error: error.message,
            stack: error.stack,
          });
        },
      }),
    );
  }

  private sanitizeBody(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object') {
      return {};
    }
    return redactSensitive(body as Record<string, unknown>);
  }
}