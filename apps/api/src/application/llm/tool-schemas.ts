import { z } from 'zod';
import { isValidCalendarDate } from './colombia-time';

export const BuscarConocimientoSchema = z.object({
  pregunta: z.string().min(1, 'La pregunta no puede estar vacía'),
});

const FechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
  .refine(isValidCalendarDate, 'Fecha de calendario inválida');

const HoraSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:mm)');

export const ConsultarDisponibilidadSchema = z.object({
  especialidad: z.string().min(1, 'La especialidad no puede estar vacía'),
  sede: z.string().min(1, 'La sede no puede estar vacía'),
  fecha: FechaSchema,
});

export const AgendarCitaSchema = ConsultarDisponibilidadSchema.extend({
  hora: HoraSchema,
  paciente_telefono: z
    .string()
    .min(7, 'El teléfono debe tener al menos 7 dígitos')
    .max(20, 'El teléfono es demasiado largo')
    .regex(/^\+?[\d\s\-()]+$/, 'Formato de teléfono inválido'),
  paciente_nombre: z.string().min(1).optional(),
});

export const EscalarAHumanoSchema = z.object({
  motivo: z.string().min(1, 'El motivo no puede estar vacío'),
});

export const TOOL_SCHEMAS = {
  buscar_conocimiento: BuscarConocimientoSchema,
  consultar_disponibilidad: ConsultarDisponibilidadSchema,
  agendar_cita: AgendarCitaSchema,
  escalar_a_humano: EscalarAHumanoSchema,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

export type BuscarConocimientoArgs = z.infer<typeof BuscarConocimientoSchema>;
export type ConsultarDisponibilidadArgs = z.infer<typeof ConsultarDisponibilidadSchema>;
export type AgendarCitaArgs = z.infer<typeof AgendarCitaSchema>;
export type EscalarAHumanoArgs = z.infer<typeof EscalarAHumanoSchema>;
