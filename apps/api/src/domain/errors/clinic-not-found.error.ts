export class ClinicNotFoundError extends Error {
  readonly clinicId?: string;

  constructor(clinicId?: string, message?: string) {
    super(message ?? `Clinic ${clinicId ?? '(unknown)'} was not found`);
    this.name = 'ClinicNotFoundError';
    this.clinicId = clinicId;
  }
}
