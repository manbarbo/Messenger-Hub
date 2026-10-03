import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockContext(overrides: {
  method?: string;
  url?: string;
  body?: unknown;
  statusCode?: number;
} = {}): ExecutionContext {
  const request = {
    method: overrides.method ?? 'GET',
    url: overrides.url ?? '/api/test',
    body: overrides.body ?? {},
  };
  const response = {
    statusCode: overrides.statusCode ?? 200,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

describe('LoggingInterceptor', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    logger = createMockLogger();
    interceptor = new LoggingInterceptor(logger as never);
  });

  it('logs incoming request on intercept', () => {
    const context = createMockContext({ method: 'POST', url: '/webhooks/messages' });
    const next = { handle: () => of('response') };

    interceptor.intercept(context, next).subscribe();

    expect(logger.info).toHaveBeenCalledWith(
      'Incoming request',
      expect.objectContaining({
        context: 'HTTP',
        method: 'POST',
        path: '/webhooks/messages',
      }),
    );
  });

  it('logs response on successful completion', () => {
    const context = createMockContext({ method: 'GET', url: '/api/conversations', statusCode: 200 });
    const next = { handle: () => of('response') };

    interceptor.intercept(context, next).subscribe();

    expect(logger.info).toHaveBeenCalledWith(
      'Response sent',
      expect.objectContaining({
        context: 'HTTP',
        method: 'GET',
        path: '/api/conversations',
        statusCode: 200,
        duration: expect.any(Number),
      }),
    );
  });

  it('logs error on failed request', () => {
    const context = createMockContext({ method: 'POST', url: '/api/simulator', statusCode: 500 });
    const error = new Error('Something broke');
    const next = { handle: () => throwError(() => error) };

    interceptor.intercept(context, next).subscribe({
      error: () => {},
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Request failed',
      expect.objectContaining({
        context: 'HTTP',
        method: 'POST',
        path: '/api/simulator',
        statusCode: 500,
        duration: expect.any(Number),
        error: 'Something broke',
        stack: expect.any(String),
      }),
    );
  });

  it('sanitizes sensitive fields in request body', () => {
    const context = createMockContext({
      method: 'POST',
      url: '/webhooks/messages',
      body: { from: '+573001112233', password: 'secret123', token: 'abc', text: 'hello' },
    });
    const next = { handle: () => of('response') };

    interceptor.intercept(context, next).subscribe();

    const logCall = logger.info.mock.calls[0][1] as Record<string, unknown>;
    const body = logCall.body as Record<string, unknown>;
    expect(body.from).toBe('+573001112233');
    expect(body.text).toBe('hello');
    expect(body.password).toBe('[REDACTED]');
    expect(body.token).toBe('[REDACTED]');
  });

  it('handles empty body gracefully', () => {
    const context = createMockContext({ body: undefined });
    const next = { handle: () => of('response') };

    interceptor.intercept(context, next).subscribe();

    const logCall = logger.info.mock.calls[0][1] as Record<string, unknown>;
    expect(logCall.body).toEqual({});
  });

  it('handles null body gracefully', () => {
    const context = createMockContext({ body: null });
    const next = { handle: () => of('response') };

    interceptor.intercept(context, next).subscribe();

    const logCall = logger.info.mock.calls[0][1] as Record<string, unknown>;
    expect(logCall.body).toEqual({});
  });

  it('redacts nested sensitive fields', () => {
    const context = createMockContext({
      body: { data: { apiKey: 'key123', name: 'test' } },
    });
    const next = { handle: () => of('response') };

    interceptor.intercept(context, next).subscribe();

    const logCall = logger.info.mock.calls[0][1] as Record<string, unknown>;
    const body = logCall.body as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.apiKey).toBe('[REDACTED]');
    expect(data.name).toBe('test');
  });

  it('preserves the observable value on success', () => {
    const context = createMockContext();
    const next = { handle: () => of('result-value') };

    let result: unknown;
    interceptor.intercept(context, next).subscribe((value) => {
      result = value;
    });

    expect(result).toBe('result-value');
  });
});