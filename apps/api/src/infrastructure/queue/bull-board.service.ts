import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { LOGGER, type Logger } from '@domain/services';
import { BullMQQueueService } from './bullmq-queue.service';

export const DEFAULT_BULL_BOARD_PATH = '/admin/queues';

type BasicAuthMiddleware = (
  req: { headers: Record<string, string | undefined> },
  res: {
    set: (field: string, value: string) => void;
    status: (code: number) => { send: (body: string) => void };
  },
  next: () => void,
) => void;

@Injectable()
export class BullBoardService {
  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly queueService: BullMQQueueService,
  ) {}

  isEnabled(): boolean {
    const explicit = this.configService.get<string>('BULL_BOARD_ENABLED');
    if (explicit !== undefined && explicit !== '') {
      return explicit === 'true';
    }
    return this.configService.get<string>('NODE_ENV') !== 'production';
  }

  mount(app: NestExpressApplication): boolean {
    if (!this.isEnabled()) {
      this.logger.warn('BullBoard disabled', {
        context: 'BullBoardService',
        event: 'disabled',
      });
      return false;
    }

    const basePath =
      this.configService.get<string>('BULL_BOARD_PATH') || DEFAULT_BULL_BOARD_PATH;
    const queues = this.queueService.getQueues();
    const queueNames = queues.map((queue) => queue.name);

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(basePath);

    createBullBoard({
      queues: queues.map((queue) => new BullMQAdapter(queue)),
      serverAdapter,
    });

    const username = this.configService.get<string>('BULL_BOARD_USERNAME');
    const password = this.configService.get<string>('BULL_BOARD_PASSWORD');
    const useAuth = Boolean(username && password);

    if (useAuth) {
      app.use(basePath, this.createBasicAuth(username as string, password as string));
    }

    app.use(basePath, serverAdapter.getRouter());

    this.logger.info('BullBoard mounted', {
      context: 'BullBoardService',
      path: basePath,
      queues: queueNames,
      auth: useAuth,
    });

    return true;
  }

  private createBasicAuth(username: string, password: string): BasicAuthMiddleware {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="BullBoard"');
        res.status(401).send('Authentication required');
        return;
      }

      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      const separatorIndex = decoded.indexOf(':');
      const user = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded;
      const pass = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : '';

      if (user !== username || pass !== password) {
        res.set('WWW-Authenticate', 'Basic realm="BullBoard"');
        res.status(401).send('Invalid credentials');
        return;
      }

      next();
    };
  }
}
