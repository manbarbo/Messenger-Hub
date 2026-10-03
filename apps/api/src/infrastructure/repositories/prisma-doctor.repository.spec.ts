import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaDoctorRepository } from './prisma-doctor.repository';

describe('PrismaDoctorRepository', () => {
  let prisma: { doctor: { count: ReturnType<typeof vi.fn> } };
  let repository: PrismaDoctorRepository;

  beforeEach(() => {
    prisma = { doctor: { count: vi.fn() } };
    repository = new PrismaDoctorRepository(prisma as never);
  });

  it('returns true when an active doctor matches clinic and specialty', async () => {
    prisma.doctor.count.mockResolvedValue(1);

    await expect(repository.existsByClinicAndSpecialty('clinic-1', 'Dermatologia')).resolves.toBe(
      true,
    );
    expect(prisma.doctor.count).toHaveBeenCalledWith({
      where: {
        clinicId: 'clinic-1',
        specialty: { equals: 'Dermatologia', mode: 'insensitive' },
        active: true,
      },
    });
  });

  it('returns false when no active doctor matches', async () => {
    prisma.doctor.count.mockResolvedValue(0);

    await expect(
      repository.existsByClinicAndSpecialty('clinic-1', 'Neurologia'),
    ).resolves.toBe(false);
  });
});
