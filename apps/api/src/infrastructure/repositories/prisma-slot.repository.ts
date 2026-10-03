import { Injectable } from '@nestjs/common';
import type { Slot } from '@domain/entities/slot.entity';
import type { SlotRepository } from '@domain/repositories/slot.repository';
import { PrismaService } from '../database/prisma.service';

interface PrismaSlot {
  id: string;
  clinicId: string;
  doctorId: string;
  startTime: Date;
  endTime: Date;
  isBooked: boolean;
  createdAt: Date;
}

function toDomain(row: PrismaSlot): Slot {
  return {
    id: row.id,
    clinicId: row.clinicId,
    doctorId: row.doctorId,
    startTime: row.startTime,
    endTime: row.endTime,
    isBooked: row.isBooked,
    createdAt: row.createdAt,
  };
}

function dayRangeUtc(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

@Injectable()
export class PrismaSlotRepository implements SlotRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAvailable(clinicId: string, specialty: string, date: Date): Promise<Slot[]> {
    const { start, end } = dayRangeUtc(date);

    const rows = await this.prisma.slot.findMany({
      where: {
        clinicId,
        isBooked: false,
        startTime: { gte: start, lt: end },
        doctor: { specialty, active: true },
      },
      orderBy: { startTime: 'asc' },
    });

    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Slot | null> {
    const row = await this.prisma.slot.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByDoctorAndTime(doctorId: string, startTime: Date): Promise<Slot | null> {
    const row = await this.prisma.slot.findUnique({
      where: { doctorId_startTime: { doctorId, startTime } },
    });
    return row ? toDomain(row) : null;
  }

  async markAsBooked(id: string): Promise<void> {
    await this.prisma.slot.update({
      where: { id },
      data: { isBooked: true },
    });
  }

  async markAsAvailable(id: string): Promise<void> {
    await this.prisma.slot.update({
      where: { id },
      data: { isBooked: false },
    });
  }
}
