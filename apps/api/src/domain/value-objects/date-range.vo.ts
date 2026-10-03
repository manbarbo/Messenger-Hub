import { ValidationError } from '../errors/validation.error';

export class DateRange {
  readonly start: Date;
  readonly end: Date;

  constructor(start: Date, end: Date) {
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
      throw new ValidationError('DateRange start must be a valid Date', [
        { field: 'start', message: 'invalid date' },
      ]);
    }
    if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
      throw new ValidationError('DateRange end must be a valid Date', [
        { field: 'end', message: 'invalid date' },
      ]);
    }
    if (end.getTime() <= start.getTime()) {
      throw new ValidationError('DateRange end must be after start', [
        { field: 'end', message: 'must be after start' },
      ]);
    }
    this.start = start;
    this.end = end;
  }

  contains(date: Date): boolean {
    const t = date.getTime();
    return t >= this.start.getTime() && t <= this.end.getTime();
  }

  durationMs(): number {
    return this.end.getTime() - this.start.getTime();
  }
}
