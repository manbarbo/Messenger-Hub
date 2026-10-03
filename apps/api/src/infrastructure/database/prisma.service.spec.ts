import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('connects on module init and disconnects on destroy', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn().mockResolvedValue(undefined);

    const service = Object.create(PrismaService.prototype) as PrismaService;
    Object.assign(service, { $connect: connect, $disconnect: disconnect });

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
