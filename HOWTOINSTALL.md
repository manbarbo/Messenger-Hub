# HOWTOINSTALL — MessengerHub

Complete guide to install, configure, and run MessengerHub locally.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone & Install Dependencies](#2-clone--install-dependencies)
3. [Docker Infrastructure](#3-docker-infrastructure)
4. [Environment Variables (.env)](#4-environment-variables-env)
5. [Database Setup — PostgreSQL](#5-database-setup--postgresql)
6. [Database Setup — MongoDB](#6-database-setup--mongodb)
7. [Run the Application](#7-run-the-application)
8. [Verify the Installation](#8-verify-the-installation)
9. [Useful Commands](#9-useful-commands)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | >= 20 | Required by root `package.json` engines |
| **pnpm** | >= 10 (project uses 10.12.1) | Package manager for workspaces |
| **Docker + Docker Compose** | Latest | PostgreSQL, MongoDB, Redis containers |
| **Google Gemini API Key** | Free tier | Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

### Install pnpm (if needed)

```bash
npm install -g pnpm@10
```

### Verify installations

```bash
node -v      # >= 20
pnpm -v      # >= 10
docker -v
docker compose version
```

---

## 2. Clone & Install Dependencies

```bash
git clone <repository-url>
cd MessengerHub
pnpm install
```

> **Note:** pnpm 10 requires approval for certain post-install scripts. The project already allows:
> `@prisma/client`, `@prisma/engines`, `prisma`, `esbuild`, `@parcel/watcher`, `@swc/core`.

---

## 3. Docker Infrastructure

Start the required services (PostgreSQL with pgvector, MongoDB, Redis):

```bash
docker compose up -d
```

### Services overview

| Service | Image | Container | Host Port | Credentials |
|---------|-------|-----------|-----------|-------------|
| **PostgreSQL** | `pgvector/pgvector:pg16` | `messengerhub-postgres` | `5432` | user: `messenger` / pass: `messenger` / db: `messenger_hub` |
| **MongoDB** | `mongo:7` | `messengerhub-mongo` | `27017` | root: `messenger` / pass: `messenger` / db: `messenger_hub` |
| **Redis** | `redis:7-alpine` | `messengerhub-redis` | `6379` | none |

### Verify containers are healthy

```bash
docker compose ps
```

All services should show `healthy` status.

### Stop / reset infrastructure

```bash
docker compose stop          # Stop containers (keep data)
docker compose start         # Restart stopped containers
docker compose down          # Stop and remove containers (keep volumes)
docker compose down -v       # Stop and DELETE all data volumes (clean slate)
```

### Verify pgvector extension

```bash
docker exec -it messengerhub-postgres psql -U messenger -d messenger_hub \
  -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

---

## 4. Environment Variables (.env)

### Create the env file

```bash
cp apps/api/.env.example apps/api/.env
```

### Required configuration

Edit `apps/api/.env` and set the following:

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_API_KEY` | **YES** | Google Gemini API key. Required for LLM calls and knowledge embeddings during seed. |
| `DEFAULT_CLINIC_ID` | **YES** (after seed) | UUID of the default clinic. Copy from seed output. |

### Full `.env` template

```env
# ─── LLM (Gemini via OpenAI-compatible endpoint) ───────────────────────────
LLM_API_KEY=your-gemini-api-key-here
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL=gemini-3.8-flash
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=768

# ─── PostgreSQL (Prisma) ────────────────────────────────────────────────────
DATABASE_URL=postgresql://messenger:messenger@localhost:5432/messenger_hub

# ─── MongoDB ────────────────────────────────────────────────────────────────
MONGODB_URI=mongodb://messenger:messenger@localhost:27017/messenger_hub?authSource=admin
MONGODB_DB=messenger_hub

# ─── Redis (BullMQ) ─────────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379

# ─── API ────────────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:4200

# ─── Queue UI (Bull Board) ──────────────────────────────────────────────────
BULL_BOARD_ENABLED=true
BULL_BOARD_PATH=/admin/queues
# BULL_BOARD_USERNAME=admin
# BULL_BOARD_PASSWORD=change-me

# ─── Default Clinic ─────────────────────────────────────────────────────────
# Set this AFTER running the PostgreSQL seed (copy UUID from seed output)
DEFAULT_CLINIC_ID=your-clinic-uuid-here
```

### Environment variable reference

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_API_KEY` | — | Gemini API key (required) |
| `LLM_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` | Gemini OpenAI-compatible endpoint |
| `LLM_MODEL` | `gemini-3.8-flash` | Chat model |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Embedding model (must match for index + query) |
| `EMBEDDING_DIMENSIONS` | `768` | Vector dimensions |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `MONGODB_URI` | — | MongoDB connection string (must include `?authSource=admin`) |
| `MONGODB_DB` | parsed from URI, else `messenger_hub` | MongoDB database name |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `PORT` | `3000` | API listen port |
| `NODE_ENV` | `development` | Environment mode |
| `CORS_ORIGIN` | `http://localhost:4200` | Allowed CORS origin (Angular dev) |
| `BULL_BOARD_ENABLED` | `true` in dev | Enable queue UI |
| `BULL_BOARD_PATH` | `/admin/queues` | Queue UI mount path |
| `BULL_BOARD_USERNAME` | — | Optional basic auth username |
| `BULL_BOARD_PASSWORD` | — | Optional basic auth password |
| `DEFAULT_CLINIC_ID` | — | Fallback clinic UUID for webhook/simulator |
| `SEED_RESET` | — | `true`/`1` to wipe and reseed databases |

> **Config loading:** NestJS loads `.env` from `apps/api/.env` (or root `.env` as fallback).

---

## 5. Database Setup — PostgreSQL

### Step 1: Run migrations

```bash
pnpm --filter api db:migrate
```

This creates all tables and enables pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX "idx_knowledge_docs_embedding" ON "knowledge_documents"
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**Tables created:** `clinics`, `doctors`, `slots`, `appointments`, `knowledge_documents`

### Step 2: Seed data

```bash
pnpm --filter api db:seed
```

> **Important:** Seed requires `LLM_API_KEY` to generate embeddings for knowledge documents.

**What the seed creates:**

| Dataset | Details |
|---------|---------|
| Clinics | 2: Clínica Norte (Cali), Clínica Sur (Bogotá) — timezone `America/Bogota` |
| Doctors | 8 across 4 specialties (Cardiología, Dermatología, Medicina General, Pediatría) |
| Slots | ~1600 — 2-week weekday window, 8:00–17:30 Colombia, 30-min slots |
| Knowledge docs | 12 with `gemini-embedding-001` embeddings (768 dims) |

### Step 3: Copy clinic UUID

The seed prints clinic IDs like:

```text
clinicId[Clínica Norte]=562cae89-b373-4025-a757-3f80f0ac0752
clinicId[Clínica Sur]=fe6064e2-84a5-4ab2-bb4d-04a4f1383e3a
```

Copy one into `apps/api/.env`:

```env
DEFAULT_CLINIC_ID=562cae89-b373-4025-a757-3f80f0ac0752
```

> **Note:** UUIDs differ per environment. Always use the values printed by your seed run.

### Reseed (optional)

```bash
# Wipe and reseed PostgreSQL
SEED_RESET=true pnpm --filter api db:seed
```

### Browse data (optional)

```bash
pnpm --filter api db:studio
```

Opens Prisma Studio at `http://localhost:5555`.

---

## 6. Database Setup — MongoDB

> **Prerequisite:** PostgreSQL seed must run first (Mongo seed looks up clinic UUIDs).

### Seed conversations and messages

```bash
pnpm --filter api seed:mongo
```

**What the seed creates:**

| Conversation | Status | Clinic | Messages | AI Traces |
|--------------|--------|--------|----------|-----------|
| `seed-conv-resolved-001` | `resolved_by_ai` | Clínica Norte | 6 | `buscar_conocimiento` |
| `seed-conv-booked-002` | `appointment_booked` | Clínica Sur | 8 | `consultar_disponibilidad`, `agendar_cita` |
| `seed-conv-escalated-003` | `escalated` | Clínica Norte | 6 | `buscar_conocimiento`, `escalar_a_humano` |

**Collections:** `conversations`, `messages`, `ai_traces`

### Create indexes only (optional)

```bash
pnpm --filter api mongo:indexes
```

### Reseed (optional)

```bash
SEED_RESET=true pnpm --filter api seed:mongo
```

---

## 7. Run the Application

### Full stack (recommended)

```bash
pnpm dev
```

This starts all three processes concurrently:

| Process | Command | Port | Description |
|---------|---------|------|-------------|
| **API** | `pnpm --filter api start:dev` | `3000` | NestJS REST API + Bull Board |
| **Worker** | `pnpm --filter api start:worker:dev` | — | BullMQ consumer (LLM, RAG, appointments) |
| **Web** | `pnpm --filter web start` | `4200` | Angular dashboard |

### Run individually

```bash
pnpm run dev:api       # API only
pnpm run dev:worker    # Worker only (CRITICAL for AI pipeline)
pnpm run dev:web       # Angular only
```

> **Critical:** The AI pipeline (tool calling, RAG search, appointment booking) runs **only in the worker**. Starting the API alone leaves jobs stuck in the queue.

### Verify worker is running

Look for these log lines:

```text
MessengerHub worker started
Worker listening on queue
```

---

## 8. Verify the Installation

### Frontend (Angular)

| Page | URL |
|------|-----|
| Dashboard / Conversations | http://localhost:4200/conversations |
| Simulator | http://localhost:4200/simulator |
| Knowledge Base | http://localhost:4200/knowledge |

### Backend (API)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhooks/messages` | POST | Incoming messages |
| `/api/clinics` | GET | Clinic list |
| `/api/conversations` | GET | Conversation inbox |
| `/api/conversations/:id` | GET | Conversation detail + AI traces |
| `/api/simulator` | POST | Patient test message |
| `/api/knowledge` | GET/POST | Knowledge base CRUD |

### Queue UI (Bull Board)

Open: http://localhost:3000/admin/queues

Queues to monitor:
- `message-processing` — active jobs
- `message-processing-dlq` — dead letter queue (failed jobs)

### Quick smoke test

1. Open http://localhost:4200/simulator
2. Select a clinic
3. Send a test message (e.g., "Hola, quiero agendar una cita")
4. Wait for AI response
5. Check http://localhost:3000/admin/queues to see the job process

---

## 9. Useful Commands

### Development

```bash
pnpm dev                    # Full stack (API + Worker + Web)
pnpm run dev:api            # API only
pnpm run dev:worker         # Worker only
pnpm run dev:web            # Web only
```

### Database

```bash
pnpm --filter api db:migrate    # Run Prisma migrations
pnpm --filter api db:seed       # Seed PostgreSQL
pnpm --filter api db:studio     # Prisma Studio (GUI)
pnpm --filter api seed:mongo    # Seed MongoDB
pnpm --filter api mongo:indexes # Create MongoDB indexes
```

### Testing

```bash
pnpm test                     # All workspaces
pnpm --filter api test        # API tests (Vitest)
pnpm --filter web test        # Web tests (Angular/Vitest)
pnpm --filter api test:cov    # API with coverage
pnpm --filter web test:cov    # Web with coverage
```

### Code quality

```bash
pnpm lint                     # Lint all workspaces
pnpm format                   # Format with Prettier
pnpm format:check             # Check formatting
```

### Build

```bash
pnpm build                    # Build all workspaces
pnpm --filter api build       # Build API
pnpm --filter api build:worker # Build worker
pnpm --filter web build       # Build Angular
```

---

## 10. Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Jobs stuck `waiting` in Bull Board | Worker not running | Start worker: `pnpm run dev:worker` |
| Worker `EADDRINUSE :::3000` | API and worker conflict | Ensure `nest-cli.worker.json` has `entryFile: "worker-main"` at top level |
| PG seed fails on embeddings | Missing `LLM_API_KEY` | Set valid Gemini key in `apps/api/.env` |
| Mongo seed fails | PG seed not run yet | Run `pnpm --filter api db:seed` first |
| Port conflicts (5432/27017/6379) | Ports already in use | Change port mappings in `docker-compose.yml` |
| pgvector missing | Wrong Postgres image | Must use `pgvector/pgvector:pg16` |
| MongoDB auth failures | Missing auth source | URI must include `?authSource=admin` |
| CORS errors | Wrong origin | Set `CORS_ORIGIN=http://localhost:4200` in `.env` |
| Webhook 400 error | No clinic ID | Set `DEFAULT_CLINIC_ID` in `apps/api/.env` |
| LLM errors in worker | Invalid API key | Verify `LLM_API_KEY` at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Need fresh seed data | Stale data | Run with `SEED_RESET=true` |

### Reset everything (clean slate)

```bash
# 1. Stop and delete all data
docker compose down -v

# 2. Restart infrastructure
docker compose up -d

# 3. Re-run migrations and seeds
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm --filter api seed:mongo

# 4. Update DEFAULT_CLINIC_ID in apps/api/.env with new UUID from seed output
```

---

## Project Structure (Quick Reference)

```text
MessengerHub/
├── docker-compose.yml           # PostgreSQL + MongoDB + Redis
├── package.json                 # Root scripts (dev, build, test)
├── pnpm-workspace.yaml          # Workspace config
├── apps/
│   ├── api/                     # NestJS backend
│   │   ├── .env.example         # Environment template
│   │   ├── prisma/              # Schema, migrations, seeds
│   │   ├── scripts/             # Mongo seed, indexes
│   │   └── src/
│   │       ├── main.ts          # API entry (port 3000)
│   │       └── worker-main.ts   # Worker entry (no HTTP)
│   └── web/                     # Angular frontend (port 4200)
└── plans/                       # Task plans
```

---

## Architecture Notes

- **Timezone:** Colombia (`America/Bogota`, UTC-5) — all scheduling uses this timezone
- **LLM:** Gemini via OpenAI-compatible SDK (`LLM_BASE_URL`)
- **Embeddings:** Same model for indexing and querying (`gemini-embedding-001`, 768 dims)
- **Queue:** BullMQ on Redis — jobs retry up to 3 times before DLQ
- **Cross-DB consistency:** PostgreSQL commits first (appointments), then MongoDB (conversations)
- **Logging:** Winston backend → `logs/error-*.log` and `logs/combined-*.log`

---

## License

Private — for evaluation purposes only.
