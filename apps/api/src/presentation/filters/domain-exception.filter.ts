import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Inject } from '@nestjs/common';
import {
  AppointmentNotFoundError,
  ClinicNotFoundError,
  ConversationNotFoundError,
  KnowledgeDocumentNotFoundError,
  LLMIterationLimitError,
  LLMProviderError,
  PastDateError,
  SlotAlreadyBookedError,
  SlotNotFoundError,
  ValidationError,
} from '@domain/errors';
import { LOGGER, type Logger } from '@domain/services';

export interface ErrorResponse {
  readonly error: string;
  readonly message: string;
}

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): unknown;
}

function isDomainError(exception: unknown): exception is Error {
  return (
    exception instanceof SlotAlreadyBookedError ||
    exception instanceof SlotNotFoundError ||
    exception instanceof ClinicNotFoundError ||
    exception instanceof ConversationNotFoundError ||
    exception instanceof AppointmentNotFoundError ||
    exception instanceof KnowledgeDocumentNotFoundError ||
    exception instanceof PastDateError ||
    exception instanceof ValidationError ||
    exception instanceof LLMProviderError ||
    exception instanceof LLMIterationLimitError
  );
}

function statusForDomainError(exception: Error): number {
  if (exception instanceof SlotAlreadyBookedError) return 409;
  if (exception instanceof SlotNotFoundError) return 404;
  if (exception instanceof ClinicNotFoundError) return 404;
  if (exception instanceof ConversationNotFoundError) return 404;
  if (exception instanceof AppointmentNotFoundError) return 404;
  if (exception instanceof KnowledgeDocumentNotFoundError) return 404;
  if (exception instanceof PastDateError) return 400;
  if (exception instanceof ValidationError) return 400;
  if (exception instanceof LLMProviderError) return 502;
  if (exception instanceof LLMIterationLimitError) return 500;
  return 500;
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        response.status(status).json({
          error: exception.name,
          message: body,
        } satisfies ErrorResponse);
        return;
      }

      if (typeof body === 'object' && body !== null) {
        const record = body as Record<string, unknown>;
        const message =
          typeof record.message === 'string' ? record.message : exception.message;
        const error =
          typeof record.error === 'string' && record.error !== message
            ? record.error
            : exception.name;

        response.status(status).json({ error, message } satisfies ErrorResponse);
        return;
      }

      response.status(status).json({
        error: exception.name,
        message: exception.message,
      } satisfies ErrorResponse);
      return;
    }

    if (isDomainError(exception)) {
      const statusCode = statusForDomainError(exception);

      if (statusCode >= 400 && statusCode < 500) {
        this.logger.warn('Domain error handled', {
          context: 'DomainExceptionFilter',
          errorName: exception.name,
          statusCode,
        });
      }

      response.status(statusCode).json({
        error: exception.name,
        message: exception.message,
      } satisfies ErrorResponse);
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.message : String(exception),
      {
        context: 'DomainExceptionFilter',
        stack: exception instanceof Error ? exception.stack : undefined,
        exceptionName: exception instanceof Error ? exception.name : typeof exception,
      },
    );
    response.status(500).json({
      error: 'InternalServerError',
      message: 'Internal server error',
    } satisfies ErrorResponse);
  }
}
