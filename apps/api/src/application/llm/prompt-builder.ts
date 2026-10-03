import { Injectable } from '@nestjs/common';
import type { Message } from '@domain/entities/message.entity';
import type { LLMMessage } from '@domain/value-objects/llm-chat.vo';
import { formatColombiaDateTime } from './colombia-time';

export const TOOL_NAMES_FOR_PROMPT =
  'buscar_conocimiento, consultar_disponibilidad, agendar_cita, escalar_a_humano';

@Injectable()
export class PromptBuilder {
  buildSystemPrompt(clinicName: string, now: Date = new Date()): string {
    const dateTime = formatColombiaDateTime(now);
    return `Eres un asistente de agendamiento para ${clinicName}.
Fecha y hora actual en Colombia: ${dateTime} (UTC-5).
SOLO usa información de la base de conocimiento. NUNCA inventes datos.
Si no tienes la información, di "No tengo esa información" o escala a un humano.
Interpreta fechas relativas ("mañana", "esta tarde") usando la fecha actual de Colombia.
Herramientas disponibles: ${TOOL_NAMES_FOR_PROMPT}.`;
  }

  buildMessages(history: Message[], currentMessage: string): LLMMessage[] {
    const messages: LLMMessage[] = history.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
    messages.push({ role: 'user', content: currentMessage });
    return messages;
  }

  buildTurnMessages(
    clinicName: string,
    history: Message[],
    currentMessage: string,
    now: Date = new Date(),
  ): LLMMessage[] {
    return [
      { role: 'system', content: this.buildSystemPrompt(clinicName, now) },
      ...this.buildMessages(history, currentMessage),
    ];
  }
}
