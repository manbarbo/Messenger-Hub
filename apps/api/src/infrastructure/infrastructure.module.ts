import { Global, Module } from '@nestjs/common';
import {
  AI_TRACE_REPOSITORY,
  APPOINTMENT_REPOSITORY,
  CLINIC_REPOSITORY,
  CONVERSATION_REPOSITORY,
  DOCTOR_REPOSITORY,
  KNOWLEDGE_REPOSITORY,
  MESSAGE_REPOSITORY,
  SLOT_REPOSITORY,
} from '@domain/repositories';
import { EVENT_PUBLISHER } from '@domain/services';
import { EventEmitterEventPublisher } from './events/event-emitter-event-publisher';
import { PrismaAppointmentRepository } from './repositories/prisma-appointment.repository';
import { PrismaClinicRepository } from './repositories/prisma-clinic.repository';
import { PrismaDoctorRepository } from './repositories/prisma-doctor.repository';
import { PrismaKnowledgeRepository } from './repositories/prisma-knowledge.repository';
import { PrismaSlotRepository } from './repositories/prisma-slot.repository';
import { MongoAITraceRepository } from './repositories/mongo-ai-trace.repository';
import { MongoConversationRepository } from './repositories/mongo-conversation.repository';
import { MongoMessageRepository } from './repositories/mongo-message.repository';

@Global()
@Module({
  providers: [
    { provide: APPOINTMENT_REPOSITORY, useClass: PrismaAppointmentRepository },
    { provide: CLINIC_REPOSITORY, useClass: PrismaClinicRepository },
    { provide: DOCTOR_REPOSITORY, useClass: PrismaDoctorRepository },
    { provide: SLOT_REPOSITORY, useClass: PrismaSlotRepository },
    { provide: KNOWLEDGE_REPOSITORY, useClass: PrismaKnowledgeRepository },
    { provide: CONVERSATION_REPOSITORY, useClass: MongoConversationRepository },
    { provide: MESSAGE_REPOSITORY, useClass: MongoMessageRepository },
    { provide: AI_TRACE_REPOSITORY, useClass: MongoAITraceRepository },
    { provide: EVENT_PUBLISHER, useClass: EventEmitterEventPublisher },
  ],
  exports: [
    APPOINTMENT_REPOSITORY,
    CLINIC_REPOSITORY,
    DOCTOR_REPOSITORY,
    SLOT_REPOSITORY,
    KNOWLEDGE_REPOSITORY,
    CONVERSATION_REPOSITORY,
    MESSAGE_REPOSITORY,
    AI_TRACE_REPOSITORY,
    EVENT_PUBLISHER,
  ],
})
export class InfrastructureModule {}
