import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AppApiError } from './app-api.error';
import type { ApiErrorPayload } from './models/api.model';

function extractMessage(body: unknown): string {
  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }

  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    if (typeof record['message'] === 'string' && record['message'].trim().length > 0) {
      return record['message'];
    }
    if (typeof record['error'] === 'string' && record['error'].trim().length > 0) {
      return record['error'];
    }
  }

  return 'An unexpected error occurred';
}

function extractErrorName(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    if (typeof record['error'] === 'string' && record['error'].length > 0) {
      return record['error'];
    }
  }

  if (status === 0) {
    return 'NetworkError';
  }

  return 'HttpError';
}

export function toApiErrorPayload(error: HttpErrorResponse): ApiErrorPayload {
  const status = error.status;
  const body = error.error;

  return {
    error: extractErrorName(body, status),
    message: extractMessage(body),
    status,
  };
}

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        return throwError(() => new AppApiError(toApiErrorPayload(error)));
      }

      return throwError(
        () =>
          new AppApiError({
            error: 'UnknownError',
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
            status: 0,
          }),
      );
    }),
  );
