import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, Db, MongoClient } from 'mongodb';
import { MONGO_INDEX_SPECS } from './mongo-indexes';

export const MONGO_COLLECTIONS = {
  conversations: 'conversations',
  messages: 'messages',
  aiTraces: 'ai_traces',
} as const;

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoService.name);
  private client?: MongoClient;
  private db?: Db;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const uri = this.configService.get<string>('MONGODB_URI');
    if (!uri) {
      throw new Error('MONGODB_URI is not configured');
    }

    const dbName =
      this.configService.get<string>('MONGODB_DB') ?? this.resolveDbName(uri) ?? 'messenger_hub';

    this.client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
    });

    await this.client.connect();
    this.db = this.client.db(dbName);
    await this.createIndexes();
    this.logger.log(`MongoDB connected: ${dbName}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = undefined;
      this.db = undefined;
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('MongoService is not initialized. Wait for onModuleInit.');
    }
    return this.db;
  }

  getCollection<T extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
  ): Collection<T> {
    return this.getDb().collection<T>(name);
  }

  getClient(): MongoClient {
    if (!this.client) {
      throw new Error('MongoService is not initialized. Wait for onModuleInit.');
    }
    return this.client;
  }

  async ping(): Promise<boolean> {
    const result = await this.getDb().command({ ping: 1 });
    return result.ok === 1;
  }

  private async createIndexes(): Promise<void> {
    const db = this.getDb();
    for (const spec of MONGO_INDEX_SPECS) {
      const options = spec.options ?? {};
      await db.collection(spec.collection).createIndex(spec.key as Record<string, 1>, options);
    }
    this.logger.log(`Ensured ${MONGO_INDEX_SPECS.length} MongoDB indexes`);
  }

  private resolveDbName(uri: string): string | undefined {
    try {
      const url = new URL(uri);
      const path = url.pathname.replace(/^\//, '');
      return path.length > 0 ? path : undefined;
    } catch {
      return undefined;
    }
  }
}
