export const DOCTOR_REPOSITORY = Symbol('DoctorRepository');

export interface DoctorRepository {
  existsByClinicAndSpecialty(clinicId: string, specialty: string): Promise<boolean>;
}
