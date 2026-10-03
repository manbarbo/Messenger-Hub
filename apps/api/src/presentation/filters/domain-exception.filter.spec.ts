import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Logger } from '@domain/services';
import { DomainExceptionFilter } from './domain-exception.filter';
import {
  AppointmentNotFoundError,
  ClinicNotFoundError,
  ConversationNotFoundError,
  LLMIterationLimitError,
  LLMProviderError,
  PastDateError,
  SlotAlreadyBookedError,
  SlotNotFoundError,
  ValidationError,
} from '@domain/errors';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createHost(): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, json }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('DomainExceptionFilter', () => {
  let logger: Logger;
  let filter: DomainExceptionFilter;

  beforeEach(() => {
    logger = createMockLogger();
    filter = new DomainExceptionFilter(logger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps SlotAlreadyBookedError to 409', () => {
    const { host, status, json } = createHost();
    filter.catch(new SlotAlreadyBookedError('slot-1'), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: 'SlotAlreadyBookedError',
      message: 'Slot slot-1 is already booked',
    });
    expect(logger.warn).toHaveBeenCalledWith('Domain error handled', {
      context: 'DomainExceptionFilter',
      errorName: 'SlotAlreadyBookedError',
      statusCode: 409,
    });
  });

  it('maps SlotNotFoundError to 404', () => {
    const { host, status, json } = createHost();
    filter.catch(new SlotNotFoundError('slot-2'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: 'SlotNotFoundError',
      message: 'Slot slot-2 was not found',
    });
  });

  it('maps ClinicNotFoundError to 404', () => {
    const { host, status, json } = createHost();
    filter.catch(new ClinicNotFoundError('clinic-1'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: 'ClinicNotFoundError',
      message: 'Clinic clinic-1 was not found',
    });
  });

  it('maps ConversationNotFoundError to 404', () => {
    const { host, status, json } = createHost();
    filter.catch(new ConversationNotFoundError('conv-1'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: 'ConversationNotFoundError',
      message: 'Conversation conv-1 was not found',
    });
  });

  it('maps AppointmentNotFoundError to 404', () => {
    const { host, status, json } = createHost();
    filter.catch(new AppointmentNotFoundError('apt-1'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: 'AppointmentNotFoundError',
      message: 'Appointment apt-1 was not found',
    });
  });

  it('maps PastDateError to 400', () => {
    const { host, status, json } = createHost();
    const date = new Date('2020-01-01T00:00:00Z');
    filter.catch(new PastDateError(date), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: 'PastDateError',
      message: expect.stringContaining('is in the past'),
    });
  });

  it('maps ValidationError to 400 with message and field errors context', () => {
    const { host, status, json } = createHost();
    filter.catch(
      new ValidationError('page must be an integer >= 1', [
        { field: 'page', message: 'must be integer >= 1' },
      ]),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: 'ValidationError',
      message: 'page must be an integer >= 1',
    });
  });

  it('maps LLMProviderError to 502', () => {
    const { host, status, json } = createHost();
    filter.catch(new LLMProviderError('Rate limit exceeded'), host);

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith({
      error: 'LLMProviderError',
      message: 'Rate limit exceeded',
    });
  });

  it('maps LLMIterationLimitError to 500 with domain message', () => {
    const { host, status, json } = createHost();
    filter.catch(new LLMIterationLimitError(5), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: 'LLMIterationLimitError',
      message: 'LLM tool-call iteration limit reached (5)',
    });
  });

  it('maps unknown infrastructure errors to generic 500 and logs the raw error', () => {
    const { host, status, json } = createHost();
    const raw = new Error('connect ECONNREFUSED 127.0.0.1:5432');

    filter.catch(raw, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: 'InternalServerError',
      message: 'Internal server error',
    });
    expect(logger.error).toHaveBeenCalledWith(raw.message, {
      context: 'DomainExceptionFilter',
      stack: raw.stack,
      exceptionName: 'Error',
    });
  });

  it('maps non-Error unknown values to generic 500', () => {
    const { host, status, json } = createHost();

    filter.catch('boom', host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: 'InternalServerError',
      message: 'Internal server error',
    });
    expect(logger.error).toHaveBeenCalledWith('boom', {
      context: 'DomainExceptionFilter',
      stack: undefined,
      exceptionName: 'string',
    });
  });

  it('passes through BadRequestException with its existing object body', () => {
    const { host, status, json } = createHost();
    filter.catch(
      new BadRequestException({
        error: 'ValidationError',
        message: 'from is required',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: 'ValidationError',
      message: 'from is required',
    });
  });

  it('passes through NotFoundException with its existing object body', () => {
    const { host, status, json } = createHost();
    filter.catch(
      new NotFoundException({
        error: 'ConversationNotFoundError',
        message: 'Conversation missing-1 was not found',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: 'ConversationNotFoundError',
      message: 'Conversation missing-1 was not found',
    });
  });

  it('normalizes Nest default HttpException bodies to { error, message }', () => {
    const { host, status, json } = createHost();
    filter.catch(new BadRequestException('Bad Request'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: 'BadRequestException',
      message: 'Bad Request',
    });
  });

  it('keeps custom error keys from HttpException object bodies', () => {
    const { host, status, json } = createHost();
    filter.catch(
      new BadRequestException({
        error: 'ValidationError',
        message: 'limit must be an integer between 1 and 100',
        statusCode: 400,
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: 'ValidationError',
      message: 'limit must be an integer between 1 and 100',
    });
  });

  it('falls back to exception name/message when HttpException body is null', () => {
    const { host, status, json } = createHost();
    const exception = new BadRequestException(null as unknown as string);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0] as { error: string; message: string };
    expect(body).toEqual(
      expect.objectContaining({
        message: expect.any(String),
      }),
    );
    expect(body.error).toBeTruthy();
  });

  it('normalizes non-string non-object HttpException bodies to { error, message }', () => {
    const { host, status, json } = createHost();
    const exception = new BadRequestException(42 as unknown as string);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0] as { error: string; message: string };
    expect(body).toEqual(
      expect.objectContaining({
        message: expect.any(String),
      }),
    );
    expect(body.error).toBeTruthy();
  });
});
