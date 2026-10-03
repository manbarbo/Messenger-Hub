import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CancelAppointmentHandler } from './commands/cancel-appointment/cancel-appointment.handler';
import { CreateAppointmentHandler } from './commands/create-appointment/create-appointment.handler';
import { ProcessIncomingMessageHandler } from './commands/process-incoming-message/process-incoming-message.handler';
import { AppointmentCancelledEventHandler } from './event-handlers/appointment-cancelled.handler';
import { AppointmentCreatedEventHandler } from './event-handlers/appointment-created.handler';
import { ToolValidator } from './llm/tool-validator';
import { GetConversationDetailHandler } from './queries/get-conversation-detail/get-conversation-detail.handler';
import { ListConversationsHandler } from './queries/list-conversations/list-conversations.handler';

export const COMMAND_HANDLERS = [
  CreateAppointmentHandler,
  CancelAppointmentHandler,
  ProcessIncomingMessageHandler,
];

export const QUERY_HANDLERS = [ListConversationsHandler, GetConversationDetailHandler];

export const EVENT_HANDLERS = [AppointmentCreatedEventHandler, AppointmentCancelledEventHandler];

@Module({
  imports: [CqrsModule],
  providers: [...COMMAND_HANDLERS, ...QUERY_HANDLERS, ...EVENT_HANDLERS, ToolValidator],
  exports: [ToolValidator],
})
export class ApplicationModule {}
