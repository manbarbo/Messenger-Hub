import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Slot } from '@domain/entities/slot.entity';
import { PrismaSlotRepository } from './prisma-slot.repository';

const baseSlot: Slot = {
  id: 'slot-1',
  clinicId: 'clinic-1',
  doctorId: 'doc-1',
  startTime: new Date('2026-10-05T15:00:00Z'),
  endTime: new Date('2026-10-05T15:30:00Z'),
  isBooked: false,
  createdAt: new Date('2026-10-01T10:00:00Z'),
};

describe('PrismaSlotRepository', () => {
  let prisma: {
    slot: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let repository: PrismaSlotRepository;

  beforeEach(() => {
    prisma = {
      slot: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    repository = new PrismaSlotRepository(prisma as never);
  });

  describe('findAvailable', () => {
    it('filters by clinic, specialty, date range, and unbooked slots', async () => {
      prisma.slot.findMany.mockResolvedValue([baseSlot]);
      const date = new Date('2026-10-05T18:00:00Z');

      const result = await repository.findAvailable('clinic-1', 'Cardiología', date);

      expect(prisma.slot.findMany).toHaveBeenCalledWith({
        where: {
          clinicId: 'clinic-1',
          isBooked: false,
          startTime: {
            gte: new Date('2026-10-05T00:00:00Z'),
            lt: new Date('2026-10-06T00:00:00Z'),
          },
          doctor: { specialty: 'Cardiología', active: true },
        },
        orderBy: { startTime: 'asc' },
      });
      expect(result).toEqual([baseSlot]);
    });

    it('returns empty array when no slots match', async () => {
      prisma.slot.findMany.mockResolvedValue([]);

      const result = await repository.findAvailable('clinic-1', 'Dermatología', new Date());

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns slot when found', async () => {
      prisma.slot.findUnique.mockResolvedValue(baseSlot);

      const result = await repository.findById('slot-1');

      expect(prisma.slot.findUnique).toHaveBeenCalledWith({ where: { id: 'slot-1' } });
      expect(result).toEqual(baseSlot);
    });

    it('returns null when not found', async () => {
      prisma.slot.findUnique.mockResolvedValue(null);

      expect(await repository.findById('missing')).toBeNull();
    });
  });

  describe('findByDoctorAndTime', () => {
    it('queries by the unique doctorId_startTime compound key', async () => {
      prisma.slot.findUnique.mockResolvedValue(baseSlot);

      const result = await repository.findByDoctorAndTime('doc-1', baseSlot.startTime);

      expect(prisma.slot.findUnique).toHaveBeenCalledWith({
        where: {
          doctorId_startTime: { doctorId: 'doc-1', startTime: baseSlot.startTime },
        },
      });
      expect(result).toEqual(baseSlot);
    });
  });

  describe('markAsBooked / markAsAvailable', () => {
    it('marks a slot as booked', async () => {
      prisma.slot.update.mockResolvedValue({ ...baseSlot, isBooked: true });

      await repository.markAsBooked('slot-1');

      expect(prisma.slot.update).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
        data: { isBooked: true },
      });
    });

    it('marks a slot as available', async () => {
      prisma.slot.update.mockResolvedValue({ ...baseSlot, isBooked: false });

      await repository.markAsAvailable('slot-1');

      expect(prisma.slot.update).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
        data: { isBooked: false },
      });
    });
  });
});
