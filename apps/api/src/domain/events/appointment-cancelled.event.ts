import { BaseDomainEvent } from './domain-event';

export class AppointmentCancelledEvent extends BaseDomainEvent {
  readonly eventName = 'appointment.cancelled';

  constructor(
    readonly aggregateId: string,
    readonly clinicId: string,
    readonly doctorId: string,
    readonly slotId: string,
  ) {
    super();
  }
}
