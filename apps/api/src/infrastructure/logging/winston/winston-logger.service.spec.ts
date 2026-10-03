import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from './winston-logger.service';

function createService(env = 'development'): WinstonLoggerService {
  const configService = {
    get: (key: string) => (key === 'NODE_ENV' ? env : undefined),
  } as unknown as ConfigService;
  return new WinstonLoggerService(configService);
}

describe('WinstonLoggerService', () => {
  let service: WinstonLoggerService;

  beforeEach(() => {
    service = createService();
  });

  it('implements Logger interface methods', () => {
    expect(typeof service.debug).toBe('function');
    expect(typeof service.info).toBe('function');
    expect(typeof service.warn).toBe('function');
    expect(typeof service.error).toBe('function');
  });

  it('implements NestJS LoggerService methods', () => {
    expect(typeof service.log).toBe('function');
    expect(typeof service.fatal).toBe('function');
  });

  it('debug delegates to winston logger', () => {
    const spy = vi.spyOn(service['logger'], 'debug');
    service.debug('test debug', { context: 'Test' });
    expect(spy).toHaveBeenCalledWith('test debug', { context: 'Test' });
  });

  it('info delegates to winston logger', () => {
    const spy = vi.spyOn(service['logger'], 'info');
    service.info('test info', { context: 'Test' });
    expect(spy).toHaveBeenCalledWith('test info', { context: 'Test' });
  });

  it('warn delegates to winston logger', () => {
    const spy = vi.spyOn(service['logger'], 'warn');
    service.warn('test warn', { context: 'Test' });
    expect(spy).toHaveBeenCalledWith('test warn', { context: 'Test' });
  });

  it('error delegates to winston logger', () => {
    const spy = vi.spyOn(service['logger'], 'error');
    service.error('test error', { context: 'Test', stack: 'trace' });
    expect(spy).toHaveBeenCalledWith('test error', { context: 'Test', stack: 'trace' });
  });

  it('log delegates to info', () => {
    const spy = vi.spyOn(service, 'info');
    service.log('test log', 'MyContext');
    expect(spy).toHaveBeenCalledWith('test log', { context: 'MyContext' });
  });

  it('log without context calls info with undefined metadata', () => {
    const spy = vi.spyOn(service, 'info');
    service.log('test log');
    expect(spy).toHaveBeenCalledWith('test log', undefined);
  });

  it('fatal delegates to error', () => {
    const spy = vi.spyOn(service, 'error');
    service.fatal('fatal error', 'MyContext');
    expect(spy).toHaveBeenCalledWith('fatal error', { context: 'MyContext' });
  });

  it('creates production config when NODE_ENV is production', () => {
    const prodService = createService('production');
    expect(prodService['logger']).toBeDefined();
  });

  it('creates dev config when NODE_ENV is development', () => {
    const devService = createService('development');
    expect(devService['logger']).toBeDefined();
  });
});