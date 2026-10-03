import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AgendarCitaSchema, BuscarConocimientoSchema, ConsultarDisponibilidadSchema, EscalarAHumanoSchema } from './tool-schemas';

describe('tool schemas', () => {
  it('accepts valid buscar_conocimiento args', () => {
    const result = BuscarConocimientoSchema.safeParse({ pregunta: '¿A qué hora atienden?' });
    expect(result.success).toBe(true);
  });

  it('rejects empty pregunta', () => {
    const result = BuscarConocimientoSchema.safeParse({ pregunta: '' });
    expect(result.success).toBe(false);
  });

  it('accepts valid consultar_disponibilidad args', () => {
    const result = ConsultarDisponibilidadSchema.safeParse({
      especialidad: 'Dermatologia',
      sede: 'Clínica Norte',
      fecha: '2026-10-05',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid fecha format and calendar dates', () => {
    expect(
      ConsultarDisponibilidadSchema.safeParse({
        especialidad: 'Dermatologia',
        sede: 'Norte',
        fecha: '05-10-2026',
      }).success,
    ).toBe(false);
    expect(
      ConsultarDisponibilidadSchema.safeParse({
        especialidad: 'Dermatologia',
        sede: 'Norte',
        fecha: '2026-02-30',
      }).success,
    ).toBe(false);
  });

  it('accepts valid agendar_cita args and optional patient name', () => {
    const result = AgendarCitaSchema.safeParse({
      especialidad: 'Dermatologia',
      sede: 'Clínica Norte',
      fecha: '2026-10-05',
      hora: '08:30',
      paciente_telefono: '+573001234567',
      paciente_nombre: 'Ana Pérez',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid hora and phone', () => {
    expect(
      AgendarCitaSchema.safeParse({
        especialidad: 'Dermatologia',
        sede: 'Norte',
        fecha: '2026-10-05',
        hora: '25:99',
        paciente_telefono: '+573001234567',
      }).success,
    ).toBe(false);
    expect(
      AgendarCitaSchema.safeParse({
        especialidad: 'Dermatologia',
        sede: 'Norte',
        fecha: '2026-10-05',
        hora: '08:30',
        paciente_telefono: 'abc',
      }).success,
    ).toBe(false);
  });

  it('requires motivo for escalar_a_humano', () => {
    expect(EscalarAHumanoSchema.safeParse({ motivo: 'No entendí' }).success).toBe(true);
    expect(EscalarAHumanoSchema.safeParse({ motivo: '' }).success).toBe(false);
  });
});
