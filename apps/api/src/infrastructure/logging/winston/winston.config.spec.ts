import { describe, expect, it } from 'vitest';
import { redactSensitive, createWinstonConfig } from './winston.config';

describe('redactSensitive', () => {
  it('redacts password field', () => {
    const result = redactSensitive({ password: 'secret', name: 'test' });
    expect(result).toEqual({ password: '[REDACTED]', name: 'test' });
  });

  it('redacts token field', () => {
    const result = redactSensitive({ token: 'abc123' });
    expect(result).toEqual({ token: '[REDACTED]' });
  });

  it('redacts secret field', () => {
    const result = redactSensitive({ secret: 'my-secret' });
    expect(result).toEqual({ secret: '[REDACTED]' });
  });

  it('redacts apiKey field', () => {
    const result = redactSensitive({ apiKey: 'key123' });
    expect(result).toEqual({ apiKey: '[REDACTED]' });
  });

  it('redacts key field', () => {
    const result = redactSensitive({ key: 'val' });
    expect(result).toEqual({ key: '[REDACTED]' });
  });

  it('redacts authorization field', () => {
    const result = redactSensitive({ authorization: 'Bearer xyz' });
    expect(result).toEqual({ authorization: '[REDACTED]' });
  });

  it('is case-insensitive for field names', () => {
    const result = redactSensitive({ Password: 'secret', TOKEN: 'abc' });
    expect(result).toEqual({ Password: '[REDACTED]', TOKEN: '[REDACTED]' });
  });

  it('recursively redacts nested objects', () => {
    const result = redactSensitive({
      user: { name: 'John', password: 'secret' },
      text: 'hello',
    });
    expect(result).toEqual({
      user: { name: 'John', password: '[REDACTED]' },
      text: 'hello',
    });
  });

  it('does not redact arrays', () => {
    const result = redactSensitive({ items: [1, 2, 3] });
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('preserves non-sensitive fields', () => {
    const result = redactSensitive({ from: '+57300', text: 'hello', clinicId: 'uuid' });
    expect(result).toEqual({ from: '+57300', text: 'hello', clinicId: 'uuid' });
  });
});

describe('createWinstonConfig', () => {
  it('returns debug level for development', () => {
    const config = createWinstonConfig(false);
    expect(config.level).toBe('debug');
  });

  it('returns info level for production', () => {
    const config = createWinstonConfig(true);
    expect(config.level).toBe('info');
  });
});