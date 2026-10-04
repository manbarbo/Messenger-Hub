import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AIModule } from './llm/ai.module';
import { CancelAppointmentHandler } from './commands/cancel-appointment/cancel-appointment.handler';
import { CreateAppointmentHandler } from './commands/create-appointment/create-appointment.handler';
import { ProcessIncomingMessageHandler } from './commands/process-incoming-message/process-incoming-message.handler';
import { AppointmentCancelledEventHandler } from './event-handlers/appointment-cancelled.handler';
import { AppointmentCreatedEventHandler } from './event-handlers/appointment-created.handler';
import { GetConversationDetailHandler } from './queries/get-conversation-detail/get-conversation-detail.handler';
import { ListClinicsHandler } from './queries/list-clinics/list-clinics.handler';
import { ListConversationsHandler } from './queries/list-conversations/list-conversations.handler';

export const COMMAND_HANDLERS = [
  CreateAppointmentHandler,
  CancelAppointmentHandler,
  ProcessIncomingMessageHandler,
];

export const QUERY_HANDLERS = [
  ListConversationsHandler,
  GetConversationDetailHandler,
  ListClinicsHandler,
];

export const EVENT_HANDLERS = [AppointmentCreatedEventHandler, AppointmentCancelledEventHandler];

@Module({
  imports: [CqrsModule, AIModule],
  providers: [...COMMAND_HANDLERS, ...QUERY_HANDLERS, ...EVENT_HANDLERS],
  exports: [AIModule],
})
export class ApplicationModule {}
