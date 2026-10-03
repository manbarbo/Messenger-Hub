export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LLMToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface LLMMessage {
  readonly role: LLMRole;
  readonly content: string;
  readonly toolCallId?: string;
  readonly toolCalls?: LLMToolCall[];
}

export interface LLMToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface LLMChatParams {
  readonly messages: LLMMessage[];
  readonly tools?: LLMToolDefinition[];
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface LLMChatResult {
  readonly content: string | null;
  readonly toolCalls: LLMToolCall[];
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly costUsd: number;
  readonly finishReason: string;
}
