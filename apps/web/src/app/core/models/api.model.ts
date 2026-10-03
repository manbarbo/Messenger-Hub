import type { ConversationStatus } from './conversation.model';

export interface PaginationMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ListConversationsParams {
  readonly status?: ConversationStatus;
  readonly clinicId?: string;
  readonly page?: number;
  readonly limit?: number;
}

export interface ListConversationsResponse<T = unknown> {
  readonly data: readonly T[];
  readonly pagination: PaginationMeta;
}

export interface SimulatorRequest {
  readonly from: string;
  readonly text: string;
  readonly clinicId?: string;
}

export interface SimulatorResponse {
  readonly status: 'accepted';
  readonly messageId: string;
  readonly conversationId: string;
}

export interface ApiErrorPayload {
  readonly error: string;
  readonly message: string;
  readonly status: number;
}
