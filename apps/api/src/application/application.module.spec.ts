import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CqrsModule } from '@nestjs/cqrs';
import { describe, expect, it } from 'vitest';
import {
  AI_TRACE_REPOSITORY,
  APPOINTMENT_REPOSITORY,
  CONVERSATION_REPOSITORY,
  EVENT_PUBLISHER,
  KNOWLEDGE_REPOSITORY,
  MESSAGE_REPOSITORY,
  QUEUE_SERVICE,
  SLOT_REPOSITORY,
} from '@domain/index';
import {
  ApplicationModule,
  COMMAND_HANDLERS,
  EVENT_HANDLERS,
} from './application.module';
import { CancelAppointmentHandler } from './commands/cancel-appointment/cancel-appointment.handler';
import { CreateAppointmentHandler } from './commands/create-appointment/create-appointment.handler';
import { ProcessIncomingMessageHandler } from './commands/process-incoming-message/process-incoming-message.handler';
import { AppointmentCancelledEventHandler } from './event-handlers/appointment-cancelled.handler';
import { AppointmentCreatedEventHandler } from './event-handlers/appointment-created.handler';

const noop = async () => undefined;

@Global()
@Module({
  providers: [
    { provide: SLOT_REPOSITORY, useValue: { findById: noop } },
    {
      provide: APPOINTMENT_REPOSITORY,
      useValue: { create: noop, findById: noop, update: noop },
    },
    {
      provide: CONVERSATION_REPOSITORY,
      useValue: { findByPatientPhone: noop, create: noop },
    },
    { provide: MESSAGE_REPOSITORY, useValue: { findByMessageId: noop, create: noop } },
    { provide: EVENT_PUBLISHER, useValue: { publish: noop } },
    { provide: QUEUE_SERVICE, useValue: { push: noop } },
    { provide: KNOWLEDGE_REPOSITORY, useValue: {} },
    { provide: AI_TRACE_REPOSITORY, useValue: {} },
  ],
  exports: [
    SLOT_REPOSITORY,
    APPOINTMENT_REPOSITORY,
    CONVERSATION_REPOSITORY,
    MESSAGE_REPOSITORY,
    EVENT_PUBLISHER,
    QUEUE_SERVICE,
    KNOWLEDGE_REPOSITORY,
    AI_TRACE_REPOSITORY,
  ],
})
class MockApplicationDepsModule {}

describe('ApplicationModule', () => {
  it('registers CQRS command and event handlers', () => {
    expect(COMMAND_HANDLERS).toEqual([
      CreateAppointmentHandler,
      CancelAppointmentHandler,
      ProcessIncomingMessageHandler,
    ]);
    expect(EVENT_HANDLERS).toEqual([
      AppointmentCreatedEventHandler,
      AppointmentCancelledEventHandler,
    ]);
  });

  it('imports CqrsModule for CommandBus support', () => {
    const imports = Reflect.getMetadata('imports', ApplicationModule) as unknown[] | undefined;
    expect(imports ?? []).toContain(CqrsModule);
  });

  it('compiles with mocked domain dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockApplicationDepsModule, ApplicationModule],
    }).compile();

    expect(moduleRef.get(CreateAppointmentHandler)).toBeInstanceOf(CreateAppointmentHandler);
    expect(moduleRef.get(CancelAppointmentHandler)).toBeInstanceOf(CancelAppointmentHandler);
    expect(moduleRef.get(ProcessIncomingMessageHandler)).toBeInstanceOf(
      ProcessIncomingMessageHandler,
    );
  });
});
