import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { LOGGER, type Logger } from '@domain/services';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.info('PostgreSQL connected', {
        context: 'PrismaService',
        event: 'connected',
      });
    } catch (error) {
      this.logger.error('PostgreSQL connection failed', {
        context: 'PrismaService',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.info('PostgreSQL disconnected', {
        context: 'PrismaService',
        event: 'disconnected',
      });
    } catch (error) {
      this.logger.error('PostgreSQL disconnect failed', {
        context: 'PrismaService',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
