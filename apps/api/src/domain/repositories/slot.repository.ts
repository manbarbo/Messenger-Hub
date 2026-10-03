import type { Slot } from '../entities/slot.entity';

export const SLOT_REPOSITORY = Symbol('SlotRepository');

export interface SlotRepository {
  findAvailable(clinicId: string, specialty: string, date: Date): Promise<Slot[]>;
  findById(id: string): Promise<Slot | null>;
  findByDoctorAndTime(doctorId: string, startTime: Date): Promise<Slot | null>;
  markAsBooked(id: string): Promise<void>;
  markAsAvailable(id: string): Promise<void>;
}
