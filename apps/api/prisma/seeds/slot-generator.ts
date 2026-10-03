import {
  COLOMBIA_UTC_OFFSET_HOURS,
  SLOT_DAY_END_HOUR,
  SLOT_DAY_START_HOUR,
  SLOT_DURATION_MINUTES,
  SLOT_WINDOW_DAYS,
} from './types';

const MINUTES_PER_SLOT = SLOT_DURATION_MINUTES;
const SLOTS_PER_DAY = ((SLOT_DAY_END_HOUR - SLOT_DAY_START_HOUR) * 60) / MINUTES_PER_SLOT;

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Builds UTC Date values that represent Colombia wall-clock times.
 * America/Bogota is UTC-5 year-round (no DST).
 */
export function colombiaLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(
    Date.UTC(year, month, day, hour + COLOMBIA_UTC_OFFSET_HOURS, minute, 0, 0),
  );
}

/**
 * Returns UTC Date values for slot start times over the next `windowDays`
 * calendar days (from "today" in Colombia), weekdays only, 8:00–17:30
 * Colombia time at 30-minute intervals.
 */
export function generateSlotStartTimes(now: Date = new Date()): Date[] {
  // America/Bogota is UTC-5: subtract to obtain Colombia calendar date from a UTC instant.
  const colombiaNow = new Date(now.getTime() - COLOMBIA_UTC_OFFSET_HOURS * 3_600_000);
  const year = colombiaNow.getUTCFullYear();
  const month = colombiaNow.getUTCMonth();
  const baseDay = colombiaNow.getUTCDate();

  const starts: Date[] = [];

  for (let dayOffset = 0; dayOffset < SLOT_WINDOW_DAYS; dayOffset += 1) {
    const probe = new Date(Date.UTC(year, month, baseDay + dayOffset, 12, 0, 0));
    if (isWeekend(probe)) {
      continue;
    }

    for (let slotIndex = 0; slotIndex < SLOTS_PER_DAY; slotIndex += 1) {
      const totalMinutes = SLOT_DAY_START_HOUR * 60 + slotIndex * MINUTES_PER_SLOT;
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      starts.push(colombiaLocalToUtc(year, month, baseDay + dayOffset, hour, minute));
    }
  }

  return starts;
}

export function slotEndTime(startTime: Date): Date {
  return new Date(startTime.getTime() + MINUTES_PER_SLOT * 60 * 1000);
}

export function formatSlotColombiaTime(startTime: Date): string {
  // UTC instant → Colombia wall clock (UTC-5)
  const colombia = new Date(startTime.getTime() - COLOMBIA_UTC_OFFSET_HOURS * 3_600_000);
  const hours = String(colombia.getUTCHours()).padStart(2, '0');
  const minutes = String(colombia.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function isSlotDayInPast(startTime: Date, now: Date = new Date()): boolean {
  return startTime.getTime() < now.getTime();
}
