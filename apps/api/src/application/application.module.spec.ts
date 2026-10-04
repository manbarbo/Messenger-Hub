import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import {
  AI_TRACE_REPOSITORY,
  APPOINTMENT_REPOSITORY,
  CLINIC_REPOSITORY,
  CONVERSATION_REPOSITORY,
  DOCTOR_REPOSITORY,
  EVENT_PUBLISHER,
  KNOWLEDGE_REPOSITORY,
  MESSAGE_REPOSITORY,
  QUEUE_SERVICE,
  SLOT_REPOSITORY,
} from '@domain/index';
import { LOGGER } from '@domain/services';
import {
  ApplicationModule,
  COMMAND_HANDLERS,
  EVENT_HANDLERS,
  QUERY_HANDLERS,
} from './application.module';
import { CancelAppointmentHandler } from './commands/cancel-appointment/cancel-appointment.handler';
import { CreateAppointmentHandler } from './commands/create-appointment/create-appointment.handler';
import { ProcessIncomingMessageHandler } from './commands/process-incoming-message/process-incoming-message.handler';
import { AppointmentCancelledEventHandler } from './event-handlers/appointment-cancelled.handler';
import { AppointmentCreatedEventHandler } from './event-handlers/appointment-created.handler';
import { AIOrchestratorService } from './llm/ai-orchestrator.service';
import { ToolValidator } from './llm/tool-validator';
import { GetConversationDetailHandler } from './queries/get-conversation-detail/get-conversation-detail.handler';
import { ListClinicsHandler } from './queries/list-clinics/list-clinics.handler';
import { ListConversationsHandler } from './queries/list-conversations/list-conversations.handler';

const noop = async () => undefined;

const mockConfigService = {
  get: <T>(key: string, defaultValue?: T): T | undefined => {
    const values: Record<string, string> = {
      LLM_API_KEY: 'test-key',
      LLM_BASE_URL: 'https://example.com/v1',
      LLM_MODEL: 'gemini-2.5-flash',
      EMBEDDING_MODEL: 'gemini-embedding-001',
      EMBEDDING_DIMENSIONS: '768',
    };
    return (values[key] as T | undefined) ?? defaultValue;
  },
};

const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

@Global()
@Module({
  providers: [
    { provide: ConfigService, useValue: mockConfigService },
    { provide: LOGGER, useValue: mockLogger },
    { provide: SLOT_REPOSITORY, useValue: { findById: noop, findAvailable: noop } },
    {
      provide: APPOINTMENT_REPOSITORY,
      useValue: { create: noop, findById: noop, update: noop },
    },
    {
      provide: CONVERSATION_REPOSITORY,
      useValue: { findByPatientPhone: noop, create: noop, findById: noop, findAll: noop },
    },
    {
      provide: MESSAGE_REPOSITORY,
      useValue: { findByMessageId: noop, create: noop, findByConversationId: noop },
    },
    { provide: AI_TRACE_REPOSITORY, useValue: { findByConversationId: noop, create: noop } },
    {
      provide: CLINIC_REPOSITORY,
      useValue: { findById: noop, findByName: noop, findAll: noop },
    },
    { provide: DOCTOR_REPOSITORY, useValue: { existsByClinicAndSpecialty: noop } },
    { provide: EVENT_PUBLISHER, useValue: { publish: noop } },
    { provide: QUEUE_SERVICE, useValue: { push: noop } },
    { provide: KNOWLEDGE_REPOSITORY, useValue: { search: noop } },
  ],
  exports: [
    ConfigService,
    LOGGER,
    SLOT_REPOSITORY,
    APPOINTMENT_REPOSITORY,
    CONVERSATION_REPOSITORY,
    MESSAGE_REPOSITORY,
    AI_TRACE_REPOSITORY,
    CLINIC_REPOSITORY,
    DOCTOR_REPOSITORY,
    EVENT_PUBLISHER,
    QUEUE_SERVICE,
    KNOWLEDGE_REPOSITORY,
  ],
})
class MockApplicationDepsModule {}

describe('ApplicationModule', () => {
  it('registers CQRS command, query, and event handlers', () => {
    expect(COMMAND_HANDLERS).toEqual([
      CreateAppointmentHandler,
      CancelAppointmentHandler,
      ProcessIncomingMessageHandler,
    ]);
    expect(QUERY_HANDLERS).toEqual([
      ListConversationsHandler,
      GetConversationDetailHandler,
      ListClinicsHandler,
    ]);
    expect(EVENT_HANDLERS).toEqual([
      AppointmentCreatedEventHandler,
      AppointmentCancelledEventHandler,
    ]);
  });

  it('imports CqrsModule for CommandBus and QueryBus support', () => {
    const imports = Reflect.getMetadata('imports', ApplicationModule) as unknown[] | undefined;
    expect(imports ?? []).toContain(CqrsModule);
  });

  it('compiles with mocked domain dependencies and exposes AI orchestrator', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockApplicationDepsModule, ApplicationModule],
    }).compile();

    expect(moduleRef.get(CreateAppointmentHandler)).toBeInstanceOf(CreateAppointmentHandler);
    expect(moduleRef.get(CancelAppointmentHandler)).toBeInstanceOf(CancelAppointmentHandler);
    expect(moduleRef.get(ProcessIncomingMessageHandler)).toBeInstanceOf(
      ProcessIncomingMessageHandler,
    );
    expect(moduleRef.get(ListConversationsHandler)).toBeInstanceOf(ListConversationsHandler);
    expect(moduleRef.get(GetConversationDetailHandler)).toBeInstanceOf(
      GetConversationDetailHandler,
    );
    expect(moduleRef.get(ListClinicsHandler)).toBeInstanceOf(ListClinicsHandler);
    expect(moduleRef.get(ToolValidator)).toBeInstanceOf(ToolValidator);
    expect(moduleRef.get(AIOrchestratorService)).toBeInstanceOf(AIOrchestratorService);
  });
});
