import { Inject, Injectable } from '@nestjs/common';
import type { Slot } from '@domain/entities/slot.entity';
import {
  CLINIC_REPOSITORY,
  DOCTOR_REPOSITORY,
  SLOT_REPOSITORY,
  type ClinicRepository,
  type DoctorRepository,
  type SlotRepository,
} from '@domain/repositories';
import type { LLMToolDefinition } from '@domain/value-objects/llm-chat.vo';
import { TOOL_DEFINITIONS } from './tool-definitions';
import { TOOL_SCHEMAS, type ToolName } from './tool-schemas';
import {
  isColombiaDateInPast,
  isColombiaDateTimeInPast,
  parseColombiaDateTime,
} from './colombia-time';

export interface ToolValidationContext {
  readonly clinicId: string;
  readonly now?: Date;
}

export type ToolValidationResult =
  | { readonly valid: true; readonly parsed: Record<string, unknown> }
  | { readonly valid: false; readonly error: string };

function formatZodErrors(error: { errors: Array<{ path: PropertyKey[]; message: string }> }): string {
  const details = error.errors
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(', ');
  return `Invalid arguments: ${details}`;
}

function slotMatchesRequestedTime(slot: Slot, fecha: string, hora: string): boolean {
  const target = parseColombiaDateTime(fecha, hora);
  return slot.startTime.getTime() === target.getTime();
}

@Injectable()
export class ToolValidator {
  constructor(
    @Inject(CLINIC_REPOSITORY) private readonly clinicRepository: ClinicRepository,
    @Inject(DOCTOR_REPOSITORY) private readonly doctorRepository: DoctorRepository,
    @Inject(SLOT_REPOSITORY) private readonly slotRepository: SlotRepository,
  ) {}

  getToolDefinitions(): readonly LLMToolDefinition[] {
    return TOOL_DEFINITIONS;
  }

  isKnownTool(toolName: string): toolName is ToolName {
    return Object.prototype.hasOwnProperty.call(TOOL_SCHEMAS, toolName);
  }

  async validate(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolValidationContext,
  ): Promise<ToolValidationResult> {
    if (!this.isKnownTool(toolName)) {
      return { valid: false, error: `Unknown tool: ${toolName}` };
    }

    const schema = TOOL_SCHEMAS[toolName];
    const result = schema.safeParse(args);
    if (!result.success) {
      return { valid: false, error: formatZodErrors(result.error) };
    }

    switch (toolName) {
      case 'buscar_conocimiento':
      case 'escalar_a_humano':
        return { valid: true, parsed: result.data as Record<string, unknown> };

      case 'consultar_disponibilidad':
        return this.validateAvailabilityArgs(
          result.data as { especialidad: string; sede: string; fecha: string },
          context,
        );

      case 'agendar_cita':
        return this.validateBookingArgs(
          result.data as {
            especialidad: string;
            sede: string;
            fecha: string;
            hora: string;
            paciente_telefono: string;
            paciente_nombre?: string;
          },
          context,
        );

      default:
        return { valid: false, error: `Unknown tool: ${toolName}` };
    }
  }

  private async validateAvailabilityArgs(
    data: { especialidad: string; sede: string; fecha: string },
    context: ToolValidationContext,
  ): Promise<ToolValidationResult> {
    const now = context.now ?? new Date();

    if (isColombiaDateInPast(data.fecha, now)) {
      return {
        valid: false,
        error: `La fecha ${data.fecha} ya pasó (hora de Colombia). Elige una fecha futura.`,
      };
    }

    const clinic = await this.clinicRepository.findByName(data.sede);
    if (!clinic) {
      return {
        valid: false,
        error: `No se encontró la sede "${data.sede}". Verifica el nombre de la clínica.`,
      };
    }

    if (clinic.id !== context.clinicId) {
      return {
        valid: false,
        error: `La sede "${data.sede}" no pertenece a esta clínica.`,
      };
    }

    const specialtyExists = await this.doctorRepository.existsByClinicAndSpecialty(
      clinic.id,
      data.especialidad,
    );
    if (!specialtyExists) {
      return {
        valid: false,
        error: `La especialidad "${data.especialidad}" no está disponible en la sede "${data.sede}".`,
      };
    }

    return {
      valid: true,
      parsed: { ...data, clinicId: clinic.id },
    };
  }

  private async validateBookingArgs(
    data: {
      especialidad: string;
      sede: string;
      fecha: string;
      hora: string;
      paciente_telefono: string;
      paciente_nombre?: string;
    },
    context: ToolValidationContext,
  ): Promise<ToolValidationResult> {
    const availability = await this.validateAvailabilityArgs(data, context);
    if (!availability.valid) {
      return availability;
    }

    const now = context.now ?? new Date();
    if (isColombiaDateTimeInPast(data.fecha, data.hora, now)) {
      return {
        valid: false,
        error: `La fecha y hora ${data.fecha} ${data.hora} ya pasó (hora de Colombia). Elige un horario futuro.`,
      };
    }

    const clinicId = String(availability.parsed.clinicId);
    const date = parseColombiaDateTime(data.fecha, '00:00');
    const slots = await this.slotRepository.findAvailable(clinicId, data.especialidad, date);
    const matchingSlot = slots.find((slot) => slotMatchesRequestedTime(slot, data.fecha, data.hora));

    if (!matchingSlot) {
      return {
        valid: false,
        error: `No hay disponibilidad para ${data.especialidad} el ${data.fecha} a las ${data.hora}. Consulta otros horarios.`,
      };
    }

    return {
      valid: true,
      parsed: {
        ...data,
        clinicId,
        slotId: matchingSlot.id,
        doctorId: matchingSlot.doctorId,
        startUtc: matchingSlot.startTime.toISOString(),
      },
    };
  }
}
