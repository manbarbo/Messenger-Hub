import type { DomainEvent } from '../events/domain-event';

export const EVENT_PUBLISHER = Symbol('EventPublisher');

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void> | void;
}
