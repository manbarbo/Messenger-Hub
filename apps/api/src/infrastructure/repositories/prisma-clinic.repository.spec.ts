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
  let prisma: {
    clinic: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let repository: PrismaClinicRepository;

  beforeEach(() => {
    prisma = { clinic: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() } };
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

  it('finds clinic by name case-insensitively', async () => {
    prisma.clinic.findFirst.mockResolvedValue(clinicRow);

    const result = await repository.findByName('clínica norte');

    expect(prisma.clinic.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'clínica norte', mode: 'insensitive' } },
    });
    expect(result).toEqual(clinicRow);
  });

  it('returns null when clinic name does not match', async () => {
    prisma.clinic.findFirst.mockResolvedValue(null);

    expect(await repository.findByName('Clínica Sur')).toBeNull();
  });

  it('returns all clinic ids and names ordered by name', async () => {
    prisma.clinic.findMany.mockResolvedValue([
      { id: 'clinic-1', name: 'Clínica Norte' },
      { id: 'clinic-2', name: 'Clínica Sur' },
    ]);

    const result = await repository.findAll();

    expect(prisma.clinic.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual([
      { id: 'clinic-1', name: 'Clínica Norte' },
      { id: 'clinic-2', name: 'Clínica Sur' },
    ]);
  });

  it('returns empty array when no clinics exist', async () => {
    prisma.clinic.findMany.mockResolvedValue([]);

    expect(await repository.findAll()).toEqual([]);
  });
});
