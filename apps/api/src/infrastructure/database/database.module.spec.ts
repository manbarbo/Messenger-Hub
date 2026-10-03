import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PrismaService } from './prisma.service';
import { MongoService } from './mongo.service';
import { DatabaseModule } from './database.module';
import { MONGO_COLLECTIONS } from './mongo.service';

describe('database infrastructure', () => {
  it('PrismaService implements NestJS lifecycle hooks', () => {
    expect(typeof PrismaService.prototype.onModuleInit).toBe('function');
    expect(typeof PrismaService.prototype.onModuleDestroy).toBe('function');
  });

  it('MongoService implements NestJS lifecycle hooks and accessors', () => {
    expect(typeof MongoService.prototype.onModuleInit).toBe('function');
    expect(typeof MongoService.prototype.onModuleDestroy).toBe('function');
    expect(typeof MongoService.prototype.getCollection).toBe('function');
    expect(typeof MongoService.prototype.getDb).toBe('function');
    expect(typeof MongoService.prototype.ping).toBe('function');
  });

  it('exposes expected Mongo collection names', () => {
    expect(MONGO_COLLECTIONS).toEqual({
      conversations: 'conversations',
      messages: 'messages',
      aiTraces: 'ai_traces',
    });
  });

  it('DatabaseModule is a Nest module', () => {
    expect(DatabaseModule).toBeDefined();
    expect(typeof DatabaseModule).toBe('function');
  });
});
