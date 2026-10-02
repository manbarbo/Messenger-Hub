---
name: prisma-pgvector
description: "Use when working with Prisma ORM and pgvector in PostgreSQL. Triggers: Prisma schema changes, migrations, raw queries ($queryRaw), seed scripts, pgvector embedding columns, IVFFlat/HNSW indexes, cosine similarity search, database connection management. Load this skill BEFORE writing or changing Prisma schema, creating migrations, or implementing repository adapters."
metadata:
  author: messengerhub
  version: "1.0.0"
---

# Prisma + pgvector Skill

Comprehensive guide for using Prisma ORM with PostgreSQL and pgvector for semantic search in the MessengerHub project.

## When to Apply

- Designing or modifying Prisma schema (`prisma/schema.prisma`)
- Creating or running migrations (`prisma migrate dev`)
- Writing raw SQL queries (`$queryRaw`, `$executeRaw`)
- Working with pgvector embeddings (vector columns, cosine distance)
- Writing seed scripts (`prisma/seed.ts`)
- Implementing repository adapters that use PrismaClient
- Debugging Prisma errors or connection issues

## Core Principles

1. **Schema is the source of truth** — `prisma/schema.prisma` defines the PostgreSQL schema. Migrations are generated from it.
2. **PrismaClient for CRUD** — Use the generated client for standard queries. Use `$queryRaw` only for complex operations (pgvector, aggregation).
3. **Never import PrismaClient in domain/application layers** — It belongs in infrastructure only.
4. **Transactions for multi-table operations** — Use `prisma.$transaction()` for atomic operations (e.g., appointment + slot update).

## Schema Design

### pgvector Column

```prisma
model KnowledgeDocument {
  id        String              @id @default(uuid()) @db.Uuid
  clinicId  String              @map("clinic_id") @db.Uuid
  title     String
  content   String
  category  String
  embedding Unsupported("vector(768)")
  createdAt DateTime            @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime            @updatedAt @map("updated_at") @db.Timestamptz

  @@index([clinicId])
  @@index("embedding", ops: CosineDistance)
  @@map("knowledge_documents")
}
```

**Key points:**
- Use `Unsupported("vector(768)")` for the embedding column (Prisma doesn't natively support pgvector)
- Dimension size must match your embedding model (768 for Google `text-embedding-004`, 1536 for OpenAI `text-embedding-3-small`)
- The `@@index("embedding", ops: CosineDistance)` creates an index for cosine similarity

### Unique Constraints

```prisma
model Slot {
  id       String @id @default(uuid()) @db.Uuid
  doctorId String @map("doctor_id") @db.Uuid
  startTime DateTime @map("start_time") @db.Timestamptz
  // ... other fields

  @@unique([doctorId, startTime])
  @@map("slots")
}

model Appointment {
  id     String @id @default(uuid()) @db.Uuid
  slotId String @unique @map("slot_id") @db.Uuid
  // ... other fields

  @@map("appointments")
}
```

**Key points:**
- `@@unique([doctorId, startTime])` prevents duplicate slots for the same doctor
- `@unique` on `slotId` prevents double-booking (one appointment per slot)

### Timestamp Convention

All timestamps use `@db.Timestamptz` (UTC storage):
```prisma
createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
```

## Raw Queries

### pgvector Cosine Similarity

```typescript
const results = await prisma.$queryRaw`
  SELECT id, title, content, category,
         1 - (embedding <=> ${queryVector}::vector) AS similarity
  FROM knowledge_documents
  WHERE clinic_id = ${clinicId}::uuid
    AND 1 - (embedding <=> ${queryVector}::vector) > 0.7
  ORDER BY embedding <=> ${queryVector}::vector
  LIMIT ${limit}
`;
```

**Key points:**
- `<=>` is the cosine distance operator
- `1 - distance` gives similarity (higher is better)
- Cast `queryVector` as `::vector`
- Cast UUIDs as `::uuid`
- Threshold 0.7 is a good starting point; adjust based on quality

### IVFFlat Index Creation

After adding the embedding column via migration, create the index:
```sql
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_embedding
  ON knowledge_documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**Key points:**
- `lists` should be ~`rows / 1000` for datasets under 1M rows
- For > 1M rows, consider HNSW index instead
- Run `ANALYZE` after creating the index

### Aggregation Queries

```typescript
const metrics = await prisma.$queryRaw`
  SELECT
    a.id AS agent_id,
    a.name AS agent_name,
    COUNT(i.id) AS total_interactions,
    COUNT(i.id) FILTER (WHERE i.status = 'RESOLVED') AS total_resolved
  FROM agents a
  LEFT JOIN interactions i ON i.agent_id = a.id
  GROUP BY a.id, a.name
`;
```

## Transactions

### Atomic Operations

```typescript
const appointment = await prisma.$transaction(async (tx) => {
  // 1. Verify slot is available
  const slot = await tx.slot.findUnique({ where: { id: slotId } });
  if (!slot || slot.isBooked) {
    throw new SlotAlreadyBookedError(slotId);
  }

  // 2. Create appointment
  const appointment = await tx.appointment.create({
    data: { clinicId, doctorId, slotId, patientPhone, patientName, status: 'CONFIRMED' },
  });

  // 3. Mark slot as booked
  await tx.slot.update({
    where: { id: slotId },
    data: { isBooked: true },
  });

  return appointment;
});
```

**Key points:**
- If any step fails, all changes roll back
- The slot check and booking are atomic (no race condition)
- Use interactive transactions for multi-step operations

## Migrations

### Workflow

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate migration
npx prisma migrate dev --name add_knowledge_documents
# 3. Apply migration
npx prisma migrate deploy
# 4. Regenerate client
npx prisma generate
```

### pgvector Extension

The first migration should enable pgvector:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Add this as a raw SQL step in your migration or as a separate migration.

### Custom SQL in Migrations

After Prisma generates the migration SQL, you can augment it:
```sql
-- Prisma generates:
CREATE TABLE knowledge_documents (...);

-- You add:
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE knowledge_documents ADD COLUMN embedding vector(768);
CREATE INDEX idx_knowledge_docs_embedding ON knowledge_documents
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## Seed Scripts

### Structure

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Create clinics
  // 2. Create doctors
  // 3. Create slots (2 weeks, weekdays, 8AM-6PM, 30min intervals)
  // 4. Create knowledge documents with embeddings
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Generating Embeddings in Seed

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL,
});

async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: process.env.EMBEDDING_MODEL || 'text-embedding-004',
    input: text,
  });
  return response.data[0].embedding;
}

// In seed:
for (const doc of documents) {
  const embedding = await embed(doc.content);
  await prisma.knowledgeDocument.create({
    data: { ...doc, embedding },
  });
}
```

## Repository Adapter Pattern

```typescript
@Injectable()
export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(private prisma: PrismaService) {}

  async create(appointment: CreateAppointmentDto): Promise<Appointment> {
    return this.prisma.$transaction(async (tx) => {
      const slot = await tx.slot.findUnique({ where: { id: appointment.slotId } });
      if (!slot || slot.isBooked) throw new SlotAlreadyBookedError(appointment.slotId);

      const created = await tx.appointment.create({ data: appointment });
      await tx.slot.update({ where: { id: appointment.slotId }, data: { isBooked: true } });

      return created;
    });
  }

  async findById(id: string): Promise<Appointment | null> {
    return this.prisma.appointment.findUnique({ where: { id } });
  }
}
```

## Common Pitfalls

1. **Forgetting `::vector` cast** — Raw SQL with pgvector needs explicit casting: `${vector}::vector`
2. **Forgetting `::uuid` cast** — UUID parameters need casting in raw SQL
3. **Missing `@map`** — Prisma uses camelCase by default; `@map` maps to snake_case in DB
4. **Not running `prisma generate`** — After schema changes, regenerate the client
5. **Embedding dimension mismatch** — Ensure seed embeddings match the schema's vector dimension
6. **IVFFlat on empty table** — IVFFlat index requires at least some rows; create index after seeding

## References

- [Prisma Docs](https://www.prisma.io/docs)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [pgvector Indexing](https://github.com/pgvector/pgvector#indexing)
- [DESIGN.md](../../DESIGN.md) — Section 1 (Data Model)
- [AGENTS.md](../../AGENTS.md) — Section 15 (Database)