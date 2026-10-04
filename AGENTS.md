# AGENTS.md

## MessengerHub — Development Instructions

This document defines the rules that AI coding agents must follow when working on this repository.

The agent must preserve the existing architecture, boundaries and design decisions while implementing new functionality.

---

# 1. Project Context

MessengerHub is an AI-powered scheduling assistant for clinics. It receives messages from patients (simulating WhatsApp), responds using an LLM with tool calling, consults real clinic knowledge (RAG), and schedules appointments without hallucinating data. Built with:

- NestJS (Express)
- Angular
- TypeScript
- PostgreSQL (with pgvector)
- MongoDB
- pnpm workspaces

The backend uses Clean Architecture, CQRS, event-driven processing, and async queue-based LLM orchestration.

Operations are based in Colombia (UTC-5). All timezone-aware interpretation must use `America/Bogota`.

---

# 2. Primary Architectural Objectives

The implementation must preserve the following architectural characteristics:

- Abstraction
- Interfaces
- Polymorphism
- SOLID
- Clean Architecture
- CQRS
- Repository Pattern
- Adapter Pattern
- Strategy Pattern
- Factory Pattern
- Dependency Inversion
- Event-Driven Architecture
- Structured Logging

These requirements are architectural constraints.

Do not remove an abstraction or pattern simply because a direct implementation appears shorter.

At the same time, do not introduce unnecessary abstractions that do not solve an actual architectural problem.

---

# 3. Required Documentation

Before making architectural changes, review:

```text
README.md
DESIGN.md
DECISIONS.md
```

When changing an existing architectural decision, update the appropriate documentation.

---

# 4. Planning Requirement

**Before making any code modification, a task plan must exist or be updated.**

This is a strict workflow constraint. Do not write, edit, or refactor code without a corresponding plan in the `plans/` directory.

### Workflow

```text
1. Identify the task (new feature, bug fix, refactor)
2. Check plans/backlog/ for an existing task plan
   ├── If found → move to plans/inProgress/, review acceptance criteria
   └── If not found → create a new task plan in plans/backlog/, then move to plans/inProgress/
3. Implement the code changes
4. Verify against the plan's acceptance criteria
5. Move the plan to plans/completed/
```

### Plan File Structure

Every task plan must contain:

```text
- Objective: what the task achieves
- Acceptance Criteria: checkbox list of verifiable conditions
- Implementation Steps: ordered steps with code examples
- File Structure: which files are created/modified
- Verification: commands to confirm the task is done
- References: links to DESIGN.md, AGENTS.md, DECISIONS.md sections
```

### Rules

- Never modify code without a plan in `plans/inProgress/` or `plans/backlog/`.
- If the scope of a task changes during implementation, update the plan first.
- A task is only complete when all acceptance criteria are checked and verification passes.
- Completed plans move to `plans/completed/` with a completion date.

---

# 5. Architecture

The backend follows:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↑
Infrastructure
```

Dependencies must point toward the inner layers.

Infrastructure implements contracts defined by the inner layers.

### Project Structure

```text
MessengerHub/
├── .agents/
│   └── skills/                  # AI agent skills (postgres-best-practices, prisma-pgvector, mongodb-nestjs, llm-tool-calling, docker-setup)
├── .opencode/
│   └── opencode.json            # OpenCode agents and commands config
├── apps/
│   ├── api/                        # NestJS backend (API + Worker)
│   │   ├── prisma/                 # Schema, migrations, PG seed (clinics/doctors/slots/knowledge)
│   │   ├── scripts/                # Operational scripts (mongo indexes, Mongo sample seed)
│   │   └── src/
│   │       ├── domain/             # Entities, value objects, enums, repository interfaces, AI tool interfaces
│   │       ├── application/        # Use cases, CQRS command/query handlers, DTOs, LLM orchestration
│   │       ├── infrastructure/     # Postgres (pgvector) & Mongo adapters, LLM clients, queue adapters
│   │       └── presentation/       # Controllers: webhook, conversations, simulator, clinics, knowledge (RAG CRUD)
│   └── web/                        # Angular frontend (Dashboard, Simulator, Knowledge Base)
│       └── src/
│           ├── app/
│           │   ├── conversations/  # Conversation inbox and detail views
│           │   ├── simulator/      # Patient message simulator (chat mode)
│           │   ├── knowledge/      # RAG knowledge base list + create/edit form
│           │   ├── shared/         # Reusable components (layout, pagination, dialogs, error UI)
│           │   └── core/           # Models, ApiService, LoggerService, interceptors
│           ├── assets/
│           └── environments/
├── plans/                          # Task plans
│   ├── backlog/                    # Pending tasks
│   ├── inProgress/                 # Active tasks
│   ├── completed/                  # Finished tasks (Phases 1–10)
│   └── master_plan.md              # High-level implementation overview
├── AGENTS.md
├── DECISIONS.md
├── DESIGN.md
├── README.md
├── docker-compose.yml
└── package.json
```

---

# 6. Domain Rules

The domain must remain independent from infrastructure.

The following dependencies must not appear inside domain entities or domain services:

```text
Prisma Client
MongoDB driver
Express
HTTP framework
LLM SDK
```

The domain should contain business concepts such as:

```text
Clinic
Doctor
Slot
Appointment
AppointmentStatus
Conversation
ConversationStatus
Message
AITrace
KnowledgeDocument
```

---

# 7. SOLID Requirements

## Single Responsibility

Classes should have one primary responsibility.

Avoid large services that handle:

```text
database
HTTP
business rules
LLM orchestration
RAG search
```

simultaneously.

---

## Open/Closed

Prefer extension through interfaces and implementations.

Example:

```text
LLMService (interface)
   ├── GeminiLLMService (implementation)
   ├── OpenAILLMService (alternative implementation)
   └── MockLLMService (test implementation)
```

Adding a new LLM provider should not require changing application business logic.

---

## Liskov Substitution

All implementations of an abstraction must respect its contract.

Do not create fake implementations that behave differently in ways that violate the abstraction.

---

## Interface Segregation

Prefer focused interfaces:

```text
AppointmentRepository
ConversationRepository
MessageRepository
KnowledgeRepository
LLMService
QueueService
EventPublisher
```

Avoid large interfaces containing unrelated responsibilities.

---

## Dependency Inversion

Application code must depend on abstractions.

Prefer:

```text
CreateAppointmentHandler
      ↓
AppointmentRepository (interface)
      ↑
PrismaAppointmentRepository (adapter)
```

Avoid:

```text
CreateAppointmentHandler
      ↓
PrismaClient
```

---

# 8. CQRS

Use CQRS for application operations.

Commands modify state.

Examples:

```text
CreateAppointmentCommand
CancelAppointmentCommand
ProcessIncomingMessageCommand
```

Queries retrieve state.

Examples:

```text
ListConversationsQuery
GetConversationDetailQuery
```

Commands and queries must not be mixed inside the same handler.

---

# 9. Repository Pattern

Persistence must be abstracted.

PostgreSQL repositories:

```typescript
interface AppointmentRepository {
  create(appointment: Appointment): Promise<Appointment>;
  findById(id: string): Promise<Appointment | null>;
  findBySlotId(slotId: string): Promise<Appointment | null>;
  findByPatientPhone(phone: string): Promise<Appointment[]>;
}

interface SlotRepository {
  findAvailable(clinicId: string, specialty: string, date: Date): Promise<Slot[]>;
  findById(id: string): Promise<Slot | null>;
  markAsBooked(id: string): Promise<void>;
  markAsAvailable(id: string): Promise<void>;
}

interface KnowledgeRepository {
  search(clinicId: string, query: string, limit?: number): Promise<KnowledgeResult[]>;
}
```

MongoDB repositories:

```typescript
interface ConversationRepository {
  findByPatientPhone(clinicId: string, phone: string): Promise<Conversation | null>;
  findById(id: string): Promise<Conversation | null>;
  findAll(filters: ConversationFilters, pagination: PaginationParams): Promise<PaginatedResult<Conversation>>;
  updateStatus(id: string, status: ConversationStatus): Promise<void>;
}

interface MessageRepository {
  create(message: Message): Promise<void>;
  findByConversationId(conversationId: string): Promise<Message[]>;
  findByMessageId(messageId: string): Promise<Message | null>;
}

interface AITraceRepository {
  create(trace: AITrace): Promise<void>;
  findByConversationId(conversationId: string): Promise<AITrace[]>;
}
```

Prisma implementation belongs in infrastructure for PostgreSQL. MongoDB driver implementation belongs in infrastructure.

The application must not depend directly on Prisma Client or MongoDB driver.

---

# 10. Adapter Pattern

External providers must be isolated through adapters.

Database integration must follow:

```text
AppointmentRepository (interface)
     ▲
     │
PrismaAppointmentRepository (adapter)
     │
     ▼
Prisma Client

ConversationRepository (interface)
     ▲
     │
MongoConversationRepository (adapter)
     │
     ▼
MongoDB Driver
```

LLM integration must follow:

```text
LLMService (interface)
     ▲
     │
GeminiLLMService (adapter, uses OpenAI SDK pointing to Gemini endpoint)
     │
     ▼
Google Gemini API (OpenAI-compatible)
```

Queue integration must follow:

```text
QueueService (interface)
     ▲
     │
BullMQQueueService (adapter, development)
SQSQueueService (adapter, production)
```

Never import Prisma Client, MongoDB driver, OpenAI SDK, or BullMQ into domain or application business logic.

The `GeminiLLMService` adapter uses the OpenAI SDK configured with `LLM_BASE_URL` pointing to the Gemini endpoint. This is an infrastructure detail — the domain layer only knows the `LLMService` interface.

---

# 11. Strategy Pattern

Use Strategy when interchangeable algorithms or behaviors exist.

Example:

```typescript
interface EmbeddingService {
  embed(text: string): Promise<number[]>;
}
```

Implementations:

```text
GeminiEmbeddingService
LocalEmbeddingService (for testing)
```

Do not create strategies for behavior that has no realistic variation.

---

# 12. Factory Pattern

Use factories when implementation selection must be encapsulated.

Example:

```text
LLMServiceFactory
      │
      ├── GeminiLLMService
      ├── OpenAILLMService
      └── MockLLMService
```

Avoid factories that simply wrap a constructor without providing selection or creation logic.

---

# 13. Event-Driven Architecture

Domain events decouple side effects from core logic.

```text
AppointmentCreatedEvent
AppointmentCancelledEvent
ConversationEscalatedEvent
```

The event publisher interface belongs in the domain layer.

Infrastructure implements the event bus (in-memory EventEmitter2 for this MVP).

---

# 14. AI Pipeline Rules

## Tool Calling

The LLM is treated as an untrusted input source. All tool arguments must be validated before execution.

```text
LLM Output → Zod Schema Validation → Domain Validation → Execute Tool
```

Rules:

- Never execute LLM-proposed tool calls without validation.
- Zod schemas validate structural correctness (types, formats, required fields).
- Domain validation verifies business rules (date not in past, specialty exists, slot available).
- Validation errors are returned to the LLM as tool results, not as system errors.
- Maximum 5 tool-call iterations per turn. If reached, force escalation.
- Each tool call and its result must be traced in `ai_traces`.

## RAG (Retrieval-Augmented Generation)

Rules:

- Semantic search uses pgvector cosine distance on `knowledge_documents.embedding`.
- The same embedding model (Google `gemini-embedding-001`, 768 dimensions via explicit `dimensions` param) must be used for indexing documents and querying.
- If no document has similarity > 0.7, the tool returns "No relevant information found".
- The LLM must not fabricate information not present in the knowledge base.
- Document chunking strategy: split by section/paragraph, max 500 tokens per chunk.
- **Admin CRUD (Phase 10):** the dashboard manages documents via `/api/knowledge` (CQRS + REST). Clients never send embedding vectors; handlers regenerate embeddings on create and when `title`/`content` change. Patient tool calling remains read-only search.

## Prompt Construction

Rules:

- The system prompt must include the current date/time in Colombia: `"Current date and time in Colombia: YYYY-MM-DD HH:mm (UTC-5)"`.
- The system prompt must list available tools and their purposes.
- Conversation history is loaded from MongoDB and included in the prompt.
- The prompt must instruct the LLM to only use knowledge base information and not invent data.

## Hallucination Prevention

Rules:

- If the knowledge base doesn't contain the answer, the LLM must say "I don't have that information" or escalate.
- Tool results are the only source of truth for availability and appointments.
- The LLM never directly modifies the database. All mutations go through validated tool calls.

---

# 15. Database

## PostgreSQL

PostgreSQL is the relational persistence layer. Prisma manages schema, migrations, and seeds.

Expected core entities:

```text
clinics
doctors
slots
appointments
knowledge_documents (with pgvector embedding)
```

Schema is defined in `apps/api/prisma/schema.prisma`. Migrations are generated with `prisma migrate dev`. PostgreSQL seed data is in `prisma/seed.ts` (helpers in `prisma/seeds/`). MongoDB sample seed is in `scripts/seed-mongo.ts` (helpers in `scripts/mongo-seeds/`).

The `slots` table has a `UNIQUE(doctor_id, start_time)` constraint to prevent duplicate slots.

The `appointments` table has a `UNIQUE(slot_id)` constraint to prevent double-booking.

The `knowledge_documents` table uses pgvector with an IVFFlat index for cosine similarity search.

All timestamps are stored in UTC with `TIMESTAMPTZ`.

Database access belongs in infrastructure.

Do not access Prisma Client directly from:

```text
controllers
domain entities
command handlers
query handlers
```

Handlers should use repositories.

## MongoDB

MongoDB is the document persistence layer for high-volume, flexible-schema data.

Expected collections:

```text
conversations
messages
ai_traces
```

The `messages` collection has a unique sparse index on `message_id` for idempotency.

All documents include `clinicId` for tenant scoping. Queries always filter by `clinicId`.

MongoDB driver access belongs in infrastructure.

Do not access the MongoDB driver directly from:

```text
controllers
domain entities
command handlers
query handlers
```

Handlers should use repositories.

## Cross-Database Consistency

When an operation touches both databases:

1. PostgreSQL commits first (source of truth for appointments).
2. MongoDB update follows.
3. If MongoDB update fails, a background reconciliation job retries.
4. The system accepts eventual consistency for conversation state.

---

# 16. Async Processing

Webhook reception and LLM processing are decoupled via a queue.

```text
Webhook → Validate + Deduplicate → Insert message → Push to queue → Return 202

Worker → Consume from queue → Load history → Call LLM → Execute tools → Save results
```

Rules:

- The webhook endpoint must never block on LLM processing.
- The worker processes messages one at a time per conversation (to maintain ordering).
- Failed messages retry up to 3 times before moving to the Dead Letter Queue.
- The worker must be idempotent (re-processing the same message is safe).

---

# 17. Frontend

Angular is responsible for presentation.

The frontend must not implement backend business rules.

Frontend responsibilities:

- conversation inbox with status filtering
- conversation detail with message timeline and AI traces
- patient simulator (send test messages)
- **knowledge base management** (list/create/edit/delete RAG documents per clinic)
- loading states
- error presentation

Backend responsibilities:

- validation
- business rules
- persistence
- LLM orchestration
- RAG search
- appointment booking
- domain state transitions

---

# 18. Structured Logging (Mandatory)

**Every new service, handler, controller, repository, and infrastructure adapter MUST include structured logging.** This is a non-negotiable requirement for all future implementations.

## Backend Logging

The backend uses a `Logger` interface (domain layer) with a `LOGGER` DI token, implemented by `WinstonLoggerService` (infrastructure layer).

### Injection pattern

```typescript
import { LOGGER, type Logger } from '@domain/services';

@Injectable()
export class MyService {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}
}
```

### Method signatures

```typescript
logger.debug(message: string, metadata?: LogMetadata): void;
logger.info(message: string, metadata?: LogMetadata): void;
logger.warn(message: string, metadata?: LogMetadata): void;
logger.error(message: string, metadata?: LogMetadata): void;
```

### What to log (by operation type)

| Operation type | Level | Required metadata |
|---------------|-------|-------------------|
| State mutation success (create, update, cancel) | `info` | entity IDs, clinicId, resulting status |
| State mutation rejected (domain error) | `warn` | entity ID, reason, relevant field |
| External API call (LLM, embedding) | `debug` (request), `info` (response) | model, tokens, latency, costUsd |
| External API call failure | `error` | model, error message |
| Database connection lifecycle | `info` | event: connected/disconnected |
| Queue job lifecycle | `info` (start/complete), `warn` (retry), `error` (DLQ) | jobId, attempt, conversationId |
| RAG search | `debug` (start), `info` (results) | clinicId, resultCount, topSimilarity |
| Validation failure (Zod/domain) | `warn` | toolName/field, reason |
| Event published | `debug` | eventName, aggregateId |
| Query result (read-only) | `debug` | total count, filters |

### What NOT to log

- Patient phone numbers (PII)
- Patient message content (PII)
- API keys, tokens, passwords, secrets (use the sanitizer in `LoggingInterceptor` for HTTP bodies)
- Raw infrastructure errors exposed to clients (log server-side only)

### Context string convention

Every log call must include a `context` key identifying the source:

```typescript
this.logger.info('Appointment created', {
  context: 'CreateAppointmentHandler',
  appointmentId,
  clinicId,
  doctorId,
  slotId,
});
```

### NestJS Logger migration

Do NOT use `new Logger(SomeClass.name)` from `@nestjs/common`. Always use the injected `LOGGER` token. The NestJS `Logger` uses a different signature (`.log(message, stack)`) and does not produce structured JSON output.

## Frontend Logging

The frontend uses `LoggerService` (injectable, `providedIn: 'root'`).

### Injection pattern

```typescript
import { LoggerService } from '../core/logger.service';

export class MyComponent {
  private readonly logger = inject(LoggerService);
}
```

### Method signatures

```typescript
logger.debug(message: string, context?: string, data?: unknown): void;
logger.info(message: string, context?: string, data?: unknown): void;
logger.warn(message: string, context?: string, data?: unknown): void;
logger.error(message: string, context?: string, data?: unknown): void;
```

### What to log (by operation type)

| Operation type | Level | Context |
|---------------|-------|---------|
| Data loading success | `debug` | component name |
| Data loading failure | `error` | component name + error message |
| User action (filter, navigation) | `info` | component name |
| Form validation failure | `warn` | component name |
| API request (optional tracing) | `debug` | `ApiService` |

### What NOT to log (frontend)

- Patient message content
- Patient phone numbers
- Full request/response bodies (the `error.interceptor.ts` already logs API failures)

## Logging in Tests

When writing tests for services/handlers that inject `LOGGER`:

```typescript
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// In NestJS test module:
{ provide: LOGGER, useValue: mockLogger }

// In direct constructor tests:
new MyService(mockRepository, mockLogger)
```

Assert on logger calls when the log output is part of the behavior under test (e.g., error paths must log a warning).

---

# 19. Testing

**Minimum coverage: 75%** across all metrics (branches, functions, lines, statements).

Business logic must be testable without external infrastructure.

### Testing strategy

Write tests **alongside implementation**, not as a separate phase. Each task should include its own tests:

| Task | Tests to write |
|------|----------------|
| T-1.2 (Domain) | Domain entity tests (status transitions, validation rules) |
| T-2.3 (Commands) | Handler tests with mock repositories |
| T-3.3 (Tool Validation) | Zod schema tests (valid/invalid inputs) |
| T-3.4 (Orchestration) | Orchestrator tests with MockLLMService |
| T-5.1 (Controllers) | Controller tests with mocked CommandBus/QueryBus |
| T-6.1 (Angular Foundation) | ApiService tests with mocked HttpClient |
| T-6.2 (Conversation Inbox) | Component tests: renders list, loading/error/empty states, filter, pagination |
| T-6.3 (Conversation Detail) | Component tests: messages timeline, AI traces expand/collapse |
| T-6.4 (Simulator) | Component tests: form validation, send message, success/error states |
| T-9.1 (Backend Logging) | Logger/formatter/interceptor/module tests |
| T-9.2 (Frontend Logging) | LoggerService, GlobalErrorHandler, ErrorBoundaryComponent tests |

This prevents testing debt and ensures coverage grows incrementally.

Unit tests should use:

```text
MockAppointmentRepository
MockConversationRepository
MockMessageRepository
MockKnowledgeRepository
MockLLMService
MockQueueService
MockEventPublisher
MockEmbeddingService
```

Real integrations should be reserved for integration tests.

Unit tests must not require:

```text
real PostgreSQL
real MongoDB
real LLM API
real queue (SQS/BullMQ)
```

### Test focus areas (priority order):

1. Domain entities and business rules (especially appointment validation, timezone handling)
2. Tool calling validation (Zod schemas, domain rules)
3. CQRS command/query handlers
4. Repository interface contracts
5. LLM orchestration (iteration limits, error handling, escalation)
6. API controllers (request/response contracts)
7. Frontend components (loading, error, data states)

### Test file conventions:

```text
apps/api/src/domain/entities/appointment.entity.spec.ts
apps/api/src/application/commands/create-appointment/create-appointment.handler.spec.ts
apps/api/src/infrastructure/repositories/prisma-appointment.repository.spec.ts
apps/api/src/application/llm/tool-validation.spec.ts
apps/web/src/app/conversations/conversation-list.component.spec.ts
```

---

# 20. Error Handling

Use explicit errors.

Examples:

```text
SlotAlreadyBookedError
SlotNotFoundError
ClinicNotFoundError
InvalidTimezoneError
PastDateError
LLMProviderError
LLMIterationLimitError
ValidationError
```

Do not leak infrastructure-specific errors directly to API clients.

LLM-specific errors (timeout, rate limit, invalid response) must be caught and handled gracefully — the patient should never see a raw LLM error.

All error paths must be logged with `logger.error()` or `logger.warn()` using structured metadata (context, entity IDs, reason). See section 18.

---

# 21. Code Quality

Prefer:

- TypeScript strict mode
- explicit types
- small classes
- focused interfaces
- dependency injection
- composition
- immutable data where appropriate
- meaningful names

Avoid:

- `any`
- god classes
- global mutable state
- duplicated business logic
- unnecessary abstractions
- unnecessary design patterns

---

# 22. Avoid Overengineering

The architecture must remain understandable.

Do not introduce:

- microservices
- Kubernetes
- event sourcing
- separate read databases
- complex agent frameworks (LangChain, LangGraph)
- WebSockets without a requirement
- unnecessary authentication systems
- additional brokers

unless explicitly requested.

---

# 23. Architectural Decision Rule

When choosing between two implementations:

1. Prefer the one that preserves architectural boundaries.
2. Prefer abstractions at external system boundaries.
3. Prefer dependency injection over manual construction.
4. Prefer composition over inheritance.
5. Prefer simple implementations over unnecessary complexity.
6. Preserve existing patterns when extending the system.
7. Do not introduce a pattern solely for the sake of having another pattern.

---

# 24. Definition of Done

A feature is complete when:

- It respects Clean Architecture boundaries.
- SOLID principles remain intact.
- CQRS responsibilities are preserved.
- Infrastructure remains replaceable.
- External providers are behind abstractions.
- Business logic has tests.
- Test coverage is at or above 75%.
- No secrets are committed.
- Existing tests pass.
- Documentation is updated when architecture changes.
- **Structured logging is included** (see section 18): all state mutations, external calls, error paths, and lifecycle events are logged with `LOGGER`/`LoggerService`.
- **No raw `console.*` or `new Logger(...)` calls** remain in source code.
- **No PII in logs** (patient phone, message content).

---

# 25. Priority Order

When requirements conflict, use this priority:

```text
1. Correctness (no hallucinated data, no double-booking)
2. Existing architectural boundaries
3. Domain/business rules
4. SOLID principles
5. Testability
6. Simplicity
7. Performance optimization
```

Do not sacrifice architectural boundaries merely to reduce the amount of code.

---

# 26. Final Principle

The system should remain:

```text
Simple
   +
Decoupled
   +
Testable
   +
Replaceable
   +
Understandable
```

The purpose of the architecture is to make future changes easier without introducing unnecessary complexity.

---

# 27. Skills

The following skills are installed and must be loaded when relevant:

| Skill | Trigger |
|-------|---------|
| `postgres-best-practices` | Writing SQL, schema design, indexes, migrations, pgvector, performance optimization, diagnosing slow queries |
| `prisma-pgvector` | Prisma schema changes, migrations, raw queries (`$queryRaw`), seed scripts, pgvector embedding columns, IVFFlat indexes, cosine similarity search |
| `mongodb-nestjs` | MongoDB collections, indexes, aggregation pipelines, NestJS integration, connection management, document schema design, idempotency handling |
| `llm-tool-calling` | Gemini API, OpenAI SDK, tool calling loop, function calling, prompt construction, embedding generation, iteration limits, hallucination prevention |
| `docker-setup` | Docker Compose, PostgreSQL (pgvector) containers, MongoDB containers, development environment setup |

Skills are located at `.agents/skills/`.
Skills provide specialized instructions and workflows for specific tasks.
Use the skill tool to load a skill when a task matches its description.

---

# 28. Agent Delegation

Agents are defined in `.opencode/opencode.json`. Use the `task` tool to delegate work to the correct agent:

| Agent | Role |
|-------|------|
| `backend-dev` | NestJS, Clean Architecture, CQRS, repositories, dual-database patterns |
| `frontend-dev` | Angular, components, services, RxJS, Angular Material |
| `ai-pipeline` | LLM integration, tool calling, RAG, embeddings, prompt construction |
| `testing` | Jest, coverage enforcement, mock repositories, mock LLM services |
| `devops` | Docker, database setup (Prisma + MongoDB), migrations, seed data |

### Commands

| Command | Action |
|---------|--------|
| `/setup` | Run full project setup (Docker + Prisma + seed) |
| `/test` | Run all tests and verify 75% coverage |
| `/coverage` | Generate coverage reports |
| `/commit` | Generate conventional commit message |
| `/branch` | Create feature branch from main |
| `/pr` | Create pull request |