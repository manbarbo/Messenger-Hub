import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClinicRepository } from '@domain/repositories';
import { ListClinicsQuery } from './list-clinics.query';
import { ListClinicsHandler } from './list-clinics.handler';

describe('ListClinicsHandler', () => {
  let clinicRepository: { findAll: ReturnType<typeof vi.fn> };
  let logger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let handler: ListClinicsHandler;

  beforeEach(() => {
    clinicRepository = { findAll: vi.fn() };
    logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    handler = new ListClinicsHandler(
      clinicRepository as unknown as ClinicRepository,
      logger as never,
    );
  });

  it('returns clinic id and name list from the repository', async () => {
    const clinics = [
      { id: 'clinic-1', name: 'Clínica Norte' },
      { id: 'clinic-2', name: 'Clínica Sur' },
    ];
    clinicRepository.findAll.mockResolvedValue(clinics);

    const result = await handler.execute(new ListClinicsQuery());

    expect(clinicRepository.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual(clinics);
  });

  it('returns empty array when no clinics exist', async () => {
    clinicRepository.findAll.mockResolvedValue([]);

    const result = await handler.execute(new ListClinicsQuery());

    expect(result).toEqual([]);
  });

  it('logs query start and result count', async () => {
    clinicRepository.findAll.mockResolvedValue([{ id: 'clinic-1', name: 'Clínica Norte' }]);

    await handler.execute(new ListClinicsQuery());

    expect(logger.debug).toHaveBeenCalledWith('Listing clinics', {
      context: 'ListClinicsQueryHandler',
    });
    expect(logger.info).toHaveBeenCalledWith('Clinics listed', {
      context: 'ListClinicsQueryHandler',
      resultCount: 1,
    });
  });
});
