import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { Message } from '@domain/entities/message.entity';
import { PromptBuilder, TOOL_NAMES_FOR_PROMPT } from './prompt-builder';

function buildMessage(role: 'user' | 'assistant', content: string): Message {
  return {
    id: `msg-${content}`,
    conversationId: 'conv-1',
    clinicId: 'clinic-1',
    direction: role === 'user' ? 'inbound' : 'outbound',
    role,
    content,
    createdAt: new Date('2026-10-01T10:00:00Z'),
  };
}

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  it('includes clinic name, Colombia datetime, and tools in the system prompt', () => {
    const now = new Date('2026-10-05T15:30:00Z');
    const prompt = builder.buildSystemPrompt('Clínica Norte', now);

    expect(prompt).toContain('Clínica Norte');
    expect(prompt).toContain('2026-10-05 10:30');
    expect(prompt).toContain('UTC-5');
    expect(prompt).toContain(TOOL_NAMES_FOR_PROMPT);
    expect(prompt).toContain('NUNCA inventes datos');
  });

  it('maps conversation history and appends the current user message', () => {
    const messages = builder.buildMessages(
      [buildMessage('user', 'Hola'), buildMessage('assistant', 'En que puedo ayudarte?')],
      'Quiero una cita',
    );

    expect(messages).toEqual([
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'En que puedo ayudarte?' },
      { role: 'user', content: 'Quiero una cita' },
    ]);
  });

  it('builds turn messages with system prompt first', () => {
    const now = new Date('2026-10-05T15:30:00Z');
    const messages = builder.buildTurnMessages(
      'Clínica Norte',
      [buildMessage('user', 'Hola')],
      'Necesito información',
      now,
    );

    expect(messages[0]).toEqual({
      role: 'system',
      content: builder.buildSystemPrompt('Clínica Norte', now),
    });
    expect(messages).toHaveLength(3);
    expect(messages[2]).toEqual({ role: 'user', content: 'Necesito información' });
  });
});
