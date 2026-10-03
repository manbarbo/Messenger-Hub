import {
  AppointmentStatus,
  canTransitionAppointment,
} from '../enums/appointment-status.enum';
import { ValidationError } from '../errors/validation.error';

export interface Appointment {
  readonly id: string;
  readonly clinicId: string;
  readonly doctorId: string;
  readonly slotId: string;
  readonly patientPhone: string;
  readonly patientName: string | null;
  readonly status: AppointmentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function canCancelAppointment(appointment: Pick<Appointment, 'status'>): boolean {
  return canTransitionAppointment(appointment.status, AppointmentStatus.CANCELLED);
}

export function assertAppointmentTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): void {
  if (!canTransitionAppointment(from, to)) {
    throw new ValidationError(
      `Invalid appointment status transition: ${from} → ${to}`,
      [{ field: 'status', message: `cannot transition from ${from} to ${to}` }],
    );
  }
}

export function cancelAppointment(appointment: Appointment, now: Date = new Date()): Appointment {
  assertAppointmentTransition(appointment.status, AppointmentStatus.CANCELLED);
  return {
    ...appointment,
    status: AppointmentStatus.CANCELLED,
    updatedAt: now,
  };
}
