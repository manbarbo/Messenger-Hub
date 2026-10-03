import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppointmentCreatedEvent } from '@domain/events/appointment-created.event';
import { EventEmitterEventPublisher } from './event-emitter-event-publisher';

describe('EventEmitterEventPublisher', () => {
  it('emits domain events by eventName on EventEmitter2', () => {
    const emit = vi.fn();
    const eventEmitter = { emit } as unknown as EventEmitter2;
    const publisher = new EventEmitterEventPublisher(eventEmitter);

    const event = new AppointmentCreatedEvent('apt-1', 'clinic-1', 'doc-1', 'slot-1', '+573');
    publisher.publish(event);

    expect(emit).toHaveBeenCalledWith('appointment.created', event);
  });
});
