import type { LLMChatParams, LLMChatResult } from '../value-objects/llm-chat.vo';

export const LLM_SERVICE = Symbol('LLMService');

export interface LLMService {
  chat(params: LLMChatParams): Promise<LLMChatResult>;
}
