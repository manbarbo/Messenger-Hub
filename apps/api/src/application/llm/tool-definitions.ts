import type { LLMToolDefinition } from '@domain/value-objects/llm-chat.vo';

export const TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'buscar_conocimiento',
    description:
      'Busca información en la base de conocimiento de la clínica (horarios, políticas, preparaciones).',
    parameters: {
      type: 'object',
      properties: {
        pregunta: {
          type: 'string',
          description: 'Pregunta del paciente sobre la clínica',
        },
      },
      required: ['pregunta'],
      additionalProperties: false,
    },
  },
  {
    name: 'consultar_disponibilidad',
    description:
      'Consulta horarios disponibles para una especialidad en una sede y fecha específica.',
    parameters: {
      type: 'object',
      properties: {
        especialidad: {
          type: 'string',
          description: 'Especialidad médica (ej. Medicina General, Dermatología)',
        },
        sede: {
          type: 'string',
          description: 'Nombre de la sede o clínica',
        },
        fecha: {
          type: 'string',
          description: 'Fecha en formato YYYY-MM-DD (hora de Colombia)',
        },
      },
      required: ['especialidad', 'sede', 'fecha'],
      additionalProperties: false,
    },
  },
  {
    name: 'agendar_cita',
    description: 'Agenda una cita médica en un horario disponible.',
    parameters: {
      type: 'object',
      properties: {
        especialidad: { type: 'string', description: 'Especialidad médica' },
        sede: { type: 'string', description: 'Nombre de la sede o clínica' },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        hora: { type: 'string', description: 'Hora en formato HH:mm (hora de Colombia)' },
        paciente_telefono: {
          type: 'string',
          description: 'Teléfono del paciente',
        },
        paciente_nombre: {
          type: 'string',
          description: 'Nombre del paciente (opcional)',
        },
      },
      required: ['especialidad', 'sede', 'fecha', 'hora', 'paciente_telefono'],
      additionalProperties: false,
    },
  },
  {
    name: 'escalar_a_humano',
    description:
      'Escala la conversación a un agente humano cuando no se puede resolver con el asistente.',
    parameters: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          description: 'Motivo por el cual se escala a un humano',
        },
      },
      required: ['motivo'],
      additionalProperties: false,
    },
  },
] as const;

export const TOOL_NAMES = TOOL_DEFINITIONS.map((tool) => tool.name);
