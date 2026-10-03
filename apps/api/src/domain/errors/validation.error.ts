export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export class ValidationError extends Error {
  readonly fieldErrors: FieldError[];

  constructor(message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}
