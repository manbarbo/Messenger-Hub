import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AIModule } from './llm/ai.module';
import { CancelAppointmentHandler } from './commands/cancel-appointment/cancel-appointment.handler';
import { CreateAppointmentHandler } from './commands/create-appointment/create-appointment.handler';
import { ProcessIncomingMessageHandler } from './commands/process-incoming-message/process-incoming-message.handler';
import { CreateKnowledgeDocumentHandler } from './commands/knowledge-documents/create-knowledge-document/create-knowledge-document.handler';
import { DeleteKnowledgeDocumentHandler } from './commands/knowledge-documents/delete-knowledge-document/delete-knowledge-document.handler';
import { UpdateKnowledgeDocumentHandler } from './commands/knowledge-documents/update-knowledge-document/update-knowledge-document.handler';
import { AppointmentCancelledEventHandler } from './event-handlers/appointment-cancelled.handler';
import { AppointmentCreatedEventHandler } from './event-handlers/appointment-created.handler';
import { GetConversationDetailHandler } from './queries/get-conversation-detail/get-conversation-detail.handler';
import { ListClinicsHandler } from './queries/list-clinics/list-clinics.handler';
import { ListConversationsHandler } from './queries/list-conversations/list-conversations.handler';
import { GetKnowledgeDocumentHandler } from './queries/knowledge-documents/get-knowledge-document/get-knowledge-document.handler';
import { ListKnowledgeDocumentsHandler } from './queries/knowledge-documents/list-knowledge-documents/list-knowledge-documents.handler';

export const COMMAND_HANDLERS = [
  CreateAppointmentHandler,
  CancelAppointmentHandler,
  ProcessIncomingMessageHandler,
  CreateKnowledgeDocumentHandler,
  UpdateKnowledgeDocumentHandler,
  DeleteKnowledgeDocumentHandler,
];

export const QUERY_HANDLERS = [
  ListConversationsHandler,
  GetConversationDetailHandler,
  ListClinicsHandler,
  ListKnowledgeDocumentsHandler,
  GetKnowledgeDocumentHandler,
];

export const EVENT_HANDLERS = [AppointmentCreatedEventHandler, AppointmentCancelledEventHandler];

@Module({
  imports: [CqrsModule, AIModule],
  providers: [...COMMAND_HANDLERS, ...QUERY_HANDLERS, ...EVENT_HANDLERS],
  exports: [AIModule],
})
export class ApplicationModule {}
