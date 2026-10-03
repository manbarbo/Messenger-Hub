import { describe, expect, it } from 'vitest';
import { SEED_CONVERSATION_SPECS } from './sample-conversations';
import { SEED_CLINIC_NAMES } from './types';

describe('mongo sample conversations', () => {
  it('defines 3 conversations', () => {
    expect(SEED_CONVERSATION_SPECS).toHaveLength(3);
  });

  it('covers required terminal statuses', () => {
    const statuses = SEED_CONVERSATION_SPECS.map((c) => c.status);
    expect(statuses).toContain('resolved_by_ai');
    expect(statuses).toContain('appointment_booked');
    expect(statuses).toContain('escalated');
  });

  it('maps statuses to trace finalStatus correctly', () => {
    const expected: Record<string, string> = {
      resolved_by_ai: 'resuelta_por_ia',
      appointment_booked: 'cita_agendada',
      escalated: 'escalada',
    };

    for (const conversation of SEED_CONVERSATION_SPECS) {
      const lastTrace = conversation.traces[conversation.traces.length - 1];
      expect(lastTrace?.finalStatus).toBe(expected[conversation.status]);
    }
  });

  it('gives each conversation 4–8 messages', () => {
    for (const conversation of SEED_CONVERSATION_SPECS) {
      expect(conversation.messages.length).toBeGreaterThanOrEqual(4);
      expect(conversation.messages.length).toBeLessThanOrEqual(8);
    }
  });

  it('alternates user and assistant messages', () => {
    for (const conversation of SEED_CONVERSATION_SPECS) {
      conversation.messages.forEach((message, index) => {
        if (index % 2 === 0) {
          expect(message.role).toBe('user');
          expect(message.direction).toBe('inbound');
        } else {
          expect(message.role).toBe('assistant');
          expect(message.direction).toBe('outbound');
        }
      });
    }
  });

  it('uses unique conversation ids and patient phones', () => {
    const ids = SEED_CONVERSATION_SPECS.map((c) => c.id);
    const phones = SEED_CONVERSATION_SPECS.map((c) => c.patientPhone);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(phones).size).toBe(phones.length);
  });

  it('includes AI traces with tool calls for assistant turns', () => {
    for (const conversation of SEED_CONVERSATION_SPECS) {
      expect(conversation.traces.length).toBeGreaterThan(0);
      for (const trace of conversation.traces) {
        expect(trace.toolsCalled.length).toBeGreaterThan(0);
        expect(trace.turnIndex).toBeGreaterThan(0);
        for (const tool of trace.toolsCalled) {
          expect(tool.name.length).toBeGreaterThan(0);
          expect(tool.success).toBe(true);
        }
      }
    }
  });

  it('uses only seeded clinic names and E.164 phones', () => {
    for (const conversation of SEED_CONVERSATION_SPECS) {
      expect(SEED_CLINIC_NAMES).toContain(conversation.clinicName);
      expect(conversation.patientPhone).toMatch(/^\+57\d{10}$/);
    }
  });

  it('includes WhatsApp messageIds on inbound messages for idempotency', () => {
    for (const conversation of SEED_CONVERSATION_SPECS) {
      const inbound = conversation.messages.filter((m) => m.direction === 'inbound');
      expect(inbound.length).toBeGreaterThan(0);
      for (const message of inbound) {
        expect(message.messageId).toBeTruthy();
      }
    }
  });
});
