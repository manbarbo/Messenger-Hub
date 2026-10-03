import { BaseDomainEvent } from './domain-event';

export class AppointmentCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'appointment.created';

  constructor(
    readonly aggregateId: string,
    readonly clinicId: string,
    readonly doctorId: string,
    readonly slotId: string,
    readonly patientPhone: string,
  ) {
    super();
  }
}
