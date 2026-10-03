import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Logger } from '@domain/services';
import { MongoService } from './mongo.service';

const { MongoClientMock } = vi.hoisted(() => ({
  MongoClientMock: vi.fn(),
}));

vi.mock('mongodb', () => ({
  MongoClient: MongoClientMock,
}));

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createConfigService(values: Record<string, string | undefined>): ConfigService {
  return {
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      (values[key] as T | undefined) ?? defaultValue,
  } as unknown as ConfigService;
}

function createClientMock(overrides: Record<string, unknown> = {}) {
  const collection = vi.fn().mockReturnValue({ createIndex: vi.fn() });
  const db = vi.fn().mockReturnValue({
    collection,
    command: vi.fn().mockResolvedValue({ ok: 1 }),
  });
  const connect = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn().mockResolvedValue(undefined);

  const client = {
    connect,
    close,
    db,
  };

  MongoClientMock.mockImplementation(() => client);

  return { client, db, collection, connect, close, ...overrides };
}

function createService(config: ConfigService): MongoService {
  return new MongoService(createMockLogger(), config);
}

describe('MongoService', () => {
  beforeEach(() => {
    MongoClientMock.mockReset();
  });

  it('throws when MONGODB_URI is not configured', async () => {
    const service = createService(createConfigService({}));

    await expect(service.onModuleInit()).rejects.toThrow('MONGODB_URI is not configured');
  });

  it('connects using MONGODB_DB when provided', async () => {
    const mocks = createClientMock();
    const service = createService(
      createConfigService({
        MONGODB_URI: 'mongodb://localhost:27017',
        MONGODB_DB: 'messenger_hub_test',
      }),
    );

    await service.onModuleInit();

    expect(mocks.connect).toHaveBeenCalled();
    expect(mocks.db).toHaveBeenCalledWith('messenger_hub_test');
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('falls back to db name from URI path and default name', async () => {
    createClientMock();
    const service = createService(
      createConfigService({ MONGODB_URI: 'mongodb://localhost:27017/from_uri' }),
    );

    await service.onModuleInit();

    expect(MongoClientMock).toHaveBeenCalledWith(
      'mongodb://localhost:27017/from_uri',
      expect.objectContaining({ maxPoolSize: 10, minPoolSize: 0 }),
    );
  });

  it('defaults to messenger_hub when URI has no path db name', async () => {
    const mocks = createClientMock();
    const service = createService(
      createConfigService({ MONGODB_URI: 'mongodb://localhost:27017' }),
    );

    await service.onModuleInit();

    expect(mocks.db).toHaveBeenCalledWith('messenger_hub');
  });

  it('resolves undefined db name when URI path is root only', async () => {
    const mocks = createClientMock();
    const service = createService(
      createConfigService({ MONGODB_URI: 'mongodb://localhost:27017/' }),
    );

    await service.onModuleInit();

    expect(mocks.db).toHaveBeenCalledWith('messenger_hub');
  });

  it('closes the client on module destroy', async () => {
    const mocks = createClientMock();
    const service = createService(
      createConfigService({ MONGODB_URI: 'mongodb://localhost:27017', MONGODB_DB: 'db1' }),
    );

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(mocks.close).toHaveBeenCalled();
  });

  it('throws when getDb is called before initialization', () => {
    const service = createService(createConfigService({}));

    expect(() => service.getDb()).toThrow('MongoService is not initialized');
  });

  it('throws when getClient is called before initialization', () => {
    const service = createService(createConfigService({}));

    expect(() => service.getClient()).toThrow('MongoService is not initialized');
  });

  it('returns collection from the connected db', async () => {
    const mocks = createClientMock();
    const service = createService(
      createConfigService({ MONGODB_URI: 'mongodb://localhost:27017', MONGODB_DB: 'db1' }),
    );
    await service.onModuleInit();

    const collection = service.getCollection('messages');

    expect(mocks.collection).toHaveBeenCalledWith('messages');
    expect(collection).toBeDefined();
  });

  it('returns the underlying MongoClient', async () => {
    const mocks = createClientMock();
    const service = createService(
      createConfigService({ MONGODB_URI: 'mongodb://localhost:27017', MONGODB_DB: 'db1' }),
    );
    await service.onModuleInit();

    expect(service.getClient()).toBe(mocks.client);
  });

  it('pings the database', async () => {
    createClientMock();
    const service = createService(
      createConfigService({ MONGODB_URI: 'mongodb://localhost:27017', MONGODB_DB: 'db1' }),
    );
    await service.onModuleInit();

    await expect(service.ping()).resolves.toBe(true);
  });
});
