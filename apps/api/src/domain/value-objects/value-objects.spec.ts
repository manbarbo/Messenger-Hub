import { describe, expect, it } from 'vitest';
import { DateRange } from './date-range.vo';
import {
  createPaginatedResult,
  createPaginationParams,
} from './pagination.vo';
import {
  isRelevantKnowledgeResult,
  RAG_SIMILARITY_THRESHOLD,
  type KnowledgeResult,
} from './knowledge-result.vo';
import { ValidationError } from '../errors/validation.error';

describe('DateRange', () => {
  const start = new Date('2026-10-05T08:00:00Z');
  const end = new Date('2026-10-05T09:00:00Z');

  it('creates a valid range', () => {
    const range = new DateRange(start, end);
    expect(range.durationMs()).toBe(3600000);
    expect(range.contains(new Date('2026-10-05T08:30:00Z'))).toBe(true);
    expect(range.contains(new Date('2026-10-05T10:00:00Z'))).toBe(false);
  });

  it('rejects end <= start', () => {
    expect(() => new DateRange(end, start)).toThrow(ValidationError);
    expect(() => new DateRange(start, start)).toThrow(ValidationError);
  });

  it('rejects invalid dates', () => {
    expect(() => new DateRange(new Date('invalid'), end)).toThrow(ValidationError);
    expect(() => new DateRange(start, new Date('invalid'))).toThrow(ValidationError);
  });
});

describe('Pagination', () => {
  it('creates valid pagination params', () => {
    expect(createPaginationParams(1, 20)).toEqual({ page: 1, pageSize: 20 });
  });

  it('rejects invalid page/pageSize', () => {
    expect(() => createPaginationParams(0, 20)).toThrow(ValidationError);
    expect(() => createPaginationParams(1, 0)).toThrow(ValidationError);
    expect(() => createPaginationParams(1, 101)).toThrow(ValidationError);
  });

  it('creates paginated result with totalPages', () => {
    const result = createPaginatedResult(['a', 'b'], 45, 2, 20);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('handles empty results', () => {
    const result = createPaginatedResult([], 0, 1, 20);
    expect(result.totalPages).toBe(0);
  });
});

describe('KnowledgeResult relevance', () => {
  const makeResult = (similarity: number): KnowledgeResult => ({
    id: 'k1',
    title: 'Horarios',
    content: 'Abrimos de 8 a 5',
    category: 'horarios',
    similarity,
  });

  it('flags results above threshold as relevant', () => {
    expect(RAG_SIMILARITY_THRESHOLD).toBe(0.7);
    expect(isRelevantKnowledgeResult(makeResult(0.85))).toBe(true);
    expect(isRelevantKnowledgeResult(makeResult(0.7))).toBe(false);
    expect(isRelevantKnowledgeResult(makeResult(0.5))).toBe(false);
  });
});
