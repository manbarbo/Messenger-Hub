# Messenger Hub - AI Clinic Assistant

A robust, AI-powered scheduling assistant that processes incoming messaging events (WhatsApp), consults real clinic knowledge (RAG), and schedules appointments securely without hallucinating data. Built with strict validation, background processing, and complete observability.

## Problem Statement

A clinic with 2 locations and several professionals handles customer inquiries via WhatsApp in Colombia (UTC-5). Patients ask about schedules, exam preparations, and request appointments. The clinic needs an AI assistant that can:

1. Answer questions based _only_ on the clinic's internal documents.
2. Check real-time availability and schedule appointments.
3. Escalate to a human agent when uncertain.
4. Provide full traceability for the clinic coordinator (tokens, latency, tool calls, costs).

The core challenge is reliability: the AI must not invent data, must validate all arguments before executing tools, and must handle timezone context accurately.

## Features

### Implemented (Phases 1–3)

#### Domain & Persistence Core

- Clean Architecture domain layer (entities, value objects, enums, repository interfaces, domain errors, events).
- Dual-database persistence adapters: PostgreSQL (Prisma + pgvector) for transactional data; MongoDB (driver) for conversations, messages, and AI traces.
- CQRS command/query handlers with mock-friendly repository interfaces.
- DB-level idempotency primitives (`messages.messageId` unique sparse index; `appointments.slotId` unique constraint).

#### AI Engine & Tool Calling (backend core, not yet exposed via HTTP)

Strictly controlled LLM execution using schema validation (Zod) for the following tools:

- `buscar_conocimiento`: Semantic search (RAG) over the clinic's knowledge base.
- `consultar_disponibilidad`: Real-time query of available slots.
- `agendar_cita`: Transactional insertion of appointments preventing double-booking.
- `escalar_a_humano`: Safe fallback for unresolvable queries.

Implemented pipeline components:

- `LLMService` interface + `GeminiLLMService` adapter (OpenAI SDK → Gemini endpoint) + `MockLLMService` for tests.
- `EmbeddingService` + `GeminiEmbeddingService` (`gemini-embedding-001`, 768 dimensions).
- `AIOrchestratorService`: prompt construction, tool-calling loop (max 5 iterations), validation feedback to the LLM, forced escalation, and AI trace persistence.
- Colombia timezone interpretation (`America/Bogota`, fixed UTC-5) in prompts and domain validation.
- Unit tests across domain, CQRS handlers, repositories, LLM/RAG/orchestration (Vitest).

### Planned (Phases 4–8 — backlog)

#### Webhook & Event Reception

- Fast HTTP response for incoming messages.
- Idempotency control at the webhook boundary: duplicate `message_id`s safely ignored.
- Background worker consuming from BullMQ (Redis) to decouple HTTP response from LLM latency.

#### Traceability & Monitoring (dashboard API + UI)

- Conversation inbox with state filtering.
- Conversation detail with message timeline and AI traces (tokens, latency, cost, tool calls).
- Patient simulator to send test messages.

#### Seed Data

- Full PostgreSQL seed (clinics, doctors, 2 weeks of availability, knowledge documents + embeddings) — **implemented (T-7.1)**.
- MongoDB seed with sample conversations and AI traces — **implemented (T-7.2)**.

> **Current async path:** `POST /webhooks/messages` validates and enqueues via `ProcessIncomingMessageCommand`; `QUEUE_SERVICE` is `BullMQQueueService` (`message-processing` + DLQ). Run the API (`pnpm --filter api start:dev`) and worker (`pnpm --filter api start:worker:dev`) as separate processes. Set `DEFAULT_CLINIC_ID` in `apps/api/.env` (or send `clinic_id` in the webhook body).

## Tech Stack

| Layer         | Technology             |
| ------------- | ---------------------- |
| Backend       | Node.js, NestJS        |
| Frontend      | Angular                |
| Relational DB | PostgreSQL (pgvector)  |
| Document DB   | MongoDB                |
| AI SDK        | Google Gemini API (OpenAI-compatible) / Zod |
| Monorepo      | pnpm workspaces        |
| Infra         | Docker Compose         |

### Documentation

- **[AGENTS.md](./AGENTS.md)** — Development rules, architecture patterns, and coding constraints
- **[DESIGN.md](./DESIGN.md)** — Data model, API contracts, AI pipeline design, and AWS architecture
- **[DECISIONS.md](./DECISIONS.md)** — Architectural decision record detailing data modeling (SQL vs NoSQL), AWS production design, LLM orchestration, and trade-offs

## Architecture

The backend implements Clean Architecture (Presentation → Application → Domain ← Infrastructure) principles to isolate the AI logic from business rules and persistence:

- **Data Segregation**: PostgreSQL handles the core transactional domain (Clinics, Slots, Appointments, pgvector for RAG) where ACID properties and constraints are mandatory. MongoDB handles high-volume, flexible schema data (Chat history, AI execution traces).
- **Asynchronous Processing**: `POST /webhooks/messages` responds immediately (`202` / `200 duplicate`); a separate BullMQ worker process consumes jobs, runs the AI orchestrator, and persists responses/traces.
- **Fail-Safe Tool Calling**: AI outputs are treated as untrusted input. They are validated against domain rules (e.g., timezone parsing in UTC-5, valid clinic IDs) before hitting the database.
- **Idempotency**: Handled at the database level to prevent duplicate processing.

## Implementation Status

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 1 | Foundation (scaffolding, domain, databases) | Completed |
| 2 | Backend core data (PG/Mongo repos, CQRS) | Completed |
| 3 | AI pipeline (LLM, RAG, tool validation, orchestration) | Completed |
| 4 | Async processing (queue, worker, webhook) | Completed |
| 5 | API layer (controllers, routes, error handling) | Completed |
| 6 | Frontend (Angular dashboard + simulator) | Completed |
| 7 | Seed data (PG knowledge base + Mongo samples) | Completed |
| 8 | Testing & coverage gate (≥ 75%) | Completed |
| 9 | Logging (backend Winston + frontend error tracking) | Completed |

See [plans/master_plan.md](./plans/master_plan.md) for the full task breakdown.

## Project Structure

```
MessengerHub/
├── .agents/
│   └── skills/                  # AI agent skills (postgres-best-practices, prisma-pgvector, mongodb-nestjs, llm-tool-calling, docker-setup)
├── .opencode/
│   └── opencode.json            # OpenCode agents and commands config
├── apps/
│   ├── api/                     # NestJS backend (API + Worker)
│   │   ├── prisma/              # Schema, migrations, full PG seed (clinics/doctors/slots/knowledge)
│   │   ├── scripts/             # Operational scripts (mongo indexes, Mongo sample seed)
│   │   └── src/
│   │       ├── domain/          # Entities, VOs, enums, repository/service interfaces, errors, events
│   │       ├── application/     # CQRS handlers, DTOs, AI orchestration (LLM + RAG + tools)
│   │       ├── infrastructure/  # Postgres (pgvector) & Mongo adapters, LLM/embedding clients, BullMQ queue
│   │       └── presentation/    # Placeholder — controllers arrive in Phase 5
│   └── web/                     # Angular frontend (Dashboard & Simulator)
│       └── src/
│           ├── app/
│           │   ├── conversations/  # Conversation inbox and detail views (Phase 6)
│           │   ├── simulator/      # Patient message simulator (Phase 6)
│           │   ├── shared/         # Reusable components, services, interceptors (Phase 6)
│           │   └── core/           # Guards, models, API service (Phase 6)
│           ├── assets/
│           └── environments/
├── docs/                        # Placeholder — knowledge base seed documents (Phase 7)
├── plans/                       # Task plans
│   ├── backlog/                 # Pending tasks
│   ├── inProgress/              # Active tasks
│   ├── completed/               # Finished tasks
│   └── master_plan.md           # High-level implementation overview
├── AGENTS.md
├── DECISIONS.md
├── DESIGN.md
├── README.md
├── docker-compose.yml
└── package.json
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- Docker and Docker Compose
- Google Gemini API key (free tier at [aistudio.google.com](https://aistudio.google.com/apikey))

### Installation & Setup

1. Clone the repository and install dependencies:

```bash
pnpm install
```

2. Create environment variables from the API template:

```bash
cp apps/api/.env.example apps/api/.env
```

_Make sure to add your `LLM_API_KEY` to `apps/api/.env`. The template includes `LLM_BASE_URL` (Gemini OpenAI-compatible endpoint), `EMBEDDING_MODEL`/`EMBEDDING_DIMENSIONS`, `DATABASE_URL`, `MONGODB_URI`, and Redis settings._

3. Start the infrastructure (PostgreSQL + MongoDB + Redis):

```bash
docker compose up -d
```

4. Run PostgreSQL migrations and seeds (clinics/doctors/slots/knowledge in PG; sample conversations in Mongo). Set `DEFAULT_CLINIC_ID` in `apps/api/.env` to a seeded clinic UUID printed by the PG seed script:

```bash
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm --filter api seed:mongo
```

`seed:mongo` looks up Clínica Norte / Clínica Sur clinic ids from PostgreSQL, then inserts 3 sample conversations (resolved_by_ai, appointment_booked, escalated) with messages and AI traces.

Optionally ensure MongoDB indexes are present:

```bash
pnpm --filter api mongo:indexes
```

### Running the Application

```bash
# Start backend (API)
pnpm run dev:api

# Start frontend dashboard (in a separate terminal; features land in Phase 6)
pnpm run dev:web

# Or both in parallel
pnpm dev
```

## Testing

Minimum coverage target: **75%** (branches, functions, lines, statements) — enforced in Phase 8.

```bash
# All tests
pnpm test

# Backend only (Vitest)
pnpm --filter api test

# Frontend only
pnpm --filter web test

# Coverage
pnpm --filter api test:cov
pnpm --filter web test:cov
```

Backend unit tests currently cover domain entities, tool calling validation (Zod schemas, domain rules), CQRS handlers, repository contracts, LLM orchestration (iteration limits, error handling, escalation), and infrastructure adapters.

Unit tests use mock repositories, mock LLM services, and mock event publishers — no real database, HTTP server, or LLM API required.

## API Endpoints

> **Status:** Planned for Phase 5 (controllers/routes are not exposed yet). The contracts below are the target API described in [DESIGN.md](./DESIGN.md#5-api-contracts).

| Method | Path                     | Description                                     |
| ------ | ------------------------ | ----------------------------------------------- |
| `POST` | `/webhooks/messages`     | Receives incoming messages (simulates WhatsApp) |
| `GET`  | `/api/conversations`     | Lists conversations for the dashboard           |
| `GET`  | `/api/conversations/:id` | Gets conversation details and AI traces         |
| `POST` | `/api/simulator`         | Sends a test message as if from a patient       |

Currently the API only exposes NestJS bootstrap health routes (`GET /`, `GET /health`) until Phase 5 lands.

## License

Private — for evaluation purposes only.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| PostgreSQL for transactional data | ACID guarantees for appointments, unique constraints prevent double-booking, pgvector for RAG |
| MongoDB for conversations/traces | Flexible schema for variable AI trace structure, write-heavy workload, natural document model |
| Async processing via queue | LLM latency (5–30s) must not block webhook response |
| Idempotency at DB level | `message_id` unique index + `slot_id` unique constraint prevent duplicates under concurrency |
| UTC storage, Colombia timezone interpretation | "Mañana" at 10:40 PM in Cali means tomorrow, not the day after |
| Zod validation for LLM outputs | LLM arguments are untrusted input; must be validated before execution |
| pgvector over dedicated vector DB | Single database for knowledge + clinic data; Google `gemini-embedding-001` (768 dimensions) for embeddings |
| Max 5 tool-call iterations | Prevents infinite loops; forces escalation if unresolved |

Full decision record in [DECISIONS.md](./DECISIONS.md).

## Logging (Phase 9 — Planned)

| Component | Technology | Purpose |
|-----------|------------|---------|
| Backend Logger | Winston | Structured logging with `Logger` interface + `LOGGER` DI token |
| HTTP Logging | NestJS Interceptor | Request/response with method, path, status, duration, sanitized body |
| Log Rotation | winston-daily-rotate-file | `logs/error-*.log`, `logs/combined-*.log` (20MB, 14 days) |
| Frontend Logger | Angular `LoggerService` | Dev: colorized console. Prod: JSON + localStorage persistence |
| Error Capture | `ErrorHandler` + window listeners | Unhandled component errors, runtime errors, promise rejections |
| Error Boundary | `ErrorBoundaryComponent` | Fallback UI on unhandled errors |

See [DECISIONS.md §17](./DECISIONS.md#17-structured-logging) and [DESIGN.md §10](./DESIGN.md#10-logging-architecture) for details.
