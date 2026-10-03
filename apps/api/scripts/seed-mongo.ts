import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';
import { MONGO_INDEX_SPECS } from '../src/infrastructure/database/mongo-indexes';
import { buildMongoSeedDocuments } from './mongo-seeds/document-builder';
import { SEED_CONVERSATION_SPECS } from './mongo-seeds/sample-conversations';
import { SEED_CLINIC_NAMES } from './mongo-seeds/types';

const DEFAULT_MONGO_URI =
  'mongodb://messenger:messenger@localhost:27017/messenger_hub?authSource=admin';
const DEFAULT_DB_NAME = 'messenger_hub';

function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function resolveDbName(uri: string): string {
  try {
    const url = new URL(uri);
    const path = url.pathname.replace(/^\//, '');
    return path.length > 0 ? path : DEFAULT_DB_NAME;
  } catch {
    return DEFAULT_DB_NAME;
  }
}

async function loadClinicIds(prisma: PrismaClient): Promise<Map<string, string>> {
  const clinics = await prisma.clinic.findMany({
    where: { name: { in: [...SEED_CLINIC_NAMES] } },
    select: { id: true, name: true },
  });

  const clinicIdByName = new Map<string, string>();
  for (const clinic of clinics) {
    clinicIdByName.set(clinic.name, clinic.id);
  }

  const missing = SEED_CLINIC_NAMES.filter((name) => !clinicIdByName.has(name));
  if (missing.length > 0) {
    throw new Error(
      `Missing PostgreSQL clinics for Mongo seed: ${missing.join(', ')}. Run \`pnpm --filter api db:seed\` first.`,
    );
  }

  return clinicIdByName;
}

async function main(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), '.env'));

  const uri = process.env.MONGODB_URI ?? DEFAULT_MONGO_URI;
  const dbName = process.env.MONGODB_DB ?? resolveDbName(uri);
  const prisma = new PrismaClient();
  const mongoClient = new MongoClient(uri);

  try {
    await mongoClient.connect();
    const mongoDb = mongoClient.db(dbName);

    for (const spec of MONGO_INDEX_SPECS) {
      const options = spec.options ?? {};
      await mongoDb
        .collection(spec.collection)
        .createIndex(spec.key as Record<string, 1>, options);
    }

    const seededIds = SEED_CONVERSATION_SPECS.map((spec) => spec.id);
    const alreadySeeded = await mongoDb
      .collection('conversations')
      .countDocuments({ _id: { $in: seededIds } });

    if (!isTruthyEnv(process.env.SEED_RESET) && alreadySeeded >= SEED_CONVERSATION_SPECS.length) {
      console.info(
        'Mongo seed skipped: sample conversations already exist. Set SEED_RESET=true to reseed.',
      );
      return;
    }

    console.info('Resetting MongoDB seed data (ai_traces, messages, conversations)...');
    await mongoDb.collection('ai_traces').deleteMany({});
    await mongoDb.collection('messages').deleteMany({});
    await mongoDb.collection('conversations').deleteMany({});

    const clinicIdByName = await loadClinicIds(prisma);
    const built = buildMongoSeedDocuments(SEED_CONVERSATION_SPECS, clinicIdByName, {
      baseTime: new Date(),
    });

    await mongoDb.collection('conversations').insertMany(built.conversations);
    await mongoDb.collection('messages').insertMany(built.messages);
    await mongoDb.collection('ai_traces').insertMany(built.aiTraces);

    console.info('MongoDB seed completed:');
    console.info(
      `  conversations=${built.conversations.length} messages=${built.messages.length} aiTraces=${built.aiTraces.length}`,
    );

    const clinicNameById = new Map(
      [...clinicIdByName.entries()].map(([name, id]) => [id, name] as const),
    );
    for (const conversation of built.conversations) {
      console.info(
        `  conversation ${conversation._id} status=${conversation.status} clinic=${clinicNameById.get(conversation.clinicId) ?? conversation.clinicId}`,
      );
    }
  } finally {
    await mongoClient.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
