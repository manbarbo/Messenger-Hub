import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { TOOL_DEFINITIONS, TOOL_NAMES } from './tool-definitions';

describe('TOOL_DEFINITIONS', () => {
  it('exposes the four clinic tools in OpenAI function format', () => {
    expect(TOOL_NAMES).toEqual([
      'buscar_conocimiento',
      'consultar_disponibilidad',
      'agendar_cita',
      'escalar_a_humano',
    ]);
  });

  it('uses JSON Schema object parameters with required fields', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.parameters).toMatchObject({ type: 'object' });
      const params = tool.parameters as { required?: string[]; properties?: Record<string, unknown> };
      expect(Array.isArray(params.required)).toBe(true);
      expect(params.required!.length).toBeGreaterThan(0);
      expect(params.properties).toBeDefined();
    }
  });

  it('defines required fields matching tool schemas', () => {
    const byName = Object.fromEntries(TOOL_DEFINITIONS.map((t) => [t.name, t]));
    const required = (name: string) =>
      (byName[name].parameters as { required: string[] }).required;

    expect(required('buscar_conocimiento')).toEqual(['pregunta']);
    expect(required('consultar_disponibilidad')).toEqual(['especialidad', 'sede', 'fecha']);
    expect(required('agendar_cita')).toEqual([
      'especialidad',
      'sede',
      'fecha',
      'hora',
      'paciente_telefono',
    ]);
    expect(required('escalar_a_humano')).toEqual(['motivo']);
  });
});
