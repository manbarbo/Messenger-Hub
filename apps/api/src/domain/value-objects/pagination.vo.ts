import { ValidationError } from '../errors/validation.error';

export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginatedResult<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export function createPaginationParams(
  page = 1,
  pageSize = 20,
): PaginationParams {
  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError('page must be an integer >= 1', [
      { field: 'page', message: 'must be integer >= 1' },
    ]);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ValidationError('pageSize must be an integer between 1 and 100', [
      { field: 'pageSize', message: 'must be integer between 1 and 100' },
    ]);
  }
  return { page, pageSize };
}

export function createPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / safePageSize),
  };
}
