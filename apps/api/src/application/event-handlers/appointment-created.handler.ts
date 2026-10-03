import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentCreatedEvent } from '@domain/events/appointment-created.event';
import { LOGGER, type Logger } from '@domain/services';

@Injectable()
export class AppointmentCreatedEventHandler {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  @OnEvent('appointment.created')
  handle(event: AppointmentCreatedEvent): void {
    this.logger.info('Appointment created event received', {
      context: 'AppointmentCreatedEventHandler',
      appointmentId: event.aggregateId,
      clinicId: event.clinicId,
      doctorId: event.doctorId,
      slotId: event.slotId,
    });
  }
}
