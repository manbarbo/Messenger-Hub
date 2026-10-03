import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AppointmentCreatedEventHandler } from './appointment-created.handler';
import { AppointmentCancelledEventHandler } from './appointment-cancelled.handler';
import { AppointmentCreatedEvent } from '@domain/events/appointment-created.event';
import { AppointmentCancelledEvent } from '@domain/events/appointment-cancelled.event';
import { ConversationEscalatedEvent } from '@domain/events/conversation-escalated.event';

describe('application event handlers', () => {
  it('AppointmentCreatedEventHandler handles appointment.created events', () => {
    const handler = new AppointmentCreatedEventHandler();
    const event = new AppointmentCreatedEvent('apt-1', 'clinic-1', 'doc-1', 'slot-1', '+573');
    expect(() => handler.handle(event)).not.toThrow();
  });

  it('AppointmentCancelledEventHandler handles appointment.cancelled events', () => {
    const handler = new AppointmentCancelledEventHandler();
    const event = new AppointmentCancelledEvent('apt-1', 'clinic-1', 'doc-1', 'slot-1');
    expect(() => handler.handle(event)).not.toThrow();
  });

  it('ConversationEscalatedEvent can be constructed for future handlers', () => {
    const event = new ConversationEscalatedEvent('conv-1', 'clinic-1', '+573', 'reason');
    expect(event.eventName).toBe('conversation.escalated');
    expect(event.aggregateId).toBe('conv-1');
  });
});
