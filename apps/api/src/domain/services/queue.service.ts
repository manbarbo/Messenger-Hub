import type { QueueJob } from '../value-objects/queue-job.vo';

export const QUEUE_SERVICE = Symbol('QueueService');

export interface QueueService {
  push(job: QueueJob): Promise<void>;
}
