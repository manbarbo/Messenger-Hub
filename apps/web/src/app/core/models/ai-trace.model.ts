export interface AITraceToolCall {
  readonly name: string;
  readonly arguments: Record<string, unknown>;
  readonly result: unknown;
  readonly success: boolean;
}

export interface AITrace {
  readonly id: string;
  readonly conversationId: string;
  readonly clinicId: string;
  readonly turnIndex: number;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly costUsd: number;
  readonly toolsCalled: readonly AITraceToolCall[];
  readonly finalStatus: string;
  readonly createdAt: string;
}
