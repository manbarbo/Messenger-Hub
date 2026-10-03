import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentCancelledEvent } from '@domain/events/appointment-cancelled.event';

@Injectable()
export class AppointmentCancelledEventHandler {
  private readonly logger = new Logger(AppointmentCancelledEventHandler.name);

  @OnEvent('appointment.cancelled')
  handle(event: AppointmentCancelledEvent): void {
    this.logger.log(
      `Appointment cancelled id=${event.aggregateId} clinic=${event.clinicId} slot=${event.slotId}`,
    );
  }
}
