export enum AppointmentStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

/**
 * Allowed appointment lifecycle: CONFIRMED → CANCELLED only.
 * CANCELLED is terminal (book a new appointment instead of reconfirming).
 */
export const APPOINTMENT_TRANSITIONS: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> =
  {
    [AppointmentStatus.CONFIRMED]: [AppointmentStatus.CANCELLED],
    [AppointmentStatus.CANCELLED]: [],
  };

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_TRANSITIONS[from]?.includes(to) ?? false;
}
