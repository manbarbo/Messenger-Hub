import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import {
  AI_TRACE_REPOSITORY,
  APPOINTMENT_REPOSITORY,
  CLINIC_REPOSITORY,
  CONVERSATION_REPOSITORY,
  DOCTOR_REPOSITORY,
  EMBEDDING_SERVICE,
  EVENT_PUBLISHER,
  KNOWLEDGE_REPOSITORY,
  MESSAGE_REPOSITORY,
  QUEUE_SERVICE,
  SLOT_REPOSITORY,
} from '@domain/index';
import { ApplicationModule } from '../application/application.module';
import { CancelAppointmentHandler } from '../application/commands/cancel-appointment/cancel-appointment.handler';
import { CreateAppointmentHandler } from '../application/commands/create-appointment/create-appointment.handler';
import { GetConversationDetailHandler } from '../application/queries/get-conversation-detail/get-conversation-detail.handler';
import { ListConversationsHandler } from '../application/queries/list-conversations/list-conversations.handler';
import { MongoService } from './database/mongo.service';
import { PrismaService } from './database/prisma.service';
import { InfrastructureModule } from './infrastructure.module';
import { EventEmitterEventPublisher } from './events/event-emitter-event-publisher';
import { PrismaAppointmentRepository } from './repositories/prisma-appointment.repository';
import { PrismaClinicRepository } from './repositories/prisma-clinic.repository';
import { PrismaDoctorRepository } from './repositories/prisma-doctor.repository';
import { PrismaKnowledgeRepository } from './repositories/prisma-knowledge.repository';
import { PrismaSlotRepository } from './repositories/prisma-slot.repository';
import { MongoAITraceRepository } from './repositories/mongo-ai-trace.repository';
import { MongoConversationRepository } from './repositories/mongo-conversation.repository';
import { MongoMessageRepository } from './repositories/mongo-message.repository';

const mockPrisma = {};
const mockMongo = {};
const mockEmbedding = { embed: async () => [0.1, 0.2] };
const mockEventEmitter = { emit: vi.fn() };
const mockConfigService = {
  get: <T>(key: string, defaultValue?: T): T | undefined => {
    const values: Record<string, string> = {
      LLM_API_KEY: 'test-key',
      LLM_BASE_URL: 'https://example.com/v1',
      LLM_MODEL: 'gemini-2.5-flash',
      EMBEDDING_MODEL: 'text-embedding-004',
      EMBEDDING_DIMENSIONS: '768',
    };
    return (values[key] as T | undefined) ?? defaultValue;
  },
};

@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: mockPrisma },
    { provide: MongoService, useValue: mockMongo },
    { provide: EMBEDDING_SERVICE, useValue: mockEmbedding },
    { provide: EventEmitter2, useValue: mockEventEmitter },
    { provide: ConfigService, useValue: mockConfigService },
    { provide: QUEUE_SERVICE, useValue: { push: vi.fn() } },
  ],
  exports: [
    PrismaService,
    MongoService,
    EMBEDDING_SERVICE,
    EventEmitter2,
    ConfigService,
    QUEUE_SERVICE,
  ],
})
class MockInfrastructureDepsModule {}

describe('InfrastructureModule', () => {
  async function createTestModule() {
    return Test.createTestingModule({
      imports: [MockInfrastructureDepsModule, InfrastructureModule],
    }).compile();
  }

  it('binds PostgreSQL repositories to Prisma adapters', async () => {
    const moduleRef = await createTestModule();
    expect(moduleRef.get(APPOINTMENT_REPOSITORY)).toBeInstanceOf(PrismaAppointmentRepository);
    expect(moduleRef.get(CLINIC_REPOSITORY)).toBeInstanceOf(PrismaClinicRepository);
    expect(moduleRef.get(DOCTOR_REPOSITORY)).toBeInstanceOf(PrismaDoctorRepository);
    expect(moduleRef.get(SLOT_REPOSITORY)).toBeInstanceOf(PrismaSlotRepository);
    expect(moduleRef.get(KNOWLEDGE_REPOSITORY)).toBeInstanceOf(PrismaKnowledgeRepository);
  });

  it('binds MongoDB repositories to Mongo adapters', async () => {
    const moduleRef = await createTestModule();
    expect(moduleRef.get(CONVERSATION_REPOSITORY)).toBeInstanceOf(MongoConversationRepository);
    expect(moduleRef.get(MESSAGE_REPOSITORY)).toBeInstanceOf(MongoMessageRepository);
    expect(moduleRef.get(AI_TRACE_REPOSITORY)).toBeInstanceOf(MongoAITraceRepository);
  });

  it('binds EventPublisher adapter', async () => {
    const moduleRef = await createTestModule();
    expect(moduleRef.get(EVENT_PUBLISHER)).toBeInstanceOf(EventEmitterEventPublisher);
  });

  it('exports all repository and service tokens for application layers', async () => {
    const moduleRef = await createTestModule();
    const tokens = [
      APPOINTMENT_REPOSITORY,
      CLINIC_REPOSITORY,
      DOCTOR_REPOSITORY,
      SLOT_REPOSITORY,
      KNOWLEDGE_REPOSITORY,
      CONVERSATION_REPOSITORY,
      MESSAGE_REPOSITORY,
      AI_TRACE_REPOSITORY,
      EVENT_PUBLISHER,
    ];
    for (const token of tokens) {
      expect(moduleRef.get(token)).toBeDefined();
    }
  });

  it('is marked @Global so ApplicationModule can resolve exported tokens', () => {
    expect(Reflect.getMetadata('__module:global__', InfrastructureModule)).toBe(true);
  });

  it('lets ApplicationModule handlers resolve InfrastructureModule tokens at runtime', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockInfrastructureDepsModule, InfrastructureModule, ApplicationModule],
    }).compile();

    expect(moduleRef.get(CreateAppointmentHandler)).toBeInstanceOf(CreateAppointmentHandler);
    expect(moduleRef.get(CancelAppointmentHandler)).toBeInstanceOf(CancelAppointmentHandler);
    expect(moduleRef.get(ListConversationsHandler)).toBeInstanceOf(ListConversationsHandler);
    expect(moduleRef.get(GetConversationDetailHandler)).toBeInstanceOf(
      GetConversationDetailHandler,
    );
  });
});
