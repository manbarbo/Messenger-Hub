import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import type { LLMService } from '@domain/services/llm.service';
import { LOGGER, type Logger } from '@domain/services';
import type {
  LLMChatParams,
  LLMChatResult,
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition,
} from '@domain/value-objects/llm-chat.vo';
import { LLMProviderError } from '@domain/errors/llm-provider.error';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const INPUT_COST_PER_MILLION_USD = 0.75;
const OUTPUT_COST_PER_MILLION_USD = 3.75;

function calculateCostUsd(inputTokens: number, outputTokens: number): number {
  const cost =
    (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION_USD +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION_USD;
  return Number(cost.toFixed(6));
}

function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw || raw.trim() === '') {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Tool arguments must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LLMProviderError(`Invalid tool call arguments from LLM: ${message}`, error);
  }
}

/**
 * Safe host only for logs — never API keys, paths, or query strings.
 */
export function toSafeBaseURLHost(baseURL: string | undefined): string | undefined {
  if (!baseURL) {
    return undefined;
  }
  try {
    return new URL(baseURL).host;
  } catch {
    return undefined;
  }
}

interface ProviderErrorLike {
  status?: number;
  error?: unknown;
  code?: string | number;
}

function extractProviderErrorDetails(error: unknown): Pick<
  ProviderErrorLike,
  'status' | 'error' | 'code'
> {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const candidate = error as ProviderErrorLike;
  const details: Pick<ProviderErrorLike, 'status' | 'error' | 'code'> = {};

  if (typeof candidate.status === 'number') {
    details.status = candidate.status;
  }
  if (candidate.error !== undefined) {
    details.error = candidate.error;
  }
  if (candidate.code !== undefined && (typeof candidate.code === 'string' || typeof candidate.code === 'number')) {
    details.code = candidate.code;
  }

  return details;
}

function toOpenAITools(tools: LLMToolDefinition[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function toOpenAIMessage(message: LLMMessage): ChatCompletionMessageParam {
  if (message.role === 'tool') {
    // Gemini OpenAI-compatible endpoint rejects role:"tool" follow-ups (HTTP 400, empty body).
    // Represent tool results as user messages so multi-turn tool calling works.
    return {
      role: 'user',
      content: `Resultado de ${message.toolCallId ? `la herramienta (${message.toolCallId})` : 'la herramienta'}:\n${message.content}`,
    };
  }

  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content ?? '',
      tool_calls: message.toolCalls.map((toolCall) => ({
        id: toolCall.id,
        type: 'function' as const,
        function: {
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.arguments),
        },
      })),
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
}

function toDomainToolCalls(
  toolCalls: ChatCompletionMessageToolCall[] | undefined,
): LLMToolCall[] {
  if (!toolCalls?.length) {
    return [];
  }

  return toolCalls.map((toolCall) => {
    if (!('function' in toolCall)) {
      throw new LLMProviderError(
        `Unsupported tool call type from LLM: ${String((toolCall as { type?: string }).type)}`,
      );
    }

    return {
      id: toolCall.id,
      name: toolCall.function.name,
      arguments: parseToolArguments(toolCall.function.arguments),
    };
  });
}

@Injectable()
export class GeminiLLMService implements LLMService {
  private readonly client: OpenAI;
  private readonly baseURLHost: string | undefined;

  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    private readonly configService: ConfigService,
  ) {
    const baseURL = this.configService.get<string>('LLM_BASE_URL');
    this.baseURLHost = toSafeBaseURLHost(baseURL);
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('LLM_API_KEY'),
      baseURL,
    });
  }

  async chat(params: LLMChatParams): Promise<LLMChatResult> {
    const startTime = Date.now();
    const model = params.model ?? this.configService.get<string>('LLM_MODEL', DEFAULT_MODEL);

    this.logger.debug('LLM request initiated', {
      context: 'GeminiLLMService',
      model,
      messageCount: params.messages.length,
      hasTools: Boolean(params.tools?.length),
      baseURLHost: this.baseURLHost,
    });

    const request: ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: params.messages.map(toOpenAIMessage),
    };

    if (params.tools?.length) {
      request.tools = toOpenAITools(params.tools);
      request.tool_choice = 'auto';
    }

    if (params.temperature !== undefined) {
      request.temperature = params.temperature;
    }

    if (params.maxTokens !== undefined) {
      request.max_tokens = params.maxTokens;
    }

    try {
      const response = await this.client.chat.completions.create(request);
      const latencyMs = Date.now() - startTime;
      const choice = response.choices?.[0];

      if (!choice?.message) {
        this.logger.warn('LLM returned an empty response', {
          context: 'GeminiLLMService',
          model,
          reason: 'empty_response',
          baseURLHost: this.baseURLHost,
        });
        throw new LLMProviderError('LLM returned an empty response');
      }

      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;
      const toolCalls = toDomainToolCalls(choice.message.tool_calls);
      const resolvedModel = response.model || model;
      const finishReason = choice.finish_reason ?? 'unknown';
      const costUsd = calculateCostUsd(inputTokens, outputTokens);

      this.logger.info('LLM response received', {
        context: 'GeminiLLMService',
        model: resolvedModel,
        inputTokens,
        outputTokens,
        latencyMs,
        costUsd,
        finishReason,
        hasToolCalls: toolCalls.length > 0,
        baseURLHost: this.baseURLHost,
      });

      return {
        content: choice.message.content,
        toolCalls,
        model: resolvedModel,
        inputTokens,
        outputTokens,
        latencyMs,
        costUsd,
        finishReason,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown LLM provider error';
      const { status, error: errorBody, code } = extractProviderErrorDetails(error);

      this.logger.error('LLM request failed', {
        context: 'GeminiLLMService',
        model,
        error: message,
        status,
        code,
        errorBody,
        baseURLHost: this.baseURLHost,
      });

      if (error instanceof LLMProviderError) {
        throw error;
      }

      throw new LLMProviderError(`LLM request failed: ${message}`, error);
    }
  }
}
