export interface SeedClinicInput {
  name: string;
  address: string;
  phone: string;
  timezone: string;
}

export interface SeedDoctorInput {
  name: string;
  specialty: string;
  clinicName: string;
}

export interface SeedKnowledgeDocumentInput {
  clinicName: string;
  title: string;
  content: string;
  category: SeedKnowledgeCategory;
}

export type SeedKnowledgeCategory =
  | 'horarios'
  | 'sedes'
  | 'preparacion_examenes'
  | 'politicas_cancelacion'
  | 'servicios'
  | 'contacto';

export interface SeedSlotInput {
  clinicName: string;
  doctorName: string;
  startTime: Date;
  endTime: Date;
}

export const SEED_TARGET_CLINIC_NAMES = ['Clínica Norte', 'Clínica Sur'] as const;

export const SEED_SPECIALTIES = [
  'Medicina General',
  'Dermatología',
  'Cardiología',
  'Pediatría',
] as const;

export const COLOMBIA_UTC_OFFSET_HOURS = 5;
export const SLOT_DURATION_MINUTES = 30;
export const SLOT_DAY_START_HOUR = 8;
export const SLOT_DAY_END_HOUR = 18;
export const SLOT_WINDOW_DAYS = 14;

export function toPgVector(values: number[]): string {
  return `[${values.join(',')}]`;
}
