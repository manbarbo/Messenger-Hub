import { Injectable } from '@nestjs/common';
import type { LLMService } from '@domain/services/llm.service';
import type { LLMChatParams, LLMChatResult } from '@domain/value-objects/llm-chat.vo';

const DEFAULT_RESPONSE: LLMChatResult = {
  content: 'Default',
  toolCalls: [],
  model: 'mock',
  inputTokens: 0,
  outputTokens: 0,
  latencyMs: 0,
  costUsd: 0,
  finishReason: 'stop',
};

@Injectable()
export class MockLLMService implements LLMService {
  private responses: LLMChatResult[] = [];
  private callIndex = 0;
  readonly calls: LLMChatParams[] = [];

  setResponses(responses: LLMChatResult[]): void {
    this.responses = responses;
    this.callIndex = 0;
    this.calls.length = 0;
  }

  async chat(params: LLMChatParams): Promise<LLMChatResult> {
    this.calls.push(params);
    const response = this.responses[this.callIndex];
    this.callIndex += 1;
    return response ?? DEFAULT_RESPONSE;
  }

  get callCount(): number {
    return this.callIndex;
  }
}
