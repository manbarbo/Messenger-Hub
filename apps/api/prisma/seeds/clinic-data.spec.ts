import { describe, expect, it } from 'vitest';
import { SEED_CLINICS, SEED_DOCTORS } from './clinic-data';
import {
  COLOMBIA_UTC_OFFSET_HOURS,
  SEED_SPECIALTIES,
  SEED_TARGET_CLINIC_NAMES,
  toPgVector,
} from './types';

describe('seed clinic data', () => {
  it('defines the two target clinics', () => {
    expect(SEED_CLINICS).toHaveLength(2);
    expect(SEED_CLINICS.map((c) => c.name)).toEqual(['Clínica Norte', 'Clínica Sur']);
    expect(SEED_CLINICS[0]?.address).toContain('Cali');
    expect(SEED_CLINICS[1]?.address).toContain('Bogotá');
  });

  it('uses America/Bogota timezone for both clinics', () => {
    for (const clinic of SEED_CLINICS) {
      expect(clinic.timezone).toBe('America/Bogota');
    }
  });

  it('seeds at least 6 doctors with non-empty names', () => {
    expect(SEED_DOCTORS.length).toBeGreaterThanOrEqual(6);
    for (const doctor of SEED_DOCTORS) {
      expect(doctor.name.length).toBeGreaterThan(0);
      expect(doctor.specialty.length).toBeGreaterThan(0);
      expect(doctor.clinicName.length).toBeGreaterThan(0);
    }
  });

  it('uses at least 3 specialties from the target list', () => {
    const specialties = new Set(SEED_DOCTORS.map((d) => d.specialty));
    expect(specialties.size).toBeGreaterThanOrEqual(3);
    for (const specialty of specialties) {
      expect(SEED_SPECIALTIES).toContain(specialty);
    }
  });

  it('references only seeded clinics and distributes doctors across both', () => {
    const clinicNames = new Set(SEED_CLINICS.map((c) => c.name));
    const used = new Set(SEED_DOCTORS.map((d) => d.clinicName));

    for (const doctor of SEED_DOCTORS) {
      expect(clinicNames.has(doctor.clinicName)).toBe(true);
    }
    expect(used.has('Clínica Norte')).toBe(true);
    expect(used.has('Clínica Sur')).toBe(true);
  });

  it('keeps target clinic names aligned with plan constants', () => {
    expect([...SEED_TARGET_CLINIC_NAMES]).toEqual(SEED_CLINICS.map((c) => c.name));
    expect(COLOMBIA_UTC_OFFSET_HOURS).toBe(5);
  });

  it('formats pgvector literals correctly', () => {
    expect(toPgVector([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
  });
});
