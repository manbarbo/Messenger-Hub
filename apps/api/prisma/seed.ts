import { PrismaClient } from '@prisma/client';
import { SEED_CLINICS, SEED_DOCTORS } from './seeds/clinic-data';
import { SEED_KNOWLEDGE_DOCUMENTS } from './seeds/knowledge-documents';
import { createEmbeddingClient } from './seeds/embedding-client';
import { generateSlotStartTimes, slotEndTime } from './seeds/slot-generator';
import {
  SEED_TARGET_CLINIC_NAMES,
  toPgVector,
  type SeedClinicInput,
  type SeedDoctorInput,
  type SeedKnowledgeDocumentInput,
} from './seeds/types';

const prisma = new PrismaClient();

function isTruthyEnv(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

async function isAlreadySeeded(): Promise<boolean> {
  const clinicCount = await prisma.clinic.count({
    where: { name: { in: [...SEED_TARGET_CLINIC_NAMES] } },
  });
  if (clinicCount < SEED_TARGET_CLINIC_NAMES.length) {
    return false;
  }

  const documentCount = await prisma.knowledgeDocument.count({
    where: { clinic: { name: { in: [...SEED_TARGET_CLINIC_NAMES] } } },
  });
  return documentCount >= SEED_KNOWLEDGE_DOCUMENTS.length;
}

async function resetSeedData(): Promise<void> {
  console.info('Resetting PostgreSQL seed data (appointments, slots, knowledge, doctors, clinics)...');
  await prisma.$transaction([
    prisma.appointment.deleteMany(),
    prisma.slot.deleteMany(),
    prisma.knowledgeDocument.deleteMany(),
    prisma.doctor.deleteMany(),
    prisma.clinic.deleteMany(),
  ]);
}

async function seedClinics(): Promise<Map<string, string>> {
  const clinicIdByName = new Map<string, string>();

  for (const clinic of SEED_CLINICS as SeedClinicInput[]) {
    const created = await prisma.clinic.create({ data: clinic });
    clinicIdByName.set(clinic.name, created.id);
    console.info(`Seeded clinic ${created.name} (${created.id})`);
  }

  return clinicIdByName;
}

async function seedDoctors(clinicIdByName: Map<string, string>): Promise<Map<string, string>> {
  const doctorIdByName = new Map<string, string>();

  for (const doctor of SEED_DOCTORS as SeedDoctorInput[]) {
    const clinicId = clinicIdByName.get(doctor.clinicName);
    if (!clinicId) {
      throw new Error(`Clinic not found for doctor seed: ${doctor.clinicName}`);
    }

    const created = await prisma.doctor.create({
      data: {
        clinicId,
        name: doctor.name,
        specialty: doctor.specialty,
        active: true,
      },
    });
    doctorIdByName.set(doctor.name, created.id);
  }

  console.info(`Seeded ${doctorIdByName.size} doctors across ${clinicIdByName.size} clinics`);
  return doctorIdByName;
}

async function seedSlots(
  clinicIdByName: Map<string, string>,
  doctorIdByName: Map<string, string>,
): Promise<number> {
  const startTimes = generateSlotStartTimes(new Date());
  const rows: Array<{
    clinicId: string;
    doctorId: string;
    startTime: Date;
    endTime: Date;
    isBooked: boolean;
  }> = [];

  for (const doctor of SEED_DOCTORS as SeedDoctorInput[]) {
    const clinicId = clinicIdByName.get(doctor.clinicName);
    const doctorId = doctorIdByName.get(doctor.name);
    if (!clinicId || !doctorId) {
      throw new Error(`Missing clinic or doctor id for slot seed: ${doctor.name}`);
    }

    for (const startTime of startTimes) {
      rows.push({
        clinicId,
        doctorId,
        startTime,
        endTime: slotEndTime(startTime),
        isBooked: false,
      });
    }
  }

  if (rows.length === 0) {
    throw new Error('No slot rows generated — check seed window and Colombia timezone logic');
  }

  await prisma.slot.createMany({ data: rows });
  console.info(`Seeded ${rows.length} availability slots (2-week weekday window, 8 AM–6 PM Colombia)`);
  return rows.length;
}

async function seedKnowledgeDocuments(clinicIdByName: Map<string, string>): Promise<number> {
  const embeddingClient = createEmbeddingClient();
  let embeddedCount = 0;

  for (const doc of SEED_KNOWLEDGE_DOCUMENTS as SeedKnowledgeDocumentInput[]) {
    const clinicId = clinicIdByName.get(doc.clinicName);
    if (!clinicId) {
      throw new Error(`Clinic not found for knowledge seed: ${doc.clinicName}`);
    }

    const created = await prisma.knowledgeDocument.create({
      data: {
        clinicId,
        title: doc.title,
        content: doc.content,
        category: doc.category,
      },
    });

    const embedding = await embeddingClient.embed(`${doc.title}\n${doc.content}`);
    const vectorLiteral = toPgVector(embedding);
    await prisma.$executeRaw`
      UPDATE knowledge_documents
      SET embedding = ${vectorLiteral}::vector
      WHERE id = ${created.id}::uuid
    `;
    embeddedCount += 1;
    console.info(`Seeded knowledge document "${doc.title}" with ${embedding.length}-dim embedding`);
  }

  return embeddedCount;
}

async function main(): Promise<void> {
  if (!isTruthyEnv(process.env.SEED_RESET) && (await isAlreadySeeded())) {
    console.info(
      'Seed skipped: Clínica Norte/Clínica Sur and knowledge documents already exist. Set SEED_RESET=true to reseed.',
    );
    return;
  }

  await resetSeedData();

  const clinicIdByName = await seedClinics();
  const doctorIdByName = await seedDoctors(clinicIdByName);
  const slotCount = await seedSlots(clinicIdByName, doctorIdByName);
  const documentCount = await seedKnowledgeDocuments(clinicIdByName);

  console.info('PostgreSQL seed completed:');
  console.info(`  clinics=${clinicIdByName.size} doctors=${doctorIdByName.size}`);
  console.info(`  slots=${slotCount} knowledgeDocuments=${documentCount}`);
  for (const [name, id] of clinicIdByName) {
    console.info(`  clinicId[${name}]=${id}`);
  }
  console.info('Set DEFAULT_CLINIC_ID in apps/api/.env to one of the clinic ids above.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
