import type { SeedConversationSpec } from './types';

/**
 * Stable sample conversations for dashboard testing (T-7.2).
 * Timestamps are relative to a base time at build time.
 */
export const SEED_CONVERSATION_SPECS: readonly SeedConversationSpec[] = [
  {
    id: 'seed-conv-resolved-001',
    clinicName: 'Clínica Norte',
    patientPhone: '+573001112233',
    status: 'resolved_by_ai',
    messages: [
      {
        direction: 'inbound',
        role: 'user',
        content: 'Hola, ¿a qué hora atienden en Clínica Norte?',
        minuteOffset: 0,
        messageId: 'wamid.seed.resolved.001.1',
      },
      {
        direction: 'outbound',
        role: 'assistant',
        content:
          '¡Hola! La Clínica Norte atiende de lunes a viernes de 8:00 AM a 6:00 PM (hora de Colombia). Los sábados de 8:00 AM a 12:00 M solo con cita previa.',
        minuteOffset: 1,
      },
      {
        direction: 'inbound',
        role: 'user',
        content: '¿Tienen disponibilidad de dermatología?',
        minuteOffset: 2,
        messageId: 'wamid.seed.resolved.001.2',
      },
      {
        direction: 'outbound',
        role: 'assistant',
        content:
          'Sí, en Clínica Norte atienden Dermatología el Dr. García y la Dra. López dentro del horario habitual.',
        minuteOffset: 3,
      },
      {
        direction: 'inbound',
        role: 'user',
        content: 'Perfecto, muchas gracias',
        minuteOffset: 4,
        messageId: 'wamid.seed.resolved.001.3',
      },
      {
        direction: 'outbound',
        role: 'assistant',
        content:
          '¡Con gusto! Si deseas agendar una cita, escríbeme la especialidad, sede, fecha y hora.',
        minuteOffset: 5,
      },
    ],
    traces: [
      {
        turnIndex: 1,
        minuteOffset: 1,
        inputTokens: 420,
        outputTokens: 85,
        latencyMs: 1420,
        finalStatus: 'resuelta_por_ia',
        toolsCalled: [
          {
            name: 'buscar_conocimiento',
            arguments: { pregunta: '¿A qué hora atienden en Clínica Norte?' },
            result: [
              {
                title: 'Horarios de Atención — Clínica Norte',
                category: 'horarios',
                similarity: 0.91,
              },
            ],
            success: true,
          },
        ],
      },
      {
        turnIndex: 2,
        minuteOffset: 3,
        inputTokens: 510,
        outputTokens: 64,
        latencyMs: 1180,
        finalStatus: 'resuelta_por_ia',
        toolsCalled: [
          {
            name: 'buscar_conocimiento',
            arguments: { pregunta: '¿Tienen dermatología en Clínica Norte?' },
            result: [
              {
                title: 'Servicios Médicos — Clínica Norte',
                category: 'servicios',
                similarity: 0.88,
              },
            ],
            success: true,
          },
        ],
      },
    ],
  },
  {
    id: 'seed-conv-booked-002',
    clinicName: 'Clínica Sur',
    patientPhone: '+573104445555',
    status: 'appointment_booked',
    messages: [
      {
        direction: 'inbound',
        role: 'user',
        content: 'Hola, necesito una cita de pediatría en Clínica Sur',
        minuteOffset: 0,
        messageId: 'wamid.seed.booked.002.1',
      },
      {
        direction: 'outbound',
        role: 'assistant',
        content: '¡Hola! Puedo ayudarte con eso. ¿Qué fecha te acomoda?',
        minuteOffset: 1,
      },
      {
        direction: 'inbound',
        role: 'user',
        content: 'Mañana en la mañana',
        minuteOffset: 2,
        messageId: 'wamid.seed.booked.002.2',
      },
      {
        direction: 'outbound',
        role: 'assistant',
        content:
          'Tenemos disponibilidad de Pediatría con el Dr. Herrera mañana. ¿A qué hora prefieres?',
        minuteOffset: 3,
      },
      {
        direction: 'inbound',
        role: 'user',
        content: '10:00 por favor',
        minuteOffset: 4,
        messageId: 'wamid.seed.booked.002.3',
      },
      {
        direction: 'outbound',
        role: 'assistant',
        content: 'Perfecto. ¿Me confirmas tu número de teléfono para agendar?',
        minuteOffset: 5,
      },
      {
        direction: 'inbound',
        role: 'user',
        content: '+573104445555',
        minuteOffset: 6,
        messageId: 'wamid.seed.booked.002.4',
      },
      {
        direction: 'outbound',
        role: 'assistant',
        content:
          '¡Cita agendada! Pediatría en Clínica Sur, mañana a las 10:00. Te esperamos.',
        minuteOffset: 7,
      },
    ],
    traces: [
      {
        turnIndex: 1,
        minuteOffset: 3,
        inputTokens: 390,
        outputTokens: 72,
        latencyMs: 1310,
        finalStatus: 'resuelta_por_ia',
        toolsCalled: [
          {
            name: 'consultar_disponibilidad',
            arguments: {
              especialidad: 'Pediatría',
              sede: 'Clínica Sur',
              fecha: '{{tomorrow_colombia}}',
            },
            result: {
              available: true,
              slots: ['10:00', '10:30', '11:00'],
              doctor: 'Dr. Herrera',
            },
            success: true,
          },
        ],
      },
      {
        turnIndex: 2,
        minuteOffset: 7,
        inputTokens: 640,
        outputTokens: 96,
        latencyMs: 1650,
        finalStatus: 'cita_agendada',
        toolsCalled: [
          {
            name: 'agendar_cita',
            arguments: {
              especialidad: 'Pediatría',
              sede: 'Clínica Sur',
              fecha: '{{tomorrow_colombia}}',
              hora: '10:00',
              paciente_telefono: '+573104445555',
            },
            result: {
              status: 'CONFIRMED',
              doctor: 'Dr. Herrera',
              startTime: '{{tomorrow_colombia}}T10:00:00-05:00',
            },
            success: true,
          },
        ],
      },
    ],
  },
  {
    id: 'seed-conv-escalated-003',
    clinicName: 'Clínica Norte',
    patientPhone: '+573207778888',
    status: 'escalated',
    messages: [
      {
        direction: 'inbound',
        role: 'user',
        content: 'Buenas tardes, ¿cubren cirugía cardíaca en Clínica Norte?',
        minuteOffset: 0,
        messageId: 'wamid.seed.escalated.003.1',
      },
      {
        direction: 'outbound',
        role: 'assistant',
        content: 'No tengo esa información en la base de conocimiento de Clínica Norte.',
        minuteOffset: 1,
      },
      {
        direction: 'inbound',
        role: 'user',
        content: 'Es un procedimiento programado y necesito confirmarlo hoy',
        minuteOffset: 2,
        messageId: 'wamid.seed.escalated.003.2',
      },
      {
        direction: 'outbound',
        role: 'assistant',
        content:
          'No puedo confirmarlo con la información disponible. Te transfiero a un agente humano.',
        minuteOffset: 3,
      },
      {
        direction: 'inbound',
        role: 'user',
        content: 'De acuerdo, gracias',
        minuteOffset: 4,
        messageId: 'wamid.seed.escalated.003.3',
      },
      {
        direction: 'outbound',
        role: 'assistant',
        content: 'Un agente te contactará pronto por este mismo chat.',
        minuteOffset: 5,
      },
    ],
    traces: [
      {
        turnIndex: 1,
        minuteOffset: 1,
        inputTokens: 360,
        outputTokens: 48,
        latencyMs: 1090,
        finalStatus: 'resuelta_por_ia',
        toolsCalled: [
          {
            name: 'buscar_conocimiento',
            arguments: { pregunta: '¿Cubren cirugía cardíaca en Clínica Norte?' },
            result: 'No relevant information found',
            success: true,
          },
        ],
      },
      {
        turnIndex: 2,
        minuteOffset: 3,
        inputTokens: 410,
        outputTokens: 55,
        latencyMs: 980,
        finalStatus: 'escalada',
        toolsCalled: [
          {
            name: 'escalar_a_humano',
            arguments: {
              motivo: 'Procedimiento fuera de la base de conocimiento de la clínica',
            },
            result: { escalated: true, reason: 'Procedimiento fuera de la base de conocimiento' },
            success: true,
          },
        ],
      },
    ],
  },
];
