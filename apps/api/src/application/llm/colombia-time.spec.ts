import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  formatColombiaDate,
  formatColombiaDateTime,
  isColombiaDateInPast,
  isColombiaDateTimeInPast,
  isValidCalendarDate,
  parseColombiaDate,
  parseColombiaDateTime,
} from './colombia-time';

describe('colombia-time helpers', () => {
  it('formats current date in America/Bogota (UTC-5)', () => {
    const now = new Date('2026-10-02T02:30:00Z');
    expect(formatColombiaDate(now)).toBe('2026-10-01');
  });

  it('formats date-time in America/Bogota', () => {
    const now = new Date('2026-10-05T15:30:00Z');
    expect(formatColombiaDateTime(now)).toBe('2026-10-05 10:30');
  });

  it('validates real calendar dates only', () => {
    expect(isValidCalendarDate('2026-10-05')).toBe(true);
    expect(isValidCalendarDate('2026-02-30')).toBe(false);
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
    expect(isValidCalendarDate('05/10/2026')).toBe(false);
  });

  it('parses Colombia calendar date as start of day UTC-5', () => {
    expect(parseColombiaDate('2026-10-05').toISOString()).toBe('2026-10-05T05:00:00.000Z');
  });

  it('parses Colombia date-time to UTC', () => {
    expect(parseColombiaDateTime('2026-10-05', '08:30').toISOString()).toBe(
      '2026-10-05T13:30:00.000Z',
    );
  });

  it('detects past calendar dates relative to Colombia today', () => {
    const now = new Date('2026-10-05T15:00:00Z');
    expect(isColombiaDateInPast('2026-10-04', now)).toBe(true);
    expect(isColombiaDateInPast('2026-10-05', now)).toBe(false);
    expect(isColombiaDateInPast('2026-10-06', now)).toBe(false);
  });

  it('detects past date-times in Colombia', () => {
    const now = new Date('2026-10-05T14:00:00Z');
    expect(isColombiaDateTimeInPast('2026-10-05', '08:00', now)).toBe(true);
    expect(isColombiaDateTimeInPast('2026-10-05', '10:00', now)).toBe(false);
  });
});
