export class AppointmentNotFoundError extends Error {
  readonly appointmentId?: string;

  constructor(appointmentId?: string, message?: string) {
    super(message ?? `Appointment ${appointmentId ?? '(unknown)'} was not found`);
    this.name = 'AppointmentNotFoundError';
    this.appointmentId = appointmentId;
  }
}
