import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoggerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('has debug, info, warn, error methods', () => {
    expect(typeof service.debug).toBe('function');
    expect(typeof service.info).toBe('function');
    expect(typeof service.warn).toBe('function');
    expect(typeof service.error).toBe('function');
  });

  it('debug calls console.log in dev mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    service.debug('test debug', 'TestCtx', { key: 'val' });
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain('[DEBUG]');
    expect(output).toContain('[TestCtx]');
    expect(output).toContain('test debug');
    spy.mockRestore();
  });

  it('info calls console.info in dev mode', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    service.info('test info', 'TestCtx');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain('[INFO]');
    expect(output).toContain('test info');
    spy.mockRestore();
  });

  it('warn calls console.warn in dev mode', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    service.warn('test warn', 'TestCtx');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain('[WARN]');
    expect(output).toContain('test warn');
    spy.mockRestore();
  });

  it('error calls console.error in dev mode', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    service.error('test error', 'TestCtx', { detail: 'boom' });
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain('[ERROR]');
    expect(output).toContain('test error');
    spy.mockRestore();
  });

  it('includes timestamp in log output', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    service.info('timestamp test');
    const output = spy.mock.calls[0][0] as string;
    expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    spy.mockRestore();
  });

  it('handles missing context gracefully', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    service.info('no context');
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain('no context');
    expect(output).not.toContain('[]');
    spy.mockRestore();
  });
});