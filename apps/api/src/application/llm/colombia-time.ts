const COLOMBIA_UTC_OFFSET_HOURS = 5;

export const COLOMBIA_TIME_ZONE = 'America/Bogota';

export function formatColombiaDate(now: Date = new Date()): string {
  const colombia = new Date(now.getTime() - COLOMBIA_UTC_OFFSET_HOURS * 3_600_000);
  const year = colombia.getUTCFullYear();
  const month = String(colombia.getUTCMonth() + 1).padStart(2, '0');
  const day = String(colombia.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatColombiaDateTime(now: Date = new Date()): string {
  const colombia = new Date(now.getTime() - COLOMBIA_UTC_OFFSET_HOURS * 3_600_000);
  const hours = String(colombia.getUTCHours()).padStart(2, '0');
  const minutes = String(colombia.getUTCMinutes()).padStart(2, '0');
  return `${formatColombiaDate(now)} ${hours}:${minutes}`;
}

export function isValidCalendarDate(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }
  const [year, month, day] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseColombiaDate(fecha: string): Date {
  const [year, month, day] = fecha.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, COLOMBIA_UTC_OFFSET_HOURS, 0, 0, 0));
}

export function parseColombiaDateTime(fecha: string, hora: string): Date {
  const [year, month, day] = fecha.split('-').map(Number);
  const [hour, minute] = hora.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + COLOMBIA_UTC_OFFSET_HOURS, minute, 0, 0));
}

export function isColombiaDateInPast(fecha: string, now: Date = new Date()): boolean {
  return fecha < formatColombiaDate(now);
}

export function isColombiaDateTimeInPast(
  fecha: string,
  hora: string,
  now: Date = new Date(),
): boolean {
  return parseColombiaDateTime(fecha, hora).getTime() < now.getTime();
}
