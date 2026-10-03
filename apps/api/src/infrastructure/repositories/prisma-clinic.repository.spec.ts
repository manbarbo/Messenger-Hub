import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClinicRepository } from './prisma-clinic.repository';

const clinicRow = {
  id: 'clinic-1',
  name: 'Clínica Norte',
  address: 'Calle 10 #20-30',
  phone: '+5715551234',
  timezone: 'America/Bogota',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('PrismaClinicRepository', () => {
  let prisma: { clinic: { findUnique: ReturnType<typeof vi.fn> } };
  let repository: PrismaClinicRepository;

  beforeEach(() => {
    prisma = { clinic: { findUnique: vi.fn() } };
    repository = new PrismaClinicRepository(prisma as never);
  });

  it('returns clinic when found', async () => {
    prisma.clinic.findUnique.mockResolvedValue(clinicRow);

    const result = await repository.findById('clinic-1');

    expect(prisma.clinic.findUnique).toHaveBeenCalledWith({ where: { id: 'clinic-1' } });
    expect(result).toEqual(clinicRow);
  });

  it('returns null when clinic does not exist', async () => {
    prisma.clinic.findUnique.mockResolvedValue(null);

    expect(await repository.findById('missing')).toBeNull();
  });
});
