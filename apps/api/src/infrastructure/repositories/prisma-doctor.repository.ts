import { Injectable } from '@nestjs/common';
import type { DoctorRepository } from '@domain/repositories/doctor.repository';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PrismaDoctorRepository implements DoctorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async existsByClinicAndSpecialty(clinicId: string, specialty: string): Promise<boolean> {
    const count = await this.prisma.doctor.count({
      where: {
        clinicId,
        specialty: { equals: specialty, mode: 'insensitive' },
        active: true,
      },
    });
    return count > 0;
  }
}
