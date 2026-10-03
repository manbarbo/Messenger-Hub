export interface FormattedLog {
  message: string;
  metadata: Record<string, unknown>;
}

export function formatLog(message: string, metadata?: Record<string, unknown>): FormattedLog {
  return { message, metadata: metadata ?? {} };
}

export function stringifyLogValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return '[Unserializable value]';
  }
}