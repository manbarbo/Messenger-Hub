import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CancelAppointmentHandler } from './commands/cancel-appointment/cancel-appointment.handler';
import { CreateAppointmentHandler } from './commands/create-appointment/create-appointment.handler';
import { ProcessIncomingMessageHandler } from './commands/process-incoming-message/process-incoming-message.handler';
import { AppointmentCancelledEventHandler } from './event-handlers/appointment-cancelled.handler';
import { AppointmentCreatedEventHandler } from './event-handlers/appointment-created.handler';

export const COMMAND_HANDLERS = [
  CreateAppointmentHandler,
  CancelAppointmentHandler,
  ProcessIncomingMessageHandler,
];

export const EVENT_HANDLERS = [AppointmentCreatedEventHandler, AppointmentCancelledEventHandler];

@Module({
  imports: [CqrsModule],
  providers: [...COMMAND_HANDLERS, ...EVENT_HANDLERS],
})
export class ApplicationModule {}
