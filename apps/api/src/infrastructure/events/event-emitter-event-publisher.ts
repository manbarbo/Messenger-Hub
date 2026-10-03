import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEvent } from '@domain/events/domain-event';
import type { EventPublisher } from '@domain/services/event-publisher.interface';

@Injectable()
export class EventEmitterEventPublisher implements EventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publish(event: DomainEvent): void {
    this.eventEmitter.emit(event.eventName, event);
  }
}
