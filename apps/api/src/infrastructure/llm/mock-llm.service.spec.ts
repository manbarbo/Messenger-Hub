import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { LLMChatResult } from '@domain/value-objects/llm-chat.vo';
import { MockLLMService } from './mock-llm.service';

function makeResult(content: string): LLMChatResult {
  return {
    content,
    toolCalls: [],
    model: 'mock',
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 0,
    costUsd: 0,
    finishReason: 'stop',
  };
}

describe('MockLLMService', () => {
  it('returns default response when no scripted responses exist', async () => {
    const service = new MockLLMService();
    const result = await service.chat({ messages: [{ role: 'user', content: 'hola' }] });

    expect(result.content).toBe('Default');
    expect(result.toolCalls).toEqual([]);
    expect(result.model).toBe('mock');
  });

  it('returns scripted responses in order', async () => {
    const service = new MockLLMService();
    service.setResponses([makeResult('first'), makeResult('second')]);

    await expect(service.chat({ messages: [] })).resolves.toMatchObject({ content: 'first' });
    await expect(service.chat({ messages: [] })).resolves.toMatchObject({ content: 'second' });
  });

  it('falls back to default after scripted responses are exhausted', async () => {
    const service = new MockLLMService();
    service.setResponses([makeResult('only')]);

    await service.chat({ messages: [] });
    const fallback = await service.chat({ messages: [] });

    expect(fallback.content).toBe('Default');
  });

  it('records chat calls for assertions', async () => {
    const service = new MockLLMService();
    const params = { messages: [{ role: 'user' as const, content: 'hola' }] };

    await service.chat(params);

    expect(service.callCount).toBe(1);
    expect(service.calls[0]).toBe(params);
  });

  it('resets state when setResponses is called again', async () => {
    const service = new MockLLMService();
    service.setResponses([makeResult('old')]);
    await service.chat({ messages: [] });

    service.setResponses([makeResult('new')]);
    const result = await service.chat({ messages: [] });

    expect(result.content).toBe('new');
    expect(service.callCount).toBe(1);
  });
});
