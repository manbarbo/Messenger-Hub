import { BaseDomainEvent } from './domain-event';

export class ConversationEscalatedEvent extends BaseDomainEvent {
  readonly eventName = 'conversation.escalated';

  constructor(
    readonly aggregateId: string,
    readonly clinicId: string,
    readonly patientPhone: string,
    readonly reason: string,
  ) {
    super();
  }
}
