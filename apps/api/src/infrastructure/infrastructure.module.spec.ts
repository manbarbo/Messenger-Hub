import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  APPOINTMENT_REPOSITORY,
  EMBEDDING_SERVICE,
  KNOWLEDGE_REPOSITORY,
  SLOT_REPOSITORY,
} from '@domain/index';
import { PrismaService } from './database/prisma.service';
import { InfrastructureModule } from './infrastructure.module';
import { PrismaAppointmentRepository } from './repositories/prisma-appointment.repository';
import { PrismaKnowledgeRepository } from './repositories/prisma-knowledge.repository';
import { PrismaSlotRepository } from './repositories/prisma-slot.repository';

const mockPrisma = {};
const mockEmbedding = { embed: async () => [0.1, 0.2] };

@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: mockPrisma },
    { provide: EMBEDDING_SERVICE, useValue: mockEmbedding },
  ],
  exports: [PrismaService, EMBEDDING_SERVICE],
})
class MockInfrastructureDepsModule {}

describe('InfrastructureModule', () => {
  async function createTestModule() {
    return Test.createTestingModule({
      imports: [MockInfrastructureDepsModule, InfrastructureModule],
    }).compile();
  }

  it('binds AppointmentRepository to PrismaAppointmentRepository', async () => {
    const moduleRef = await createTestModule();
    const repository = moduleRef.get(APPOINTMENT_REPOSITORY);
    expect(repository).toBeInstanceOf(PrismaAppointmentRepository);
  });

  it('binds SlotRepository to PrismaSlotRepository', async () => {
    const moduleRef = await createTestModule();
    const repository = moduleRef.get(SLOT_REPOSITORY);
    expect(repository).toBeInstanceOf(PrismaSlotRepository);
  });

  it('binds KnowledgeRepository to PrismaKnowledgeRepository', async () => {
    const moduleRef = await createTestModule();
    const repository = moduleRef.get(KNOWLEDGE_REPOSITORY);
    expect(repository).toBeInstanceOf(PrismaKnowledgeRepository);
  });

  it('exports repository tokens for application layers', async () => {
    const moduleRef = await createTestModule();
    expect(moduleRef.get(APPOINTMENT_REPOSITORY)).toBeDefined();
    expect(moduleRef.get(SLOT_REPOSITORY)).toBeDefined();
    expect(moduleRef.get(KNOWLEDGE_REPOSITORY)).toBeDefined();
  });
});
