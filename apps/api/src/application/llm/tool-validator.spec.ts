import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clinic } from '@domain/entities/clinic.entity';
import type { Slot } from '@domain/entities/slot.entity';
import type { ClinicRepository } from '@domain/repositories/clinic.repository';
import type { DoctorRepository } from '@domain/repositories/doctor.repository';
import type { SlotRepository } from '@domain/repositories/slot.repository';
import type { Logger } from '@domain/services';
import { ToolValidator } from './tool-validator';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const clinic: Clinic = {
  id: 'clinic-1',
  name: 'Clínica Norte',
  address: 'Calle 10',
  phone: '+5715551234',
  timezone: 'America/Bogota',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function buildSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    id: 'slot-1',
    clinicId: 'clinic-1',
    doctorId: 'doc-1',
    startTime: new Date('2026-10-05T13:00:00Z'),
    endTime: new Date('2026-10-05T13:30:00Z'),
    isBooked: false,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

describe('ToolValidator', () => {
  let clinicRepository: { findByName: ReturnType<typeof vi.fn> };
  let doctorRepository: { existsByClinicAndSpecialty: ReturnType<typeof vi.fn> };
  let slotRepository: { findAvailable: ReturnType<typeof vi.fn> };
  let logger: Logger;
  let validator: ToolValidator;
  const context = { clinicId: 'clinic-1', now: new Date('2026-10-02T12:00:00Z') };

  beforeEach(() => {
    clinicRepository = { findByName: vi.fn() };
    doctorRepository = { existsByClinicAndSpecialty: vi.fn() };
    slotRepository = { findAvailable: vi.fn() };
    logger = createMockLogger();
    validator = new ToolValidator(
      logger,
      clinicRepository as unknown as ClinicRepository,
      doctorRepository as unknown as DoctorRepository,
      slotRepository as unknown as SlotRepository,
    );
  });

  it('rejects unknown tools with an LLM-readable error', async () => {
    const result = await validator.validate('inventar_tool', {}, context);
    expect(result).toEqual({ valid: false, error: 'Unknown tool: inventar_tool' });
  });

  it('returns Zod validation errors formatted for the LLM', async () => {
    const result = await validator.validate(
      'buscar_conocimiento',
      { pregunta: '' },
      context,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('Invalid arguments');
      expect(result.error).toContain('pregunta');
    }
  });

  it('validates buscar_conocimiento without repository lookups', async () => {
    const result = await validator.validate(
      'buscar_conocimiento',
      { pregunta: '¿Cuál es el horario?' },
      context,
    );
    expect(result).toEqual({
      valid: true,
      parsed: { pregunta: '¿Cuál es el horario?' },
    });
    expect(clinicRepository.findByName).not.toHaveBeenCalled();
  });

  it('validates escalar_a_humano without repository lookups', async () => {
    const result = await validator.validate(
      'escalar_a_humano',
      { motivo: 'El paciente pide hablar con alguien' },
      context,
    );
    expect(result.valid).toBe(true);
  });

  it('rejects past dates for consultar_disponibilidad in Colombia time', async () => {
    const result = await validator.validate(
      'consultar_disponibilidad',
      { especialidad: 'Dermatologia', sede: 'Clínica Norte', fecha: '2026-10-01' },
      context,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('ya pasó');
    }
  });

  it('rejects unknown sede', async () => {
    clinicRepository.findByName.mockResolvedValue(null);

    const result = await validator.validate(
      'consultar_disponibilidad',
      { especialidad: 'Dermatologia', sede: 'Clínica Sur', fecha: '2026-10-05' },
      context,
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('No se encontró la sede');
    }
  });

  it('rejects specialty that does not exist at the clinic', async () => {
    clinicRepository.findByName.mockResolvedValue(clinic);
    doctorRepository.existsByClinicAndSpecialty.mockResolvedValue(false);

    const result = await validator.validate(
      'consultar_disponibilidad',
      { especialidad: 'Neurologia', sede: 'Clínica Norte', fecha: '2026-10-05' },
      context,
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('Neurologia');
    }
  });

  it('accepts valid consultar_disponibilidad and enriches clinicId', async () => {
    clinicRepository.findByName.mockResolvedValue(clinic);
    doctorRepository.existsByClinicAndSpecialty.mockResolvedValue(true);

    const result = await validator.validate(
      'consultar_disponibilidad',
      { especialidad: 'Dermatologia', sede: 'Clínica Norte', fecha: '2026-10-05' },
      context,
    );

    expect(result).toEqual({
      valid: true,
      parsed: {
        especialidad: 'Dermatologia',
        sede: 'Clínica Norte',
        fecha: '2026-10-05',
        clinicId: 'clinic-1',
      },
    });
    expect(doctorRepository.existsByClinicAndSpecialty).toHaveBeenCalledWith(
      'clinic-1',
      'Dermatologia',
    );
  });

  it('enforces clinic tenant match for sede', async () => {
    clinicRepository.findByName.mockResolvedValue({ ...clinic, id: 'clinic-other' });

    const result = await validator.validate(
      'consultar_disponibilidad',
      { especialidad: 'Dermatologia', sede: 'Clínica Norte', fecha: '2026-10-05' },
      context,
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('no pertenece a esta clínica');
    }
  });

  it('rejects agendar_cita when no slot matches fecha/hora', async () => {
    clinicRepository.findByName.mockResolvedValue(clinic);
    doctorRepository.existsByClinicAndSpecialty.mockResolvedValue(true);
    slotRepository.findAvailable.mockResolvedValue([buildSlot({ startTime: new Date('2026-10-05T14:00:00Z') })]);

    const result = await validator.validate(
      'agendar_cita',
      {
        especialidad: 'Dermatologia',
        sede: 'Clínica Norte',
        fecha: '2026-10-05',
        hora: '08:30',
        paciente_telefono: '+573001234567',
      },
      context,
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('No hay disponibilidad');
    }
  });

  it('accepts agendar_cita when a matching available slot exists and enriches slot data', async () => {
    clinicRepository.findByName.mockResolvedValue(clinic);
    doctorRepository.existsByClinicAndSpecialty.mockResolvedValue(true);
    slotRepository.findAvailable.mockResolvedValue([
      buildSlot({ id: 'slot-9', doctorId: 'doc-9', startTime: new Date('2026-10-05T13:30:00Z') }),
    ]);

    const result = await validator.validate(
      'agendar_cita',
      {
        especialidad: 'Dermatologia',
        sede: 'Clínica Norte',
        fecha: '2026-10-05',
        hora: '08:30',
        paciente_telefono: '+573001234567',
        paciente_nombre: 'Ana',
      },
      context,
    );

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.parsed).toMatchObject({
        clinicId: 'clinic-1',
        slotId: 'slot-9',
        doctorId: 'doc-9',
        startUtc: '2026-10-05T13:30:00.000Z',
        paciente_nombre: 'Ana',
      });
    }
  });

  it('rejects past date-time for agendar_cita on the current day', async () => {
    const now = new Date('2026-10-05T14:00:00Z');
    clinicRepository.findByName.mockResolvedValue(clinic);
    doctorRepository.existsByClinicAndSpecialty.mockResolvedValue(true);

    const result = await validator.validate(
      'agendar_cita',
      {
        especialidad: 'Dermatologia',
        sede: 'Clínica Norte',
        fecha: '2026-10-05',
        hora: '08:00',
        paciente_telefono: '+573001234567',
      },
      { clinicId: 'clinic-1', now },
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('ya pasó');
    }
  });

  it('exposes OpenAI tool definitions', () => {
    const definitions = validator.getToolDefinitions();
    expect(definitions.map((d) => d.name)).toContain('agendar_cita');
  });
});
