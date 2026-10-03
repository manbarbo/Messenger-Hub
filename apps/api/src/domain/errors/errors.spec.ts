import { describe, expect, it } from 'vitest';
import {
  ClinicNotFoundError,
  LLMIterationLimitError,
  LLMProviderError,
  PastDateError,
  SlotAlreadyBookedError,
  SlotNotFoundError,
  ValidationError,
} from './index';

describe('domain errors', () => {
  it('ValidationError carries field errors', () => {
    const err = new ValidationError('invalid', [{ field: 'phone', message: 'bad format' }]);
    expect(err.name).toBe('ValidationError');
    expect(err.fieldErrors).toHaveLength(1);
  });

  it('SlotAlreadyBookedError includes slot id', () => {
    const err = new SlotAlreadyBookedError('slot-9');
    expect(err.name).toBe('SlotAlreadyBookedError');
    expect(err.slotId).toBe('slot-9');
    expect(err.message).toContain('slot-9');
  });

  it('SlotNotFoundError includes slot id', () => {
    const err = new SlotNotFoundError('slot-1');
    expect(err.name).toBe('SlotNotFoundError');
    expect(err.slotId).toBe('slot-1');
  });

  it('ClinicNotFoundError includes clinic id', () => {
    const err = new ClinicNotFoundError('clinic-2');
    expect(err.name).toBe('ClinicNotFoundError');
    expect(err.clinicId).toBe('clinic-2');
  });

  it('PastDateError includes date', () => {
    const date = new Date('2020-01-01T00:00:00Z');
    const err = new PastDateError(date);
    expect(err.name).toBe('PastDateError');
    expect(err.date).toBe(date);
  });

  it('LLMProviderError keeps cause', () => {
    const cause = new Error('rate limit');
    const err = new LLMProviderError('LLM failed', cause);
    expect(err.name).toBe('LLMProviderError');
    expect(err.cause).toBe(cause);
  });

  it('LLMIterationLimitError includes max iterations', () => {
    const err = new LLMIterationLimitError(5);
    expect(err.name).toBe('LLMIterationLimitError');
    expect(err.maxIterations).toBe(5);
  });
});
