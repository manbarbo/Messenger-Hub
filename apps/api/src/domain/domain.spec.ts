import { describe, expect, it } from 'vitest';
import {
  AI_TRACE_REPOSITORY,
  APPOINTMENT_REPOSITORY,
  CONVERSATION_REPOSITORY,
  DOCTOR_REPOSITORY,
  EMBEDDING_SERVICE,
  EVENT_PUBLISHER,
  KNOWLEDGE_REPOSITORY,
  LLM_SERVICE,
  MESSAGE_REPOSITORY,
  QUEUE_SERVICE,
  SLOT_REPOSITORY,
} from './index';
import { AppointmentCreatedEvent } from './events/appointment-created.event';
import { ConversationEscalatedEvent } from './events/conversation-escalated.event';

describe('DI tokens', () => {
  it('creates unique symbols for repositories and services', () => {
    const tokens = [
      APPOINTMENT_REPOSITORY,
      SLOT_REPOSITORY,
      KNOWLEDGE_REPOSITORY,
      CONVERSATION_REPOSITORY,
      MESSAGE_REPOSITORY,
      AI_TRACE_REPOSITORY,
      LLM_SERVICE,
      EMBEDDING_SERVICE,
      QUEUE_SERVICE,
      EVENT_PUBLISHER,
      DOCTOR_REPOSITORY,
    ];
    expect(new Set(tokens).size).toBe(tokens.length);
    tokens.forEach((token) => expect(typeof token).toBe('symbol'));
  });
});

describe('domain events', () => {
  it('AppointmentCreatedEvent exposes payload and occurredAt', () => {
    const event = new AppointmentCreatedEvent('apt-1', 'clinic-1', 'doc-1', 'slot-1', '+57300');
    expect(event.eventName).toBe('appointment.created');
    expect(event.aggregateId).toBe('apt-1');
    expect(event.clinicId).toBe('clinic-1');
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('ConversationEscalatedEvent exposes payload and occurredAt', () => {
    const event = new ConversationEscalatedEvent(
      'conv-1',
      'clinic-1',
      '+573001112233',
      'Límite de iteraciones',
    );
    expect(event.eventName).toBe('conversation.escalated');
    expect(event.aggregateId).toBe('conv-1');
    expect(event.clinicId).toBe('clinic-1');
    expect(event.patientPhone).toBe('+573001112233');
    expect(event.reason).toBe('Límite de iteraciones');
    expect(event.occurredAt).toBeInstanceOf(Date);
  });
});
