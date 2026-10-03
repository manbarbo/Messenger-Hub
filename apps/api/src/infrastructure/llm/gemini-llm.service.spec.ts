import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Logger } from '@domain/services';
import type { LLMChatParams } from '@domain/value-objects/llm-chat.vo';
import { LLMProviderError } from '@domain/errors/llm-provider.error';
import { GeminiLLMService, toSafeBaseURLHost } from './gemini-llm.service';

const { createMock, openAIConstructor } = vi.hoisted(() => ({
  createMock: vi.fn(),
  openAIConstructor: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    readonly config: unknown;
    readonly chat = { completions: { create: createMock } };

    constructor(config: unknown) {
      this.config = config;
      openAIConstructor(config);
    }
  },
}));

function createMockLogger(): Logger & {
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
} {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createConfigService(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    LLM_API_KEY: 'test-key',
    LLM_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    LLM_MODEL: 'gemini-2.5-flash',
    ...overrides,
  };

  return {
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      (values[key] as T | undefined) ?? defaultValue,
  } as unknown as ConfigService;
}

function createService(
  config: ConfigService = createConfigService(),
  logger: Logger = createMockLogger(),
): GeminiLLMService {
  return new GeminiLLMService(logger, config);
}

function chatParams(overrides: Partial<LLMChatParams> = {}): LLMChatParams {
  return {
    messages: [{ role: 'user', content: 'Hola, quiero una cita' }],
    ...overrides,
  };
}

describe('GeminiLLMService', () => {
  beforeEach(() => {
    createMock.mockReset();
    openAIConstructor.mockReset();
  });

  it('configures OpenAI client from LLM env vars', () => {
    createService(createConfigService());

    expect(openAIConstructor).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
  });

  it('returns structured chat result with tokens, latency, cost, and model', async () => {
    createMock.mockResolvedValue({
      model: 'gemini-2.5-flash',
      choices: [
        {
          message: { role: 'assistant', content: 'Hola! En que puedo ayudarte?' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1000, completion_tokens: 500 },
    });

    const service = createService();
    const result = await service.chat(chatParams());

    expect(result.content).toBe('Hola! En que puedo ayudarte?');
    expect(result.toolCalls).toEqual([]);
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.inputTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.costUsd).toBeCloseTo((1000 / 1_000_000) * 0.75 + (500 / 1_000_000) * 3.75, 6);
    expect(result.finishReason).toBe('stop');
  });

  it('sends messages and tool definitions to the Gemini endpoint', async () => {
    createMock.mockResolvedValue({
      model: 'gemini-2.5-flash',
      choices: [{ message: { role: 'assistant', content: null }, finish_reason: 'tool_calls' }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const service = createService();
    await service.chat(
      chatParams({
        tools: [
          {
            name: 'buscar_conocimiento',
            description: 'Search knowledge base',
            parameters: { type: 'object', properties: { pregunta: { type: 'string' } } },
          },
        ],
      }),
    );

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        tool_choice: 'auto',
        tools: [
          {
            type: 'function',
            function: {
              name: 'buscar_conocimiento',
              description: 'Search knowledge base',
              parameters: { type: 'object', properties: { pregunta: { type: 'string' } } },
            },
          },
        ],
        messages: [{ role: 'user', content: 'Hola, quiero una cita' }],
      }),
    );
  });

  it('omits tools when none are provided', async () => {
    createMock.mockResolvedValue({
      model: 'gemini-2.5-flash',
      choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const service = createService();
    await service.chat(chatParams());

    const request = createMock.mock.calls[0][0] as Record<string, unknown>;
    expect(request.tools).toBeUndefined();
    expect(request.tool_choice).toBeUndefined();
  });

  it('parses tool calls returned by the model', async () => {
    createMock.mockResolvedValue({
      model: 'gemini-2.5-flash',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'consultar_disponibilidad',
                  arguments: '{"especialidad":"Dermatologia","sede":"Sede Norte","fecha":"2026-10-05"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 20, completion_tokens: 10 },
    });

    const service = createService();
    const result = await service.chat(chatParams());

    expect(result.toolCalls).toEqual([
      {
        id: 'call_1',
        name: 'consultar_disponibilidad',
        arguments: {
          especialidad: 'Dermatologia',
          sede: 'Sede Norte',
          fecha: '2026-10-05',
        },
      },
    ]);
    expect(result.content).toBeNull();
    expect(result.finishReason).toBe('tool_calls');
  });

  it('supports multi-turn tool calling by mapping assistant tool calls and tool results', async () => {
    createMock.mockResolvedValue({
      model: 'gemini-2.5-flash',
      choices: [{ message: { role: 'assistant', content: 'Listo' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 30, completion_tokens: 5 },
    });

    const service = createService();
    await service.chat(
      chatParams({
        messages: [
          { role: 'user', content: 'Tiene citas de dermatologia?' },
          {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                id: 'call_1',
                name: 'consultar_disponibilidad',
                arguments: { especialidad: 'Dermatologia' },
              },
            ],
          },
          {
            role: 'tool',
            toolCallId: 'call_1',
            content: '{"slots":[]}',
          },
        ],
      }),
    );

    const request = createMock.mock.calls[0][0] as {
      messages: Array<Record<string, unknown>>;
    };

    expect(request.messages).toEqual([
      { role: 'user', content: 'Tiene citas de dermatologia?' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'consultar_disponibilidad',
              arguments: '{"especialidad":"Dermatologia"}',
            },
          },
        ],
      },
      // Gemini OpenAI-compat rejects role:"tool"; adapter maps results to user messages.
      {
        role: 'user',
        content: 'Resultado de la herramienta (call_1):\n{"slots":[]}',
      },
    ]);
  });

  it('throws LLMProviderError when the provider fails', async () => {
    createMock.mockRejectedValue(new Error('Rate limit exceeded'));

    const service = createService();
    await expect(service.chat(chatParams())).rejects.toMatchObject({
      name: 'LLMProviderError',
      message: expect.stringContaining('Rate limit exceeded'),
    });
  });

  it('logs status, error body, and baseURL host on provider failure without the API key', async () => {
    const logger = createMockLogger();
    const providerError = Object.assign(new Error('400 status code (no body)'), {
      status: 400,
      error: { error: { code: 400, message: 'Invalid request', status: 'INVALID_ARGUMENT' } },
      code: 'invalid_request_error',
    });
    createMock.mockRejectedValue(providerError);

    const service = createService(createConfigService(), logger);
    await expect(service.chat(chatParams())).rejects.toBeInstanceOf(LLMProviderError);

    expect(logger.error).toHaveBeenCalledWith(
      'LLM request failed',
      expect.objectContaining({
        context: 'GeminiLLMService',
        model: 'gemini-2.5-flash',
        error: expect.stringContaining('400 status code'),
        status: 400,
        code: 'invalid_request_error',
        errorBody: providerError.error,
        baseURLHost: 'generativelanguage.googleapis.com',
      }),
    );

    const logPayload = logger.error.mock.calls[0][1] as Record<string, unknown>;
    expect(JSON.stringify(logPayload)).not.toContain('test-key');
    expect(logPayload.baseURLHost).toBe('generativelanguage.googleapis.com');
    expect(String(logPayload.baseURLHost)).not.toContain('http');
  });

  it('toSafeBaseURLHost extracts host only and ignores invalid URLs', () => {
    expect(toSafeBaseURLHost('https://generativelanguage.googleapis.com/v1beta/openai/')).toBe(
      'generativelanguage.googleapis.com',
    );
    expect(toSafeBaseURLHost('not-a-url')).toBeUndefined();
    expect(toSafeBaseURLHost(undefined)).toBeUndefined();
  });

  it('throws LLMProviderError when the response has no choices', async () => {
    createMock.mockResolvedValue({ model: 'gemini-2.5-flash', choices: [] });

    const service = createService();
    await expect(service.chat(chatParams())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it('throws LLMProviderError on invalid tool call JSON', async () => {
    createMock.mockResolvedValue({
      model: 'gemini-2.5-flash',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_bad',
                type: 'function',
                function: { name: 'agendar_cita', arguments: '{invalid' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const service = createService();
    await expect(service.chat(chatParams())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it('treats empty tool call arguments as an empty object', async () => {
    createMock.mockResolvedValue({
      model: 'gemini-2.5-flash',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_empty',
                type: 'function',
                function: { name: 'escalar_a_humano', arguments: '' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const service = createService();
    const result = await service.chat(chatParams());

    expect(result.toolCalls).toEqual([
      { id: 'call_empty', name: 'escalar_a_humano', arguments: {} },
    ]);
  });

  it('throws LLMProviderError when tool arguments are not a JSON object', async () => {
    createMock.mockResolvedValue({
      model: 'gemini-2.5-flash',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_arr',
                type: 'function',
                function: { name: 'agendar_cita', arguments: '[1,2]' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const service = createService();
    await expect(service.chat(chatParams())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it('throws LLMProviderError on unsupported tool call shapes', async () => {
    createMock.mockResolvedValue({
      model: 'gemini-2.5-flash',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'call_x', type: 'custom' as 'function' }],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const service = createService();
    await expect(service.chat(chatParams())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it('allows per-call model override and optional sampling params', async () => {
    createMock.mockResolvedValue({
      model: 'custom-model',
      choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 2, completion_tokens: 2 },
    });

    const service = createService();
    await service.chat(
      chatParams({ model: 'custom-model', temperature: 0.2, maxTokens: 256 }),
    );

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'custom-model',
        temperature: 0.2,
        max_tokens: 256,
      }),
    );
  });

  it('wraps non-Error provider failures as LLMProviderError', async () => {
    createMock.mockRejectedValue('provider string failure');

    const service = createService();
    await expect(service.chat(chatParams())).rejects.toMatchObject({
      name: 'LLMProviderError',
      message: expect.stringContaining('Unknown LLM provider error'),
    });
  });

  it('defaults missing usage tokens to zero and finishReason to unknown', async () => {
    createMock.mockResolvedValue({
      model: 'gemini-2.5-flash',
      choices: [{ message: { role: 'assistant', content: 'ok' } }],
    });

    const service = createService();
    const result = await service.chat(chatParams());

    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.finishReason).toBe('unknown');
    expect(result.model).toBe('gemini-2.5-flash');
  });

  it('falls back to configured model when provider omits model', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const service = createService(createConfigService({ LLM_MODEL: 'configured-model' }));
    const result = await service.chat(chatParams());

    expect(result.model).toBe('configured-model');
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'configured-model' }));
  });
});
