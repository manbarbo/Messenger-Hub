export type AITraceFinalStatus = 'resuelta_por_ia' | 'cita_agendada' | 'escalada';

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
  readonly toolsCalled: AITraceToolCall[];
  readonly finalStatus: AITraceFinalStatus;
  readonly createdAt: Date;
}
