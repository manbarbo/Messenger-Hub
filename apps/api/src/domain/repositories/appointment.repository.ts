import type { Appointment } from '../entities/appointment.entity';

export const APPOINTMENT_REPOSITORY = Symbol('AppointmentRepository');

export interface AppointmentRepository {
  create(appointment: Appointment): Promise<Appointment>;
  findById(id: string): Promise<Appointment | null>;
  findBySlotId(slotId: string): Promise<Appointment | null>;
  findByPatientPhone(phone: string): Promise<Appointment[]>;
  update(appointment: Appointment): Promise<Appointment>;
}
