import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentCancelledEvent } from '@domain/events/appointment-cancelled.event';
import { LOGGER, type Logger } from '@domain/services';

@Injectable()
export class AppointmentCancelledEventHandler {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  @OnEvent('appointment.cancelled')
  handle(event: AppointmentCancelledEvent): void {
    this.logger.info('Appointment cancelled event received', {
      context: 'AppointmentCancelledEventHandler',
      appointmentId: event.aggregateId,
      clinicId: event.clinicId,
      doctorId: event.doctorId,
      slotId: event.slotId,
    });
  }
}
