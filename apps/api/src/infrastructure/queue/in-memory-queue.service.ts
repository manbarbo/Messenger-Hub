import { Injectable } from '@nestjs/common';
import type { QueueJob } from '@domain/value-objects/queue-job.vo';
import type { QueueService } from '@domain/services/queue.service';

@Injectable()
export class InMemoryQueueService implements QueueService {
  private readonly jobs: QueueJob[] = [];

  async push(job: QueueJob): Promise<void> {
    this.jobs.push(job);
  }

  getJobs(): readonly QueueJob[] {
    return this.jobs;
  }

  clear(): void {
    this.jobs.length = 0;
  }
}
