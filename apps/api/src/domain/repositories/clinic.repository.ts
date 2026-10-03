import type { Clinic } from '../entities/clinic.entity';

export const CLINIC_REPOSITORY = Symbol('ClinicRepository');

export interface ClinicRepository {
  findById(id: string): Promise<Clinic | null>;
  findByName(name: string): Promise<Clinic | null>;
}
