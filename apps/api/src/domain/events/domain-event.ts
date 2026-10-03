export interface DomainEvent {
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  readonly clinicId: string;
}

export abstract class BaseDomainEvent implements DomainEvent {
  readonly occurredAt: Date = new Date();

  abstract readonly eventName: string;
  abstract readonly aggregateId: string;
  abstract readonly clinicId: string;
}
