import { describe, expect, it } from 'vitest';
import {
  AppointmentStatus,
} from '../enums/appointment-status.enum';
import {
  assertAppointmentTransition,
  cancelAppointment,
  canCancelAppointment,
  type Appointment,
} from './appointment.entity';
import {
  assertConversationTransition,
  isTerminalConversation,
  transitionConversation,
  type Conversation,
} from './conversation.entity';
import {
  assertValidSlotRange,
  isAvailableSlot,
  isValidSlotRange,
} from './slot.entity';
import { ConversationStatus } from '../enums/conversation-status.enum';
import { ValidationError } from '../errors/validation.error';

const baseAppointment: Appointment = {
  id: 'apt-1',
  clinicId: 'clinic-1',
  doctorId: 'doc-1',
  slotId: 'slot-1',
  patientPhone: '+573001112233',
  patientName: 'Ana Pérez',
  status: AppointmentStatus.CONFIRMED,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
};

const baseConversation: Conversation = {
  id: 'conv-1',
  clinicId: 'clinic-1',
  patientPhone: '+573001112233',
  status: ConversationStatus.ACTIVE,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  lastMessageAt: new Date('2026-10-01T10:05:00Z'),
};

describe('Appointment entity', () => {
  it('allows cancelling a confirmed appointment', () => {
    expect(canCancelAppointment(baseAppointment)).toBe(true);
    const cancelled = cancelAppointment(baseAppointment);
    expect(cancelled.status).toBe(AppointmentStatus.CANCELLED);
    expect(cancelled.slotId).toBe(baseAppointment.slotId);
  });

  it('rejects cancelling an already cancelled appointment', () => {
    const cancelled: Appointment = { ...baseAppointment, status: AppointmentStatus.CANCELLED };
    expect(canCancelAppointment(cancelled)).toBe(false);
    expect(() => cancelAppointment(cancelled)).toThrow(ValidationError);
  });

  it('assertAppointmentTransition throws on invalid transition', () => {
    expect(() =>
      assertAppointmentTransition(AppointmentStatus.CANCELLED, AppointmentStatus.CONFIRMED),
    ).toThrow(ValidationError);
  });
});

describe('Conversation entity', () => {
  it('transitions active → escalated', () => {
    const escalated = transitionConversation(baseConversation, ConversationStatus.ESCALATED);
    expect(escalated.status).toBe(ConversationStatus.ESCALATED);
  });

  it('rejects transition out of terminal states', () => {
    const escalated: Conversation = { ...baseConversation, status: ConversationStatus.ESCALATED };
    expect(isTerminalConversation(ConversationStatus.ESCALATED)).toBe(true);
    expect(() => transitionConversation(escalated, ConversationStatus.ACTIVE)).toThrow(
      ValidationError,
    );
  });

  it('assertConversationTransition throws on invalid transition', () => {
    expect(() =>
      assertConversationTransition(ConversationStatus.APPOINTMENT_BOOKED, ConversationStatus.ACTIVE),
    ).toThrow(ValidationError);
  });
});

describe('Slot helpers', () => {
  const start = new Date('2026-10-05T15:00:00Z');
  const end = new Date('2026-10-05T15:30:00Z');

  it('validates start/end range', () => {
    expect(isValidSlotRange(start, end)).toBe(true);
    expect(isValidSlotRange(end, start)).toBe(false);
    expect(isValidSlotRange(start, start)).toBe(false);
  });

  it('assertValidSlotRange throws on invalid range', () => {
    expect(() => assertValidSlotRange(end, start)).toThrow(ValidationError);
  });

  it('detects available slots', () => {
    expect(isAvailableSlot({ isBooked: false, startTime: end }, start)).toBe(true);
    expect(isAvailableSlot({ isBooked: true, startTime: end }, start)).toBe(false);
    expect(isAvailableSlot({ isBooked: false, startTime: start }, end)).toBe(false);
  });
});
