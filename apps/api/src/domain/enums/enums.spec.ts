import { describe, expect, it } from 'vitest';
import { AppointmentStatus, canTransitionAppointment } from './appointment-status.enum';
import { ConversationStatus, canTransitionConversation } from './conversation-status.enum';

describe('AppointmentStatus', () => {
  it('exposes CONFIRMED and CANCELLED', () => {
    expect(AppointmentStatus.CONFIRMED).toBe('CONFIRMED');
    expect(AppointmentStatus.CANCELLED).toBe('CANCELLED');
  });

  it('allows CONFIRMED → CANCELLED', () => {
    expect(canTransitionAppointment(AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED)).toBe(
      true,
    );
  });

  it('rejects CANCELLED → CONFIRMED', () => {
    expect(canTransitionAppointment(AppointmentStatus.CANCELLED, AppointmentStatus.CONFIRMED)).toBe(
      false,
    );
  });

  it('rejects CANCELLED → CANCELLED', () => {
    expect(canTransitionAppointment(AppointmentStatus.CANCELLED, AppointmentStatus.CANCELLED)).toBe(
      false,
    );
  });

  it('rejects CONFIRMED → CONFIRMED', () => {
    expect(canTransitionAppointment(AppointmentStatus.CONFIRMED, AppointmentStatus.CONFIRMED)).toBe(
      false,
    );
  });

  it('returns false for unknown appointment statuses', () => {
    expect(canTransitionAppointment('UNKNOWN' as AppointmentStatus, AppointmentStatus.CANCELLED)).toBe(
      false,
    );
  });
});

describe('ConversationStatus', () => {
  it('uses DESIGN.md storage values', () => {
    expect(ConversationStatus.ACTIVE).toBe('active');
    expect(ConversationStatus.RESOLVED_BY_AI).toBe('resolved_by_ai');
    expect(ConversationStatus.APPOINTMENT_BOOKED).toBe('appointment_booked');
    expect(ConversationStatus.ESCALATED).toBe('escalated');
  });

  it('allows active → resolved_by_ai / appointment_booked / escalated', () => {
    expect(canTransitionConversation(ConversationStatus.ACTIVE, ConversationStatus.RESOLVED_BY_AI)).toBe(
      true,
    );
    expect(
      canTransitionConversation(ConversationStatus.ACTIVE, ConversationStatus.APPOINTMENT_BOOKED),
    ).toBe(true);
    expect(canTransitionConversation(ConversationStatus.ACTIVE, ConversationStatus.ESCALATED)).toBe(
      true,
    );
  });

  it('does not allow terminal states to transition', () => {
    expect(
      canTransitionConversation(ConversationStatus.RESOLVED_BY_AI, ConversationStatus.ACTIVE),
    ).toBe(false);
    expect(
      canTransitionConversation(ConversationStatus.APPOINTMENT_BOOKED, ConversationStatus.ACTIVE),
    ).toBe(false);
    expect(
      canTransitionConversation(ConversationStatus.ESCALATED, ConversationStatus.ACTIVE),
    ).toBe(false);
  });

  it('rejects transitions to the same conversation status', () => {
    expect(
      canTransitionConversation(ConversationStatus.ACTIVE, ConversationStatus.ACTIVE),
    ).toBe(false);
    expect(
      canTransitionConversation(ConversationStatus.RESOLVED_BY_AI, ConversationStatus.RESOLVED_BY_AI),
    ).toBe(false);
  });

  it('returns false for unknown conversation statuses', () => {
    expect(
      canTransitionConversation('unknown' as ConversationStatus, ConversationStatus.ACTIVE),
    ).toBe(false);
  });
});
