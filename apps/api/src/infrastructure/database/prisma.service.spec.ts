import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@domain/services';
import { PrismaService } from './prisma.service';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('PrismaService', () => {
  it('connects on module init and disconnects on destroy', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn().mockResolvedValue(undefined);

    const service = Object.create(PrismaService.prototype) as PrismaService;
    Object.assign(service, {
      logger: createMockLogger(),
      $connect: connect,
      $disconnect: disconnect,
    });

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('logs connection errors and rethrows on init failure', async () => {
    const logger = createMockLogger();
    const connect = vi.fn().mockRejectedValue(new Error('connection refused'));

    const service = Object.create(PrismaService.prototype) as PrismaService;
    Object.assign(service, { logger, $connect: connect });

    await expect(service.onModuleInit()).rejects.toThrow('connection refused');
    expect(logger.error).toHaveBeenCalledWith('PostgreSQL connection failed', {
      context: 'PrismaService',
      error: 'connection refused',
    });
  });
});
