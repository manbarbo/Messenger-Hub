import { Injectable } from '@nestjs/common';
import type { Clinic } from '@domain/entities/clinic.entity';
import type { ClinicRepository } from '@domain/repositories/clinic.repository';
import { PrismaService } from '../database/prisma.service';

type PrismaClinic = {
  id: string;
  name: string;
  address: string;
  phone: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: PrismaClinic): Clinic {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    timezone: row.timezone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaClinicRepository implements ClinicRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Clinic | null> {
    const row = await this.prisma.clinic.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByName(name: string): Promise<Clinic | null> {
    const row = await this.prisma.clinic.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    return row ? toDomain(row) : null;
  }

  async findAll(): Promise<Pick<Clinic, 'id' | 'name'>[]> {
    const rows = await this.prisma.clinic.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }
}
