import { Module } from '@nestjs/common';
import {
  APPOINTMENT_REPOSITORY,
  KNOWLEDGE_REPOSITORY,
  SLOT_REPOSITORY,
} from '@domain/repositories';
import { PrismaAppointmentRepository } from './repositories/prisma-appointment.repository';
import { PrismaKnowledgeRepository } from './repositories/prisma-knowledge.repository';
import { PrismaSlotRepository } from './repositories/prisma-slot.repository';

@Module({
  providers: [
    { provide: APPOINTMENT_REPOSITORY, useClass: PrismaAppointmentRepository },
    { provide: SLOT_REPOSITORY, useClass: PrismaSlotRepository },
    { provide: KNOWLEDGE_REPOSITORY, useClass: PrismaKnowledgeRepository },
  ],
  exports: [APPOINTMENT_REPOSITORY, SLOT_REPOSITORY, KNOWLEDGE_REPOSITORY],
})
export class InfrastructureModule {}
