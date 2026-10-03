import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEvent } from '@domain/events/domain-event';
import type { EventPublisher } from '@domain/services/event-publisher.interface';
import { LOGGER, type Logger } from '@domain/services';

@Injectable()
export class EventEmitterEventPublisher implements EventPublisher {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  publish(event: DomainEvent): void {
    this.logger.debug('Domain event published', {
      context: 'EventEmitterEventPublisher',
      eventName: event.eventName,
      aggregateId: event.aggregateId,
    });
    this.eventEmitter.emit(event.eventName, event);
  }
}
