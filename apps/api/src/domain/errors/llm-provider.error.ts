export class LLMProviderError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'LLMProviderError';
    this.cause = cause;
  }
}
