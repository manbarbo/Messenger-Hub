import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { InMemoryQueueService } from './in-memory-queue.service';

describe('InMemoryQueueService', () => {
  it('stores pushed jobs in order', async () => {
    const queue = new InMemoryQueueService();

    await queue.push({
      conversationId: 'conv-1',
      messageId: 'm1',
      from: '+57300',
      text: 'hola',
      clinicId: 'clinic-1',
    });
    await queue.push({
      conversationId: 'conv-1',
      messageId: 'm2',
      from: '+57300',
      text: 'cita',
      clinicId: 'clinic-1',
    });

    expect(queue.getJobs()).toHaveLength(2);
    expect(queue.getJobs()[0].messageId).toBe('m1');
    expect(queue.getJobs()[1].messageId).toBe('m2');
  });

  it('clears jobs', async () => {
    const queue = new InMemoryQueueService();
    await queue.push({
      conversationId: 'conv-1',
      messageId: 'm1',
      from: '+57300',
      text: 'hola',
      clinicId: 'clinic-1',
    });

    queue.clear();

    expect(queue.getJobs()).toEqual([]);
  });
});
