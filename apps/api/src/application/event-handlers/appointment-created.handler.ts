import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentCreatedEvent } from '@domain/events/appointment-created.event';

@Injectable()
export class AppointmentCreatedEventHandler {
  private readonly logger = new Logger(AppointmentCreatedEventHandler.name);

  @OnEvent('appointment.created')
  handle(event: AppointmentCreatedEvent): void {
    this.logger.log(
      `Appointment created id=${event.aggregateId} clinic=${event.clinicId} doctor=${event.doctorId} slot=${event.slotId} phone=${event.patientPhone}`,
    );
  }
}
