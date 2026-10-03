import type { ApiErrorPayload } from './models/api.model';

export class AppApiError extends Error {
  readonly error: string;
  readonly status: number;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'AppApiError';
    this.error = payload.error;
    this.status = payload.status;
  }
}

export function isAppApiError(error: unknown): error is AppApiError {
  return error instanceof AppApiError;
}
