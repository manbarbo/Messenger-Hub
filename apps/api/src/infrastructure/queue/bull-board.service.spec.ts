import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Logger } from '@domain/services';
import { BullBoardService } from './bull-board.service';
import type { BullMQQueueService } from './bullmq-queue.service';

const { createBullBoardMock, BullMQAdapterMock, ExpressAdapterMock, getRouterMock, setBasePathMock } =
  vi.hoisted(() => {
    const getRouterMock = vi.fn(() => ({ router: 'mock-router' }));
    const setBasePathMock = vi.fn(() => ({ getRouter: getRouterMock }));
    return {
      createBullBoardMock: vi.fn(() => ({})),
      BullMQAdapterMock: vi.fn((queue: unknown) => ({ queue })),
      ExpressAdapterMock: vi.fn(() => ({ getRouter: getRouterMock, setBasePath: setBasePathMock })),
      getRouterMock,
      setBasePathMock,
    };
  });

vi.mock('@bull-board/api', () => ({
  createBullBoard: createBullBoardMock,
}));

vi.mock('@bull-board/api/bullMQAdapter', () => ({
  BullMQAdapter: BullMQAdapterMock,
}));

vi.mock('@bull-board/express', () => ({
  ExpressAdapter: ExpressAdapterMock,
}));

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createConfigService(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    NODE_ENV: 'development',
    ...overrides,
  };

  return {
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      (values[key] as T | undefined) ?? defaultValue,
  } as unknown as ConfigService;
}

function createQueueService(queues: Array<{ name: string }> = []): BullMQQueueService {
  return {
    getQueues: vi.fn(() => queues),
  } as unknown as BullMQQueueService;
}

function createApp(): NestExpressApplication {
  return {
    use: vi.fn(),
  } as unknown as NestExpressApplication;
}

function createService(
  config: ConfigService = createConfigService(),
  queueService: BullMQQueueService = createQueueService(),
  logger: Logger = createMockLogger(),
): { service: BullBoardService; logger: Logger; queueService: BullMQQueueService } {
  return {
    service: new BullBoardService(logger, config, queueService),
    logger,
    queueService,
  };
}

describe('BullBoardService', () => {
  beforeEach(() => {
    createBullBoardMock.mockReset();
    BullMQAdapterMock.mockReset();
    ExpressAdapterMock.mockReset();
    getRouterMock.mockReset().mockReturnValue({ router: 'mock-router' });
    setBasePathMock.mockReset();
  });

  describe('isEnabled', () => {
    it('returns true when explicitly enabled in non-production', () => {
      const { service } = createService(createConfigService({ BULL_BOARD_ENABLED: 'true' }));
      expect(service.isEnabled()).toBe(true);
    });

    it('returns false when explicitly disabled', () => {
      const { service } = createService(createConfigService({ BULL_BOARD_ENABLED: 'false' }));
      expect(service.isEnabled()).toBe(false);
    });

    it('defaults to enabled in development', () => {
      const { service } = createService(createConfigService({ NODE_ENV: 'development' }));
      expect(service.isEnabled()).toBe(true);
    });

    it('defaults to disabled in production', () => {
      const { service } = createService(createConfigService({ NODE_ENV: 'production' }));
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('mount', () => {
    it('mounts BullBoard with default path and both queues when enabled', () => {
      const queues = [{ name: 'message-processing' }, { name: 'message-processing-dlq' }];
      const queueService = createQueueService(queues);
      const app = createApp();
      const { service, logger } = createService(
        createConfigService({ BULL_BOARD_ENABLED: 'true' }),
        queueService,
      );

      const mounted = service.mount(app);

      expect(mounted).toBe(true);
      expect(queueService.getQueues).toHaveBeenCalledOnce();
      expect(BullMQAdapterMock).toHaveBeenCalledTimes(2);
      expect(BullMQAdapterMock).toHaveBeenCalledWith(queues[0]);
      expect(BullMQAdapterMock).toHaveBeenCalledWith(queues[1]);
      expect(setBasePathMock).toHaveBeenCalledWith('/admin/queues');
      expect(app.use).toHaveBeenCalledTimes(1);
      expect(app.use).toHaveBeenCalledWith('/admin/queues', { router: 'mock-router' });
      expect(logger.info).toHaveBeenCalledWith(
        'BullBoard mounted',
        expect.objectContaining({
          context: 'BullBoardService',
          path: '/admin/queues',
          queues: ['message-processing', 'message-processing-dlq'],
          auth: false,
        }),
      );
    });

    it('uses a custom BULL_BOARD_PATH when provided', () => {
      const queueService = createQueueService([{ name: 'message-processing' }]);
      const app = createApp();
      const { service } = createService(
        createConfigService({
          BULL_BOARD_ENABLED: 'true',
          BULL_BOARD_PATH: '/ops/queues',
        }),
        queueService,
      );

      service.mount(app);

      expect(setBasePathMock).toHaveBeenCalledWith('/ops/queues');
      expect(app.use).toHaveBeenCalledWith('/ops/queues', { router: 'mock-router' });
    });

    it('does not mount when disabled', () => {
      const queueService = createQueueService([{ name: 'message-processing' }]);
      const app = createApp();
      const { service, logger } = createService(
        createConfigService({ BULL_BOARD_ENABLED: 'false' }),
        queueService,
      );

      const mounted = service.mount(app);

      expect(mounted).toBe(false);
      expect(queueService.getQueues).not.toHaveBeenCalled();
      expect(ExpressAdapterMock).not.toHaveBeenCalled();
      expect(app.use).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'BullBoard disabled',
        expect.objectContaining({ context: 'BullBoardService', event: 'disabled' }),
      );
    });

    it('does not mount in production by default', () => {
      const app = createApp();
      const { service } = createService(createConfigService({ NODE_ENV: 'production' }));

      expect(service.mount(app)).toBe(false);
      expect(app.use).not.toHaveBeenCalled();
    });

    it('applies basic auth when credentials are configured', () => {
      const queueService = createQueueService([{ name: 'message-processing' }]);
      const app = createApp();
      const { service, logger } = createService(
        createConfigService({
          BULL_BOARD_ENABLED: 'true',
          BULL_BOARD_USERNAME: 'admin',
          BULL_BOARD_PASSWORD: 'secret',
        }),
        queueService,
      );

      service.mount(app);

      expect(app.use).toHaveBeenCalledWith('/admin/queues', expect.any(Function));
      expect(app.use).toHaveBeenCalledWith('/admin/queues', { router: 'mock-router' });
      expect(logger.info).toHaveBeenCalledWith(
        'BullBoard mounted',
        expect.objectContaining({ auth: true }),
      );
    });

    it('rejects invalid basic auth credentials', () => {
      const queueService = createQueueService([{ name: 'message-processing' }]);
      const { service } = createService(
        createConfigService({
          BULL_BOARD_ENABLED: 'true',
          BULL_BOARD_USERNAME: 'admin',
          BULL_BOARD_PASSWORD: 'secret',
        }),
        queueService,
      );
      const app = createApp();
      service.mount(app);

      const authCalls = (app.use as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([, middleware]) => typeof middleware === 'function' && middleware.length === 3,
      );
      expect(authCalls).toHaveLength(1);

      const [, middleware] = authCalls[0] as [string, (req: unknown, res: unknown, next: () => void) => void];
      const res = {
        set: vi.fn(),
        status: vi.fn(() => ({ send: vi.fn() })),
      };
      const next = vi.fn();

      middleware({ headers: { authorization: 'Basic d3Jvbmc6Y3JlZHM=' } }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('accepts valid basic auth credentials', () => {
      const queueService = createQueueService([{ name: 'message-processing' }]);
      const { service } = createService(
        createConfigService({
          BULL_BOARD_ENABLED: 'true',
          BULL_BOARD_USERNAME: 'admin',
          BULL_BOARD_PASSWORD: 'secret',
        }),
        queueService,
      );
      const app = createApp();
      service.mount(app);

      const authCalls = (app.use as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([, middleware]) => typeof middleware === 'function' && middleware.length === 3,
      );
      const [, middleware] = authCalls[0] as [string, (req: unknown, res: unknown, next: () => void) => void];
      const res = {
        set: vi.fn(),
        status: vi.fn(() => ({ send: vi.fn() })),
      };
      const next = vi.fn();
      const credentials = Buffer.from('admin:secret').toString('base64');

      middleware({ headers: { authorization: `Basic ${credentials}` } }, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
