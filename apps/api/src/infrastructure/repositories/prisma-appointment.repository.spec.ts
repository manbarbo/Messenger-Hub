import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentStatus } from '@domain/enums/appointment-status.enum';
import { SlotAlreadyBookedError } from '@domain/errors/slot-already-booked.error';
import { SlotNotFoundError } from '@domain/errors/slot-not-found.error';
import type { Appointment } from '@domain/entities/appointment.entity';
import type { Logger } from '@domain/services';
import { PrismaAppointmentRepository } from './prisma-appointment.repository';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const baseAppointment: Appointment = {
  id: 'apt-1',
  clinicId: 'clinic-1',
  doctorId: 'doc-1',
  slotId: 'slot-1',
  patientPhone: '+573001112233',
  patientName: 'Ana Pérez',
  status: AppointmentStatus.CONFIRMED,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
};

describe('PrismaAppointmentRepository', () => {
  let tx: {
    slot: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    appointment: { create: ReturnType<typeof vi.fn> };
  };
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    appointment: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let repository: PrismaAppointmentRepository;

  beforeEach(() => {
    tx = {
      slot: { findUnique: vi.fn(), update: vi.fn() },
      appointment: { create: vi.fn() },
    };
    prisma = {
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      appointment: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    repository = new PrismaAppointmentRepository(createMockLogger(), prisma as never);
  });

  describe('create', () => {
    it('creates appointment and marks slot booked in a single transaction', async () => {
      tx.slot.findUnique.mockResolvedValue({ id: 'slot-1', isBooked: false });
      tx.appointment.create.mockResolvedValue(baseAppointment);
      tx.slot.update.mockResolvedValue({ id: 'slot-1', isBooked: true });

      const result = await repository.create(baseAppointment);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.slot.findUnique).toHaveBeenCalledWith({ where: { id: 'slot-1' } });
      expect(tx.appointment.create).toHaveBeenCalledWith({
        data: {
          id: baseAppointment.id,
          clinicId: baseAppointment.clinicId,
          doctorId: baseAppointment.doctorId,
          slotId: baseAppointment.slotId,
          patientPhone: baseAppointment.patientPhone,
          patientName: baseAppointment.patientName,
          status: baseAppointment.status,
          createdAt: baseAppointment.createdAt,
          updatedAt: baseAppointment.updatedAt,
        },
      });
      expect(tx.slot.update).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
        data: { isBooked: true },
      });
      expect(result).toEqual(baseAppointment);
    });

    it('throws SlotNotFoundError when slot does not exist', async () => {
      tx.slot.findUnique.mockResolvedValue(null);

      await expect(repository.create(baseAppointment)).rejects.toThrow(SlotNotFoundError);
      expect(tx.appointment.create).not.toHaveBeenCalled();
      expect(tx.slot.update).not.toHaveBeenCalled();
    });

    it('throws SlotAlreadyBookedError when slot is already booked', async () => {
      tx.slot.findUnique.mockResolvedValue({ id: 'slot-1', isBooked: true });

      await expect(repository.create(baseAppointment)).rejects.toThrow(SlotAlreadyBookedError);
      expect(tx.appointment.create).not.toHaveBeenCalled();
      expect(tx.slot.update).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns appointment when found', async () => {
      prisma.appointment.findUnique.mockResolvedValue(baseAppointment);

      const result = await repository.findById('apt-1');

      expect(prisma.appointment.findUnique).toHaveBeenCalledWith({ where: { id: 'apt-1' } });
      expect(result).toEqual(baseAppointment);
    });

    it('returns null when not found', async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);

      expect(await repository.findById('missing')).toBeNull();
    });
  });

  describe('findBySlotId', () => {
    it('supports idempotency checks by slot id', async () => {
      prisma.appointment.findUnique.mockResolvedValue(baseAppointment);

      const result = await repository.findBySlotId('slot-1');

      expect(prisma.appointment.findUnique).toHaveBeenCalledWith({ where: { slotId: 'slot-1' } });
      expect(result).toEqual(baseAppointment);
    });

    it('returns null when no appointment exists for the slot', async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);

      expect(await repository.findBySlotId('slot-1')).toBeNull();
    });
  });

  describe('findByPatientPhone', () => {
    it('returns appointments ordered by createdAt desc', async () => {
      prisma.appointment.findMany.mockResolvedValue([baseAppointment]);

      const result = await repository.findByPatientPhone('+573001112233');

      expect(prisma.appointment.findMany).toHaveBeenCalledWith({
        where: { patientPhone: '+573001112233' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([baseAppointment]);
    });
  });

  describe('update', () => {
    it('updates mutable fields and returns the appointment', async () => {
      const cancelled: Appointment = {
        ...baseAppointment,
        status: AppointmentStatus.CANCELLED,
        updatedAt: new Date('2026-10-02T10:00:00Z'),
      };
      prisma.appointment.update.mockResolvedValue(cancelled);

      const result = await repository.update(cancelled);

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'apt-1' },
        data: {
          patientPhone: cancelled.patientPhone,
          patientName: cancelled.patientName,
          status: cancelled.status,
          updatedAt: cancelled.updatedAt,
        },
      });
      expect(result).toEqual(cancelled);
    });
  });
});
