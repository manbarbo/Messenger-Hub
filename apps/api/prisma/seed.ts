import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hoursOnDay(dayOffset: number): Date[] {
  const base = new Date();
  base.setUTCHours(13, 0, 0, 0); // 08:00 America/Bogota (UTC-5)
  base.setUTCDate(base.getUTCDate() + dayOffset);

  const slots: Date[] = [];
  for (let i = 0; i < 8; i += 1) {
    const start = new Date(base.getTime() + i * 30 * 60 * 1000);
    if (start.getUTCDay() === 0 || start.getUTCDay() === 6) {
      continue;
    }
    slots.push(start);
  }
  return slots;
}

async function main(): Promise<void> {
  const clinicCount = await prisma.clinic.count();
  if (clinicCount > 0) {
    console.info('Seed skipped: clinics already exist');
    return;
  }

  const clinic = await prisma.clinic.create({
    data: {
      name: 'Clínica Central Cali',
      address: 'Av. 6 Norte #12-34, Cali',
      phone: '+5723334455',
      timezone: 'America/Bogota',
    },
  });

  const doctor = await prisma.doctor.create({
    data: {
      clinicId: clinic.id,
      name: 'Dra. Laura Gómez',
      specialty: 'Medicina General',
      active: true,
    },
  });

  for (let day = 1; day <= 5; day += 1) {
    for (const startTime of hoursOnDay(day)) {
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      await prisma.slot.create({
        data: {
          clinicId: clinic.id,
          doctorId: doctor.id,
          startTime,
          endTime,
          isBooked: false,
        },
      });
    }
  }

  console.info(`Seeded clinic ${clinic.id} with doctor ${doctor.id} and availability slots`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
