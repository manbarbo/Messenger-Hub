import { describe, expect, it } from 'vitest';
import {
  colombiaLocalToUtc,
  formatSlotColombiaTime,
  generateSlotStartTimes,
  isSlotDayInPast,
  isWeekend,
  slotEndTime,
} from './slot-generator';
import {
  SLOT_DAY_END_HOUR,
  SLOT_DAY_START_HOUR,
  SLOT_DURATION_MINUTES,
  SLOT_WINDOW_DAYS,
} from './types';

describe('slot generator', () => {
  it('maps Colombia local time to UTC with fixed UTC-5 offset', () => {
    const utc = colombiaLocalToUtc(2026, 9, 5, 8, 0);
    expect(utc.toISOString()).toBe('2026-10-05T13:00:00.000Z');
  });

  it('marks Saturday and Sunday as weekends', () => {
    expect(isWeekend(new Date(Date.UTC(2026, 9, 3, 12)))).toBe(true);
    expect(isWeekend(new Date(Date.UTC(2026, 9, 4, 12)))).toBe(true);
    expect(isWeekend(new Date(Date.UTC(2026, 9, 5, 12)))).toBe(false);
  });

  it('generates only weekday slot starts', () => {
    // Wednesday 2026-09-30 10:00 UTC → Colombia 05:00 same day
    const now = new Date(Date.UTC(2026, 8, 30, 10, 0, 0));
    const starts = generateSlotStartTimes(now);

    expect(starts.length).toBeGreaterThan(0);
    for (const start of starts) {
      expect(isWeekend(start)).toBe(false);
    }
  });

  it('uses 30-minute intervals from 8:00 to 17:30 Colombia time', () => {
    const now = new Date(Date.UTC(2026, 8, 30, 10, 0, 0));
    const starts = generateSlotStartTimes(now);
    const firstDayStarts = starts.slice(0, 20);

    expect(firstDayStarts).toHaveLength(20);
    expect(formatSlotColombiaTime(firstDayStarts[0]!)).toBe('08:00');
    expect(formatSlotColombiaTime(firstDayStarts[1]!)).toBe('08:30');
    expect(formatSlotColombiaTime(firstDayStarts[19]!)).toBe('17:30');

    for (let i = 1; i < firstDayStarts.length; i += 1) {
      const diffMs = firstDayStarts[i]!.getTime() - firstDayStarts[i - 1]!.getTime();
      expect(diffMs).toBe(SLOT_DURATION_MINUTES * 60 * 1000);
    }
  });

  it('computes slot end times 30 minutes after start', () => {
    const start = colombiaLocalToUtc(2026, 9, 5, 8, 0);
    const end = slotEndTime(start);
    expect(end.getTime() - start.getTime()).toBe(30 * 60 * 1000);
    expect(formatSlotColombiaTime(end)).toBe('08:30');
  });

  it('covers the configured 14-day window with weekday-only days', () => {
    // Monday 2026-10-05 15:00 UTC → Colombia 10:00
    const now = new Date(Date.UTC(2026, 9, 5, 15, 0, 0));
    const starts = generateSlotStartTimes(now);

    const uniqueDays = new Set(
      starts.map((d) => {
        const colombia = new Date(d.getTime() - 5 * 3_600_000);
        return `${colombia.getUTCFullYear()}-${colombia.getUTCMonth()}-${colombia.getUTCDate()}`;
      }),
    );

    expect(uniqueDays.size).toBeLessThanOrEqual(SLOT_WINDOW_DAYS);
    expect(uniqueDays.size).toBeGreaterThanOrEqual(9);
  });

  it('flags past slot starts relative to now', () => {
    const past = colombiaLocalToUtc(2026, 0, 1, 8, 0);
    const future = colombiaLocalToUtc(2030, 0, 1, 8, 0);
    const now = new Date(Date.UTC(2026, 9, 1));

    expect(isSlotDayInPast(past, now)).toBe(true);
    expect(isSlotDayInPast(future, now)).toBe(false);
  });

  it('keeps day range constants aligned with acceptance criteria', () => {
    expect(SLOT_DAY_START_HOUR).toBe(8);
    expect(SLOT_DAY_END_HOUR).toBe(18);
    expect(SLOT_DURATION_MINUTES).toBe(30);
    expect(SLOT_WINDOW_DAYS).toBe(14);
  });
});
