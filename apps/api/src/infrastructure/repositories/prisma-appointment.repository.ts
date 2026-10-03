import { Injectable } from '@nestjs/common';
import type { Appointment } from '@domain/entities/appointment.entity';
import { AppointmentStatus } from '@domain/enums/appointment-status.enum';
import { SlotAlreadyBookedError } from '@domain/errors/slot-already-booked.error';
import { SlotNotFoundError } from '@domain/errors/slot-not-found.error';
import type { AppointmentRepository } from '@domain/repositories/appointment.repository';
import { PrismaService } from '../database/prisma.service';

interface PrismaAppointment {
  id: string;
  clinicId: string;
  doctorId: string;
  slotId: string;
  patientPhone: string;
  patientName: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(row: PrismaAppointment): Appointment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    doctorId: row.doctorId,
    slotId: row.slotId,
    patientPhone: row.patientPhone,
    patientName: row.patientName,
    status: row.status as AppointmentStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(appointment: Appointment): Promise<Appointment> {
    return this.prisma.$transaction(async (tx) => {
      const slot = await tx.slot.findUnique({ where: { id: appointment.slotId } });

      if (!slot) {
        throw new SlotNotFoundError(appointment.slotId);
      }

      if (slot.isBooked) {
        throw new SlotAlreadyBookedError(appointment.slotId);
      }

      const created = await tx.appointment.create({
        data: {
          id: appointment.id,
          clinicId: appointment.clinicId,
          doctorId: appointment.doctorId,
          slotId: appointment.slotId,
          patientPhone: appointment.patientPhone,
          patientName: appointment.patientName,
          status: appointment.status,
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt,
        },
      });

      await tx.slot.update({
        where: { id: appointment.slotId },
        data: { isBooked: true },
      });

      return toDomain(created);
    });
  }

  async findById(id: string): Promise<Appointment | null> {
    const row = await this.prisma.appointment.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findBySlotId(slotId: string): Promise<Appointment | null> {
    const row = await this.prisma.appointment.findUnique({ where: { slotId } });
    return row ? toDomain(row) : null;
  }

  async findByPatientPhone(phone: string): Promise<Appointment[]> {
    const rows = await this.prisma.appointment.findMany({
      where: { patientPhone: phone },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async update(appointment: Appointment): Promise<Appointment> {
    const updated = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        patientPhone: appointment.patientPhone,
        patientName: appointment.patientName,
        status: appointment.status,
        updatedAt: appointment.updatedAt,
      },
    });
    return toDomain(updated);
  }
}
