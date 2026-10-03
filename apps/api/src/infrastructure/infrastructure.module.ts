import { Module } from '@nestjs/common';
import {
  AI_TRACE_REPOSITORY,
  APPOINTMENT_REPOSITORY,
  CONVERSATION_REPOSITORY,
  KNOWLEDGE_REPOSITORY,
  MESSAGE_REPOSITORY,
  SLOT_REPOSITORY,
} from '@domain/repositories';
import { PrismaAppointmentRepository } from './repositories/prisma-appointment.repository';
import { PrismaKnowledgeRepository } from './repositories/prisma-knowledge.repository';
import { PrismaSlotRepository } from './repositories/prisma-slot.repository';
import { MongoAITraceRepository } from './repositories/mongo-ai-trace.repository';
import { MongoConversationRepository } from './repositories/mongo-conversation.repository';
import { MongoMessageRepository } from './repositories/mongo-message.repository';

@Module({
  providers: [
    { provide: APPOINTMENT_REPOSITORY, useClass: PrismaAppointmentRepository },
    { provide: SLOT_REPOSITORY, useClass: PrismaSlotRepository },
    { provide: KNOWLEDGE_REPOSITORY, useClass: PrismaKnowledgeRepository },
    { provide: CONVERSATION_REPOSITORY, useClass: MongoConversationRepository },
    { provide: MESSAGE_REPOSITORY, useClass: MongoMessageRepository },
    { provide: AI_TRACE_REPOSITORY, useClass: MongoAITraceRepository },
  ],
  exports: [
    APPOINTMENT_REPOSITORY,
    SLOT_REPOSITORY,
    KNOWLEDGE_REPOSITORY,
    CONVERSATION_REPOSITORY,
    MESSAGE_REPOSITORY,
    AI_TRACE_REPOSITORY,
  ],
})
export class InfrastructureModule {}
