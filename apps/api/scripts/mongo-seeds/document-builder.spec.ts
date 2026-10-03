import { describe, expect, it } from 'vitest';
import { buildMongoSeedDocuments, colombiaDateOnly, estimateCostUsd, resolvePlaceholders, tomorrowColombiaDate } from './document-builder';
import { SEED_CONVERSATION_SPECS } from './sample-conversations';

const clinicIdByName = new Map([
  ['Clínica Norte', 'clinic-norte-id'],
  ['Clínica Sur', 'clinic-sur-id'],
]);

const baseTime = new Date(Date.UTC(2026, 9, 3, 15, 0, 0)); // 2026-10-03 10:00 Colombia

describe('mongo seed document builder', () => {
  it('resolves Colombia date helpers', () => {
    expect(colombiaDateOnly(baseTime)).toBe('2026-10-03');
    expect(tomorrowColombiaDate(baseTime)).toBe('2026-10-04');
  });

  it('replaces date placeholders in nested objects', () => {
    const result = resolvePlaceholders(
      {
        fecha: '{{tomorrow_colombia}}',
        nested: [{ fecha: '{{tomorrow_colombia}}' }],
      },
      { '{{tomorrow_colombia}}': '2026-10-04' },
    );

    expect(result).toEqual({
      fecha: '2026-10-04',
      nested: [{ fecha: '2026-10-04' }],
    });
  });

  it('estimates token cost', () => {
    expect(estimateCostUsd(1000, 0)).toBe(0.0005);
    expect(estimateCostUsd(0, 1000)).toBe(0.0015);
  });

  it('builds conversations, messages, and traces linked to clinic ids', () => {
    const built = buildMongoSeedDocuments(SEED_CONVERSATION_SPECS, clinicIdByName, { baseTime });

    expect(built.conversations).toHaveLength(3);
    expect(built.messages).toHaveLength(
      SEED_CONVERSATION_SPECS.reduce((sum, spec) => sum + spec.messages.length, 0),
    );
    expect(built.aiTraces).toHaveLength(
      SEED_CONVERSATION_SPECS.reduce((sum, spec) => sum + spec.traces.length, 0),
    );

    const conversationById = new Map(built.conversations.map((c) => [c._id, c]));
    for (const spec of SEED_CONVERSATION_SPECS) {
      const conversation = conversationById.get(spec.id);
      expect(conversation).toBeDefined();
      expect(conversation?.clinicId).toBe(clinicIdByName.get(spec.clinicName));
      expect(conversation?.status).toBe(spec.status);

      const messages = built.messages.filter((m) => m.conversationId === spec.id);
      expect(messages).toHaveLength(spec.messages.length);
      expect(messages.every((m) => m.clinicId === conversation?.clinicId)).toBe(true);

      const traces = built.aiTraces.filter((t) => t.conversationId === spec.id);
      expect(traces).toHaveLength(spec.traces.length);
      expect(traces.every((t) => t.clinicId === conversation?.clinicId)).toBe(true);
    }
  });

  it('sets lastMessageAt from the latest message offset', () => {
    const built = buildMongoSeedDocuments(SEED_CONVERSATION_SPECS, clinicIdByName, { baseTime });
    const booked = built.conversations.find((c) => c._id === 'seed-conv-booked-002');
    expect(booked?.lastMessageAt).toEqual(new Date(baseTime.getTime() + 7 * 60 * 1000));
  });

  it('replaces {{tomorrow_colombia}} inside tool call arguments and results', () => {
    const built = buildMongoSeedDocuments(SEED_CONVERSATION_SPECS, clinicIdByName, { baseTime });
    const bookedTraces = built.aiTraces.filter((t) => t.conversationId === 'seed-conv-booked-002');

    const availabilityArgs = bookedTraces[0]?.toolsCalled[0]?.arguments as {
      fecha: string;
    };
    const bookingArgs = bookedTraces[1]?.toolsCalled[0]?.arguments as {
      fecha: string;
      hora: string;
    };

    expect(availabilityArgs.fecha).toBe('2026-10-04');
    expect(bookingArgs.fecha).toBe('2026-10-04');
    expect(bookingArgs.hora).toBe('10:00');

    const bookingResult = bookedTraces[1]?.toolsCalled[0]?.result as {
      startTime: string;
    };
    expect(bookingResult.startTime).toContain('2026-10-04');
  });

  it('throws when a clinic id is missing', () => {
    expect(() =>
      buildMongoSeedDocuments(SEED_CONVERSATION_SPECS, new Map(), { baseTime }),
    ).toThrow(/Clinic id not found/);
  });

  it('generates stable message and trace ids', () => {
    const built = buildMongoSeedDocuments(SEED_CONVERSATION_SPECS, clinicIdByName, { baseTime });
    const messageIds = built.messages.map((m) => m._id);
    const traceIds = built.aiTraces.map((t) => t._id);
    expect(new Set(messageIds).size).toBe(messageIds.length);
    expect(new Set(traceIds).size).toBe(traceIds.length);
  });
});
