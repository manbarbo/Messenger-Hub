import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AppApiError, isAppApiError } from './app-api.error';
import { errorInterceptor, toApiErrorPayload } from './error.interceptor';
import { ApiService } from './api.service';

describe('errorInterceptor', () => {
  let httpMock: HttpTestingController;
  let api: ApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiService,
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ApiService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps backend error payloads to AppApiError', async () => {
    const promise = firstValueFrom(api.getConversation('missing'));

    const request = httpMock.expectOne((req) =>
      req.url.endsWith('/api/conversations/missing'),
    );
    request.flush(
      { error: 'ConversationNotFoundError', message: 'Conversation not found' },
      { status: 404, statusText: 'Not Found' },
    );

    await expect(promise).rejects.toSatisfy((error: unknown) => {
      expect(isAppApiError(error)).toBe(true);
      if (isAppApiError(error)) {
        expect(error.message).toBe('Conversation not found');
        expect(error.error).toBe('ConversationNotFoundError');
        expect(error.status).toBe(404);
      }
      return true;
    });
  });

  it('maps network failures to AppApiError with status 0', async () => {
    const promise = firstValueFrom(api.listConversations());

    const request = httpMock.expectOne((req) => req.url.endsWith('/api/conversations'));
    request.error(new ProgressEvent('error'));

    await expect(promise).rejects.toBeInstanceOf(AppApiError);
  });
});

describe('toApiErrorPayload', () => {
  it('prefers message from error body', () => {
    const payload = toApiErrorPayload(
      new HttpErrorResponse({
        error: { error: 'ValidationError', message: 'from is required' },
        status: 400,
        statusText: 'Bad Request',
      }),
    );

    expect(payload).toEqual({
      error: 'ValidationError',
      message: 'from is required',
      status: 400,
    });
  });

  it('falls back to error name when message is missing', () => {
    const payload = toApiErrorPayload(
      new HttpErrorResponse({
        error: { error: 'ValidationError' },
        status: 400,
        statusText: 'Bad Request',
      }),
    );

    expect(payload.error).toBe('ValidationError');
    expect(payload.message).toBe('ValidationError');
  });

  it('handles empty bodies', () => {
    const payload = toApiErrorPayload(
      new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    expect(payload).toEqual({
      error: 'HttpError',
      message: 'An unexpected error occurred',
      status: 500,
    });
  });
});
