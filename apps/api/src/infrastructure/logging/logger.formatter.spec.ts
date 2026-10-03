import { describe, expect, it } from 'vitest';
import { formatLog, stringifyLogValue } from './logger.formatter';

describe('formatLog', () => {
  it('returns message with empty metadata when no metadata provided', () => {
    const result = formatLog('test message');
    expect(result).toEqual({ message: 'test message', metadata: {} });
  });

  it('returns message with provided metadata', () => {
    const meta = { context: 'HTTP', method: 'GET' };
    const result = formatLog('request', meta);
    expect(result).toEqual({ message: 'request', metadata: meta });
  });

  it('handles empty message', () => {
    const result = formatLog('');
    expect(result).toEqual({ message: '', metadata: {} });
  });
});

describe('stringifyLogValue', () => {
  it('returns string as-is', () => {
    expect(stringifyLogValue('hello')).toBe('hello');
  });

  it('returns empty string for null', () => {
    expect(stringifyLogValue(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(stringifyLogValue(undefined)).toBe('');
  });

  it('stringifies objects', () => {
    expect(stringifyLogValue({ a: 1 })).toBe('{"a":1}');
  });

  it('stringifies arrays', () => {
    expect(stringifyLogValue([1, 2])).toBe('[1,2]');
  });

  it('stringifies numbers', () => {
    expect(stringifyLogValue(42)).toBe('42');
  });

  it('stringifies booleans', () => {
    expect(stringifyLogValue(true)).toBe('true');
  });

  it('returns placeholder for circular references', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(stringifyLogValue(circular)).toBe('[Unserializable value]');
  });
});