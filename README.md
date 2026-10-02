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

### Webhook & Event Reception

- Fast HTTP response for incoming messages.
- Idempotency control: Duplicate `message_id`s are safely ignored.
- Background processing mechanism to decouple HTTP response from LLM latency.

### AI Engine & Tool Calling

Strictly controlled LLM execution using schema validation (Zod) for the following tools:

- `buscar_conocimiento`: Semantic search (RAG) over the clinic's knowledge base.
- `consultar_disponibilidad`: Real-time query of available slots.
- `agendar_cita`: Transactional insertion of appointments preventing double-booking.
- `escalar_a_humano`: Safe fallback for unresolvable queries.

### Traceability & Monitoring

Every interaction logs exact metrics to a NoSQL database for auditing:

- Model used, execution latency, and total cost/tokens.
- Detailed trace of tools called, arguments proposed by the AI, and the exact result returned by the system.
- Final conversation state (`resuelta_por_ia`, `cita_agendada`, `escalada`).

### Minimalist Dashboard

- Simulator to test incoming patient messages.
- Conversation inbox with state filtering.
- Detailed view of the AI's "thought process" and tool executions.

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
- **Asynchronous Processing**: Webhooks push events to a queue, processed by a background worker to handle LLM latency gracefully.
- **Fail-Safe Tool Calling**: AI outputs are treated as untrusted input. They are validated against domain rules (e.g., timezone parsing in UTC-5, valid clinic IDs) before hitting the database.
- **Idempotency**: Handled at the database level to prevent duplicate processing.

## Project Structure

```
MessengerHub/
├── .agents/
│   └── skills/                  # AI agent skills (postgres-best-practices, prisma-pgvector, mongodb-nestjs, llm-tool-calling, docker-setup)
├── .opencode/
│   └── opencode.json            # OpenCode agents and commands config
├── apps/
│   ├── api/                     # NestJS backend (API + Worker)
│   │   └── src/
│   │       ├── domain/          # Entities, repository interfaces, AI tool schemas
│   │       ├── application/     # Use cases, LLM orchestration, RAG logic
│   │       ├── infrastructure/  # Postgres (pgvector) & Mongo adapters, LLM clients
│   │       └── presentation/    # Express endpoints (webhook, dashboard API)
│   └── web/                     # Angular frontend (Dashboard & Simulator)
│       └── src/
│           ├── app/
│           │   ├── conversations/  # Conversation inbox and detail views
│           │   ├── simulator/      # Patient message simulator
│           │   ├── shared/         # Reusable components, services, interceptors
│           │   └── core/           # Guards, models, API service
│           ├── assets/
│           └── environments/
├── docs/                        # Seed data (knowledge base documents)
├── plans/                       # Task plans
│   ├── backlog/                 # Pending tasks
│   ├── inProgress/              # Active tasks
│   ├── completed/               # Finished tasks
│   └── master_plan.md           # High-level implementation overview
├── scripts/                     # Database seeding and setup scripts
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

2. Create environment variables based on the template:

```bash
cp .env.example .env
```

_Make sure to add your `LLM_API_KEY` to the `.env` file. The `.env.example` file contains all required variables including `LLM_BASE_URL` for the Gemini endpoint._

3. Start the infrastructure (PostgreSQL + MongoDB):

```bash
docker compose up -d
```

4. Run migrations and seed the databases (injects clinic data, doctors, 2 weeks of availability, and vectorizes the knowledge base):

```bash
pnpm run db:setup
```

### Running the Application

```bash
# Start backend (API & Worker)
pnpm run dev:api

# Start frontend dashboard (in a separate terminal)
pnpm run dev:web

# Or both in parallel
pnpm dev
```

## Testing

Minimum coverage: **75%** (branches, functions, lines, statements).

```bash
# All tests
pnpm test

# Backend only
pnpm --filter api test

# Frontend only
pnpm --filter web test

# Coverage
pnpm --filter api test:cov
pnpm --filter web test:cov
```

Tests focus on domain entities, tool calling validation (Zod schemas, domain rules), CQRS handlers, repository contracts, LLM orchestration (iteration limits, error handling, escalation), API controllers, and frontend component states.

Unit tests use mock repositories, mock LLM services, and mock event publishers — no real database, HTTP server, or LLM API required.

## API Endpoints

| Method | Path                     | Description                                     |
| ------ | ------------------------ | ----------------------------------------------- |
| `POST` | `/webhooks/messages`     | Receives incoming messages (simulates WhatsApp) |
| `GET`  | `/api/conversations`     | Lists conversations for the dashboard           |
| `GET`  | `/api/conversations/:id` | Gets conversation details and AI traces         |
| `POST` | `/api/simulator`         | Sends a test message as if from a patient       |

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
| pgvector over dedicated vector DB | Single database for knowledge + clinic data; Google `text-embedding-004` (768 dimensions) for embeddings |
| Max 5 tool-call iterations | Prevents infinite loops; forces escalation if unresolved |

Full decision record in [DECISIONS.md](./DECISIONS.md).
