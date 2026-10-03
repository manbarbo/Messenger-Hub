export class PastDateError extends Error {
  readonly date: Date;

  constructor(date: Date, message?: string) {
    super(
      message ??
        `Date ${date.toISOString()} is in the past (interpreted in America/Bogota)`,
    );
    this.name = 'PastDateError';
    this.date = date;
  }
}
