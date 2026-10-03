import { TestBed } from '@angular/core/testing';
import { GlobalErrorHandler } from './global-error.handler';
import { LoggerService } from './logger.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let logger: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GlobalErrorHandler, LoggerService],
    });
    handler = TestBed.inject(GlobalErrorHandler);
    logger = TestBed.inject(LoggerService);
  });

  it('should be created', () => {
    expect(handler).toBeTruthy();
  });

  it('logs unhandled errors via LoggerService', () => {
    const spy = vi.spyOn(logger, 'error');
    const error = new Error('Test error');

    handler.handleError(error);

    expect(spy).toHaveBeenCalledWith('Unhandled Angular error', 'GlobalErrorHandler', {
      message: 'Test error',
      stack: expect.any(String),
    });
  });

  it('logs error stack trace', () => {
    const spy = vi.spyOn(logger, 'error');
    const error = new Error('Stack test');

    handler.handleError(error);

    const callArgs = spy.mock.calls[0][2] as { stack: string };
    expect(callArgs.stack).toContain('Error: Stack test');
  });
});