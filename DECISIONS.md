# DECISIONS.md

## MessengerHub — Architecture Decision Record

This document captures the key architectural and technical decisions made during the design and implementation of MessengerHub, along with their context, rationale, and trade-offs.

> **Implementation status (2026-10-02):** Phases 1–8 are implemented (domain, dual-database persistence, CQRS, LLM/RAG/tool validation/orchestration, async processing, API layer, frontend dashboard, seed data, testing & coverage). Phase 9 (Logging) is planned. Decisions below marked with *(implemented)* reflect choices already visible in code; others describe target design.

---

# 1. Backend Framework: NestJS over Plain Node.js/Express

**Status:** Accepted

**Context:** The backend must handle webhook reception, asynchronous LLM processing, dual-database persistence (PostgreSQL + MongoDB), and expose a clean API for the dashboard. The system needs consistency across modules, dependency injection, and a structure that scales without architectural drift.

**Decision:** Use NestJS (built on top of Express) instead of plain Node.js with Express.

**Rationale:**

- **Module-based architecture** — NestJS organizes code into modules, services, and controllers. This enforces a clear separation of concerns from the framework level, not just from developer discipline.
- **Native TypeScript support** — NestJS is built with TypeScript from the ground up. Types, decorators, and interfaces are first-class citizens.
- **Dependency injection** — The built-in DI container manages provider lifecycles (singleton by default), enables constructor injection, and keeps modules decoupled. This directly supports Clean Architecture and testability.
- **Scalability through structure** — The fixed module structure (controllers → services → repositories) means the codebase remains navigable and consistent as features grow.
- **Ecosystem maturity** — NestJS provides official packages for CQRS (`@nestjs/cqrs`), event emitters (`@nestjs/event-emitter`), configuration (`@nestjs/config`), and testing (`@nestjs/testing`), reducing ad-hoc integrations.

**Trade-offs:**

- Slightly higher learning curve for developers unfamiliar with decorators and DI containers.
- More boilerplate than a minimal Express setup, but offset by the consistency it enforces.

---

# 2. Architecture: Clean Architecture with Strict Layer Boundaries

**Status:** Accepted

**Context:** The system mixes business logic (scheduling, validation), AI orchestration (LLM tool calling, RAG), and infrastructure (databases, queue, external APIs). These concerns must remain separable for testability and maintainability.

**Decision:** Enforce Clean Architecture with four layers — Presentation, Application, Domain, and Infrastructure — with strict dependency rules.

**Rationale:**

- **Domain independence** — The domain layer contains entities, enums, value objects, repository interfaces, and AI tool interfaces. It has zero dependencies on Prisma, MongoDB driver, Express, or any infrastructure SDK. The domain can be tested in isolation.
- **Dependency direction** — Dependencies point inward: Presentation → Application → Domain ← Infrastructure. Infrastructure implements contracts defined by the domain.
- **Testability** — Handlers depend on repository interfaces (not database clients), and the LLM service is behind an interface. Unit tests use mock implementations. No real database, HTTP server, or LLM API required.
- **Replaceability** — PostgreSQL can be replaced with any relational database, MongoDB with any document store, and the LLM provider with any other — by only changing the infrastructure layer.

**Trade-offs:**

- More files and directories than a flat Express app.
- Requires discipline to maintain boundaries.

---

# 3. CQRS: Separate Commands and Queries

**Status:** Accepted

**Context:** The application has two distinct types of operations: state mutations (create appointment, update conversation status) and data retrieval (list conversations, get conversation detail with traces). These have different optimization needs.

**Decision:** Use CQRS (Command Query Responsibility Segregation) with `@nestjs/cqrs`.

**Rationale:**

- **Separation of write and read operations** — Commands modify state and publish events. Queries retrieve state and never mutate. Mixing both in a single handler leads to bloated, hard-to-test services.
- **Asymmetric optimization** — Write operations need transactional correctness and domain validation. Read operations need efficient queries across PostgreSQL and MongoDB. CQRS allows each side to be optimized independently.
- **Handler isolation** — Each command/query has its own handler class with a single responsibility. Testing is straightforward: mock the repository, invoke the handler, assert the result.

**Structure:**

```text
Commands                              Queries
├── CreateAppointmentCommand          ├── ListConversationsQuery
│   └── CreateAppointmentHandler      │   └── ListConversationsHandler
├── CancelAppointmentCommand          └── GetConversationDetailQuery
│   └── CancelAppointmentHandler          └── GetConversationDetailHandler
└── ProcessIncomingMessageCommand
    └── ProcessIncomingMessageHandler
```

**Trade-offs:**

- More classes than a single service with all methods, but each class is small and focused.
- The `@nestjs/cqrs` module adds a dependency, but it is maintained by the NestJS team.

---

# 4. Dual Database: PostgreSQL + MongoDB

**Status:** Accepted

**Context:** The system has two fundamentally different data profiles:

1. **Transactional, relational data** — Clinics, doctors, availability slots, and appointments require ACID guarantees, foreign key constraints, and uniqueness (no double-booking).
2. **High-volume, flexible-schema data** — Conversations, messages, and AI execution traces grow rapidly, have variable structure (tool calls can have different arguments/results per turn), and are primarily written once and read sequentially.

**Decision:** Use PostgreSQL for transactional/domain data and MongoDB for conversations, messages, and AI traces.

**Rationale for PostgreSQL (transactional data):**

- **ACID transactions** — Appointment booking requires `INSERT` appointment + `UPDATE slot.is_booked` in a single transaction. If either fails, both roll back.
- **Unique constraints** — `UNIQUE(slot_id)` on appointments is the database-level guarantee against double-booking. No application-level check can match this reliability under concurrency.
- **Foreign key integrity** — `clinic_id`, `doctor_id`, `slot_id` are enforced at the database level.
- **pgvector** — The knowledge base uses pgvector for semantic search. Keeping it in the same database as clinic/doctor data avoids cross-database joins for RAG queries.

**Rationale for MongoDB (conversations & traces):**

- **Flexible schema** — AI traces have variable structure: some turns call 0 tools, others call 3. The `toolsCalled` array has different shapes per tool. MongoDB handles this naturally without nullable columns or JSON blobs in PostgreSQL.
- **Write-heavy workload** — Every message (inbound and outbound) is written. Every AI turn produces a trace. MongoDB's write performance is excellent for this pattern.
- **Document-model fit** — A conversation is naturally a document with embedded messages. Loading a conversation's history is a single `find` query, not a `JOIN` across messages and traces.
- **Scalability** — MongoDB scales horizontally via sharding. If the system grows from 50 to 500 clinics, conversation data can be sharded by `clinicId`.

**Trade-offs:**

- Cross-database consistency is not guaranteed by a single transaction. PostgreSQL commits first; MongoDB updates follow. If MongoDB update fails, a reconciliation job retries.
- Two database connections, two drivers, two deployment configurations.
- Developers must reason about which database owns which data.

**Index strategy:**

```text
PostgreSQL:
  - slots: (clinic_id, is_booked, start_time) → availability queries
  - appointments: (patient_phone) → patient history lookup
  - appointments: (clinic_id, status) → dashboard filtering
  - knowledge_documents: ivfflat(embedding) → RAG cosine search

MongoDB:
  - messages: (message_id) unique → idempotency
  - messages: (conversation_id, created_at) → history loading
  - conversations: (clinic_id, status) → dashboard filtering
  - ai_traces: (conversation_id, turn_index) → trace lookup
```

---

# 5. pgvector for RAG over Dedicated Vector Databases

**Status:** Accepted

**Context:** The assistant needs semantic search over the clinic's knowledge base (schedules, exam preparations, policies). This requires a vector database for embedding similarity search.

**Decision:** Use pgvector (PostgreSQL extension) instead of a dedicated vector database (Qdrant, Pinecone, Atlas Vector Search).

**Rationale:**

- **Single database** — Clinic data (doctors, slots) and knowledge embeddings live in the same PostgreSQL instance. RAG queries that combine semantic search with clinic metadata (e.g., "find documents for clinic X") don't need cross-database joins.
- **No extra infrastructure** — pgvector is a PostgreSQL extension. No additional service to deploy, monitor, or pay for.
- **Sufficient scale** — For 50 clinics with ~100 documents each (5,000 total), pgvector with IVFFlat indexing handles cosine similarity search in < 50ms. This is well within acceptable latency for an LLM tool call.
- **Operational simplicity** — One database to back up, one to monitor, one connection pool.

**Trade-offs:**

- pgvector is less optimized than Qdrant or Pinecone for very large datasets (> 1M vectors) or advanced filtering.
- IVFFlat index requires a `lists` parameter tuned to dataset size. For growing datasets, HNSW index is preferred (available in pgvector 0.5+).
- If the knowledge base grows significantly (> 100k documents), a dedicated vector DB may become necessary.

**Embedding model:** Google `gemini-embedding-001` (768 dimensions, requested with explicit `dimensions` — `text-embedding-004` is no longer available on the Gemini OpenAI-compatible endpoint). The dimension size is configurable via `EMBEDDING_DIMENSIONS` and adapts to whichever embedding model is chosen.

---

# 6. LLM Provider: Google Gemini via OpenAI-Compatible Endpoint

**Status:** Accepted

**Context:** The assistant needs an LLM with tool calling capability. Options include OpenAI, Anthropic, Google Gemini, OpenRouter, or a local model via Ollama.

**Decision:** Use Google Gemini (`gemini-2.5-flash`) via its OpenAI-compatible endpoint, abstracted behind an `LLMService` interface in the domain layer.

**Rationale:**

- **Free tier** — Google Gemini offers a generous free tier with no credit card required. Sufficient for development, testing, and the MVP evaluation.
- **OpenAI-compatible endpoint** — Gemini exposes `https://generativelanguage.googleapis.com/v1beta/openai/` which works with the standard OpenAI Node SDK. No need for a separate Google SDK. The `LLMService` implementation uses the OpenAI client pointed at the Gemini endpoint.
- **Tool calling support** — Gemini supports function calling (tool calling) natively, which is the core requirement for the assistant.
- **Control** — Direct API usage gives full control over prompt construction, tool definitions, iteration logic, and error handling. No framework black boxes.
- **Testability** — The `LLMService` interface allows injecting a mock implementation that returns pre-defined tool calls. Tests never hit the real LLM API.
- **Provider swap** — If switching to OpenAI or Anthropic later, only the infrastructure implementation changes. The domain and application layers are unaffected.
- **Cost visibility** — API responses include exact token counts and model information per call, enabling precise cost tracking.

**Why not OpenAI:**

- No free tier available in 2026. Requires billing setup.
- Gemini's free tier is sufficient for this project's scope.

**Why not Anthropic:**

- No free tier. Requires billing setup.
- Gemini provides equivalent tool calling capability at no cost for development.

**Why not LangChain:**

- LangChain's abstractions (AgentExecutor, chains) add complexity without proportional benefit for this use case.
- Tool calling is straightforward with the OpenAI-compatible SDK. LangChain's tool calling wrapper adds an indirection layer that makes debugging harder.

**Interface:**

```typescript
interface LLMService {
  chat(params: LLMChatParams): Promise<LLMChatResult>;
}

interface LLMChatParams {
  messages: LLMMessage[];
  tools: LLMToolDefinition[];
  maxIterations?: number;
}

interface LLMChatResult {
  content: string | null;
  toolCalls: LLMToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  latencyMs: number;
  costUsd?: number;
  finishReason?: string;
}
```

**Configuration:**

```env
LLM_API_KEY=your-gemini-api-key
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL=gemini-2.5-flash
```

The OpenAI SDK reads `LLM_BASE_URL` to route requests to Gemini. The model name, API key, and base URL are all configurable via environment variables.

**Trade-offs:**

- Gemini's free tier has rate limits (~10-15 RPM). Acceptable for development; production would need Tier 1 (billing linked).
- Free tier data may be used to improve Google's models. Production should use paid tier for data privacy.
- The OpenAI-compatible endpoint may not support 100% of Gemini's native features. For this project (chat + tool calling), it is sufficient.
- If the project later needs complex agent workflows (multi-step reasoning, branching), LangChain/LangGraph may become valuable.

---

# 7. Asynchronous Processing: Queue + Worker Pattern

**Status:** Accepted — Phase 4 implemented (BullMQ queue T-4.1, worker T-4.2, webhook T-4.3)

**Context:** The webhook endpoint must respond fast (< 200ms). LLM processing takes 5–30 seconds (depending on tool calls and iterations). Blocking the HTTP response for LLM latency is unacceptable.

**Decision:** Use a queue (SQS in production, BullMQ in development) to decouple webhook reception from LLM processing.

**Implementation status:**

- `QUEUE_SERVICE` is bound to `BullMQQueueService` via global `QueueModule` (main queue `message-processing` + DLQ `message-processing-dlq`).
- `POST /webhooks/messages` (`WebhookController`) validates with Zod, executes `ProcessIncomingMessageCommand` (dedupe → insert message → create/reuse conversation → queue push), returns `202` or `200 duplicate`.
- Main queue retry: 3 attempts, exponential backoff 1s; retain 100 complete / 500 failed.
- Worker: separate NestJS context (`worker-main.ts` + `WorkerModule`) runs `BullMQMessageWorker` (raw BullMQ `Worker` in infrastructure) → `MessageProcessorService` → `AIOrchestratorService.processTurn`.
- DLQ: after the final failed attempt, the worker moves the job payload to `message-processing-dlq` via `BullMQQueueService.pushToDlq`.
- Idempotency: webhook dedupes on inbound `messageId`; worker uses deterministic outbound `messageId` (`assistant:${inboundMessageId}`).
- Clinic scoping on webhook: body `clinic_id` or `DEFAULT_CLINIC_ID` env (JWT clinic claim is future auth work).
- Redis connection from `REDIS_HOST` / `REDIS_PORT` (defaults `localhost:6379`).
- `InMemoryQueueService` remains as a test/dev implementation; production binding is BullMQ.
- AI traces (tokens/latency/tools) are saved by the orchestrator during `processTurn`.

**Flow (implemented):**

```text
Webhook Request
  → Validate + Deduplicate (check message_id)
  → Insert message into MongoDB
  → Push job to queue
  → Return 202 Accepted (or 200 duplicate)

Worker (separate process):
  → Consume job from queue
  → Load conversation history from MongoDB
  → Call LLM with tool calling loop
  → Execute tools (query PostgreSQL, book appointments)
  → Save response message to MongoDB
  → Save AI trace to MongoDB
  → Update conversation status
```

**Rationale:**

- **Fast response** — Webhook returns immediately. Patient doesn't wait for LLM processing.
- **Retry mechanism** — SQS visibility timeout + DLQ. If the worker crashes, the message returns to the queue for retry. After 3 failures, it goes to the DLQ for inspection.
- **Independent scaling** — Worker instances scale based on queue depth, independent of the API service.
- **Failure isolation** — A slow or failing LLM call doesn't affect webhook availability.

**Why SQS over Kinesis:**

- SQS is point-to-point: one consumer per message. Kinesis is for streaming to multiple consumers.
- SQS has built-in DLQ. Kinesis requires custom error handling.
- SQS is simpler and cheaper for this workload.

**Why BullMQ for development:**

- BullMQ runs on Redis, which is easy to spin up in Docker Compose.
- Same queue semantics (jobs, retries, delays) without AWS dependency.
- Switching between BullMQ and SQS is an infrastructure adapter swap.
- The adapter is a thin implementation of the `QueueService` domain interface, so application code and tests do not change if SQS replaces BullMQ later.

**Trade-offs:**

- Two processes to run locally (API + Worker).
- Message ordering is not guaranteed (SQS FIFO is available but adds complexity). Acceptable because conversations are naturally sequential per phone number.
- In-memory queue loses jobs on process restart — acceptable for development only (now superseded by BullMQ for the production binding).

---

# 8. Idempotency: Database-Level Deduplication

**Status:** Accepted

**Context:** WhatsApp (and any webhook provider) may deliver the same message multiple times. Processing a message twice could result in duplicate responses or, worse, duplicate appointment bookings.

**Decision:** Handle idempotency at the database level using unique constraints.

**Implementation:**

1. **Messages:** `message_id` has a unique sparse index in MongoDB. If a duplicate `message_id` arrives, the insert fails with a duplicate key error. The webhook returns `200 OK` with the existing conversation ID.
2. **Appointments:** `slot_id` has a `UNIQUE` constraint in PostgreSQL. Even under race conditions (two concurrent booking requests for the same slot), only one `INSERT` succeeds. The second fails with a unique violation, which the domain layer translates to a `SlotAlreadyBookedError`.

**Why database-level over application-level:**

- Application-level checks (query first, then insert) have a race condition: two concurrent requests can both pass the check.
- Database unique constraints are enforced by the storage engine with proper locking. No race condition is possible.

**Trade-offs:**

- Duplicate key errors must be caught and handled gracefully (not exposed as 500 errors to the client).
- The unique index on `message_id` is sparse (only applies to documents where `message_id` exists) because outbound messages don't have a WhatsApp `message_id`.

---

# 9. Tool Calling Validation: Zod Schemas + Domain Rules

**Status:** Accepted

**Context:** The LLM proposes tool calls with arguments. These arguments are untrusted input — the model can hallucinate invalid dates, non-existent specialties, or malformed phone numbers. Executing unvalidated arguments against the database would produce incorrect results or errors.

**Decision:** Validate all LLM-proposed tool arguments using Zod schemas before execution. Domain rules add additional validation beyond schema structure.

**Validation layers:**

```text
LLM Output (untrusted)
      │
      ▼
┌─────────────────────┐
│  Zod Schema          │  ← Structural validation (types, formats, required fields)
│  (Type Safety)       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Domain Validation   │  ← Business rules (date not in past, specialty exists, slot available)
│  (Business Rules)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Execute Tool        │  ← Only after both layers pass
└─────────────────────┘
```

**Example for `consultar_disponibilidad`:**

```typescript
const ConsultarDisponibilidadSchema = z.object({
  especialidad: z.string().min(1),
  sede: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// After Zod passes, domain validation:
// 1. Parse fecha in Colombia timezone (UTC-5)
// 2. Check fecha is not in the past
// 3. Query database for matching specialty and clinic
// 4. If clinic/specialty doesn't exist, return error to LLM
```

**Error feedback loop:** When validation fails, the error message is returned to the LLM as a tool result. The LLM can then correct its arguments or ask the patient for clarification. This is not a system error — it's part of the normal tool calling flow.

**Trade-offs:**

- Adds latency per tool call (schema validation + DB lookups). Typically < 5ms, negligible compared to LLM latency.
- The LLM may not always correct its errors. After 3 failed attempts for the same tool, the system escalates.

---

# 10. Timezone Handling: UTC Storage, Colombia Interpretation

**Status:** Accepted

**Context:** Operations are in Colombia (UTC-5). Patients say "mañana" and "esta tarde" relative to their local time. A message arriving at 03:40 UTC on October 6 means 10:40 PM on October 5 in Cali — "mañana" is October 6, not October 7.

**Decision:** Store all timestamps in UTC. Interpret relative time expressions ("mañana", "esta tarde") in Colombia time (America/Bogota, UTC-5) at the application layer.

**Implementation:**

- All database timestamps (`created_at`, `start_time`, `end_time`) are stored in UTC with `TIMESTAMPTZ`.
- When the LLM needs to interpret "mañana", the system prompt includes the current date/time in Colombia: `"Fecha y hora actual en Colombia: YYYY-MM-DD HH:mm (UTC-5)"` (built by `PromptBuilder` via `colombia-time.ts`).
- The LLM translates "mañana en la tarde" to a concrete date (`2026-10-07`) and time range, which is then validated by the domain layer (`ToolValidator` + `parseColombiaDateTime`).
- Slot availability queries filter by UTC timestamps but display results in Colombia time to the patient.
- Implementation detail: helpers use a fixed UTC-5 offset (Colombia has no DST). See decision §23.

**Why not store local times:**

- UTC is unambiguous. `2026-10-06T03:40:00Z` is always the same instant.
- Colombia doesn't observe DST, but if the system expands to other countries, UTC storage prevents ambiguity.
- Database functions (`AT TIME ZONE`) handle conversion at query time.

**Trade-offs:**

- The system prompt must include the current Colombia time. If the LLM provider is in a different timezone, the prompt must explicitly state the reference timezone.
- Displaying times to patients requires conversion from UTC to Colombia time in the frontend.

---

# 11. AWS Architecture Design

**Status:** Accepted

**Context:** The system must run in production for 50 clinics handling 20,000 messages per day. The architecture must be scalable, resilient, and cost-effective.

**Decision:** Use ECS Fargate for compute, RDS PostgreSQL for transactional data, MongoDB Atlas for document data, SQS for async processing, and standard AWS observability services.

**Rationale:**

- **ECS Fargate over Lambda** — The API service is long-running. Lambda cold starts add latency. ECS Fargate auto-scales without EC2 management. Both API and Worker run in the same cluster.
- **RDS PostgreSQL over Aurora** — At 50 clinics scale, RDS is simpler and cheaper. Aurora's benefits (global database, serverless) are not needed yet.
- **MongoDB Atlas over DocumentDB** — Atlas provides full MongoDB compatibility (aggregation pipelines, change streams). DocumentDB is MongoDB-compatible but has limitations. Atlas is preferred unless strict AWS-native is required.
- **SQS over Kinesis** — Point-to-point message processing. SQS is simpler, cheaper, and has built-in DLQ.
- **API Gateway (HTTP API) over ALB directly** — Rate limiting, request validation, and future JWT auth. HTTP API is cheaper than REST API.

**Alternatives discarded:**

- Lambda: Cold starts, 15-min timeout, no persistent connections.
- Aurora: Overkill for this scale.
- Kinesis: Streaming analytics, not point-to-point.
- Self-hosted MongoDB: Operational burden.

**Cost estimate:** ~$170/month for infrastructure + ~$180/month for LLM (Gemini `gemini-2.5-flash` at 20k msgs/day, ~$0.75/M input tokens, ~$3.75/M output tokens).

Detailed cost breakdown in [DESIGN.md](./DESIGN.md#8-aws-architecture).

---

# 12. Multi-Tenancy: Shared Database with Tenant Scoping

**Status:** Accepted

**Context:** The system serves 50 clinics. Each clinic's data must be isolated from others. The approach must be cost-effective and operationally simple.

**Decision:** Shared database with `clinic_id` on all tables/collections. Row-Level Security (RLS) in PostgreSQL for enforced isolation.

**Rationale:**

- **Cost-effective** — One RDS instance, one MongoDB cluster. No per-clinic infrastructure.
- **Operational simplicity** — One backup, one monitoring setup, one connection pool.
- **RLS enforcement** — PostgreSQL RLS policies ensure that even if application code forgets to filter by `clinic_id`, the database enforces it. This is a defense-in-depth approach.
- **MongoDB scoping** — All queries include `clinicId` filter. Compound indexes have `clinicId` as the leading field.

**When to revisit:**

- If a single clinic generates > 10k messages/day, consider dedicated resources.
- If regulatory requirements demand data sovereignty, consider region-per-tenant.
- If > 500 clinics, consider schema-per-tenant or database-per-tenant.

---

# 13. Monorepo: pnpm Workspaces

**Status:** Accepted

**Context:** The project has a backend (`apps/api`) and a frontend (`apps/web`). They share a root but have independent dependencies and scripts.

**Decision:** Use pnpm workspaces with `apps/*` as the workspace pattern.

**Rationale:**

- **Single install** — `pnpm install` at the root installs all dependencies for both apps.
- **Filtered commands** — `pnpm --filter api test` runs only backend tests. `pnpm dev` runs both apps in parallel.
- **Consistent with ContactCenter** — The same monorepo structure is used in the ContactCenter project, reducing context-switching.
- **No hoisting issues** — pnpm's strict dependency resolution prevents phantom dependencies.

---

# 14. Frontend: Angular

**Status:** Accepted

**Context:** The frontend needs a conversation inbox, conversation detail with AI traces, and a patient simulator. It must handle loading and error states. The user explicitly requested Angular.

**Decision:** Use Angular.

**Rationale:**

- **User preference** — Explicitly requested over Vue or React.
- **TypeScript native** — Angular is built with TypeScript from the ground up. Consistent with the NestJS backend.
- **Enterprise-grade** — Angular's opinionated structure (modules, services, guards, interceptors) enforces consistency, similar to NestJS on the backend.
- **HttpClient + RxJS** — Angular's HttpClient with interceptors provides a clean API layer with built-in error handling, retry logic, and loading state management.
- **Component structure** — Angular's component-based architecture maps naturally to the views (inbox, detail, simulator).

**Trade-offs:**

- More boilerplate than Vue or React for simple views.
- Larger bundle size, acceptable for an internal dashboard.
- RxJS learning curve for developers new to reactive programming.

---

# 15. Testing Without Real LLM

**Status:** Accepted

**Context:** Tests must not depend on the real LLM API. LLM calls are slow, expensive, and non-deterministic. Tests need to verify the system's behavior when the LLM returns specific tool calls or responses.

**Decision:** Abstract the LLM behind an `LLMService` interface. Tests inject a mock implementation that returns pre-defined responses.

**Implementation:**

```typescript
// Domain interface
interface LLMService {
  chat(params: LLMChatParams): Promise<LLMChatResult>;
}

// Mock for testing (apps/api/src/infrastructure/llm/mock-llm.service.ts)
class MockLLMService implements LLMService {
  private responses: LLMChatResult[] = [];
  readonly calls: LLMChatParams[] = [];

  setResponses(responses: LLMChatResult[]): void {
    this.responses.push(...responses);
  }

  get callCount(): number {
    return this.calls.length;
  }

  async chat(params: LLMChatParams): Promise<LLMChatResult> {
    this.calls.push(params);
    return (
      this.responses.shift() ?? {
        content: 'Default',
        toolCalls: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        model: 'mock',
        latencyMs: 0,
      }
    );
  }
}
```

**Test scenarios:**

- LLM returns a valid tool call → system executes it and returns the result.
- LLM returns an invalid tool call (bad date) → system validates, returns error to LLM.
- LLM returns no tool call → system returns the text response directly.
- LLM times out → system escalates gracefully.
- LLM returns 5 consecutive tool calls → system hits iteration limit and escalates.

**Coverage target:** 75% minimum across branches, functions, lines, and statements.

---

# 16. Conversation State Management

**Status:** Accepted

**Context:** Each phone number has one conversation. A conversation progresses through states based on the assistant's actions. The state must be queryable for the dashboard.

**Decision:** Track conversation status in MongoDB with four states: `active`, `resolved_by_ai`, `appointment_booked`, `escalated`.

**Rationale:**

- **`active`** — The conversation is ongoing. The patient hasn't been fully served yet.
- **`resolved_by_ai`** — The assistant answered the patient's question from the knowledge base. No appointment was booked.
- **`appointment_booked`** — The assistant successfully booked an appointment. Terminal state.
- **`escalated`** — The assistant could not resolve the issue and escalated to a human. Terminal state.

**Why not more states:**

- `PENDING`, `WAITING_FOR_PATIENT`, `FAILED` add complexity without value for this MVP.
- The domain entity enforces transitions, so adding states later is a non-breaking change.

---

# 17. Structured Logging

**Status:** Accepted — Planned (T-9.1 backend, T-9.2 frontend)

**Context:** The system needs observability for debugging LLM interactions, tracking costs, and investigating incidents. Logs must be structured (not free-text strings) and environment-aware. Both backend and frontend need logging.

**Decision:** Use Winston as the backend logging provider, abstracted behind a `Logger` interface with a `LOGGER` DI token. Use a NestJS interceptor for HTTP request/response logging. Frontend uses a standalone `LoggerService` with global error handlers.

**Backend design (T-9.1):**

- `Logger` interface in domain layer (`domain/services/logger.interface.ts`) with `debug`, `info`, `warn`, `error` methods.
- `LOGGER` DI token for injection (consistent with existing repository/service token pattern).
- `WinstonLoggerService` implementing `Logger` and NestJS `LoggerService`.
- Environment-aware: colorized console in dev, JSON in production.
- Daily rotate file transport for production (`logs/error-*.log`, `logs/combined-*.log`; 20MB max, 14 days retention).
- `LoggingInterceptor` capturing method, path, status, duration, and sanitizing sensitive body fields (password, token, secret, apiKey).
- `LoggerModule` as `@Global()` module exporting the `LOGGER` token.

**Frontend design (T-9.2):**

- `LoggerService` injectable (`providedIn: 'root'`) with `debug`, `info`, `warn`, `error` levels.
- `GlobalErrorHandler` implementing Angular `ErrorHandler` for unhandled component errors.
- `window.onerror` and `unhandledrejection` listeners for runtime errors.
- API error logging integrated into existing `error.interceptor.ts`.
- Development: colorized console output. Production: structured JSON, errors persisted to localStorage.
- `ErrorBoundaryComponent` for fallback UI on unhandled errors.
- Optional `POST /api/logs` endpoint for frontend error reporting to backend.

**Rationale:**

- **Winston maturity** — The most widely adopted logging library in the Node.js ecosystem. Supports multiple transports, log levels, and structured formatting.
- **Environment-aware formatting** — Colorized human-readable logs in development. JSON-structured logs in production for CloudWatch.
- **Abstraction via interface** — The `Logger` interface is defined independently of Winston. If we swap to Pino or a cloud provider, only the infrastructure implementation changes.
- **DI token pattern** — Consistent with existing `APPOINTMENT_REPOSITORY`, `EVENT_PUBLISHER`, etc. tokens used throughout the codebase.
- **Body sanitization** — Sensitive fields (password, token, secret, apiKey) are redacted in HTTP logs to prevent credential leakage.
- **Frontend error capture** — Angular's `ErrorHandler` + window listeners ensure no error goes unobserved. localStorage persistence enables post-mortem debugging.

**Trade-offs:**

- Winston is heavier than alternatives like Pino. Acceptable for this project's scale.
- Daily rotate file adds disk I/O. Mitigated by size limits and retention policies.
- Frontend localStorage persistence is limited to 50 errors (FIFO). Sufficient for post-mortem; a backend endpoint provides centralized collection.

# 18. Error Handling: Explicit Domain Errors

**Status:** Accepted

**Context:** API clients need clear, actionable error messages. Infrastructure errors (database connection, LLM timeout) should not leak to clients.

**Decision:** Use explicit error classes for domain violations. Map infrastructure errors to generic 500 responses.

**Error catalog:**

| Error | HTTP Code | When |
|-------|-----------|------|
| `SlotAlreadyBookedError` | 409 | Slot was booked between check and booking attempt |
| `SlotNotFoundError` | 404 | Slot does not exist |
| `ClinicNotFoundError` | 404 | Clinic not found |
| `PastDateError` | 400 | Booking attempt for a past date |
| `LLMProviderError` | 502 | LLM API failure |
| `ValidationError` | 400 | Invalid request fields |

**Rationale:**

- **Client clarity** — `SlotAlreadyBookedError: This slot is no longer available` is actionable. `Database error` is not.
- **Security** — Infrastructure errors are logged but never exposed. Raw errors could reveal schema details or connection strings.

---

# 19. Uppercase Enum Values

**Status:** Accepted

**Context:** Enum values are stored in the database and used in API contracts. The casing convention must be consistent.

**Decision:** All PostgreSQL enum values are uppercase (`CONFIRMED`, `CANCELLED`). MongoDB status values use lowercase with underscores (`resolved_by_ai`, `appointment_booked`).

**Rationale:**

- PostgreSQL enums follow SQL convention: `WHERE status = 'CONFIRMED'`.
- MongoDB statuses follow the existing naming convention in the domain (snake_case for multi-word states).
- The distinction is pragmatic: PostgreSQL uses Prisma enums (uppercase by convention), MongoDB uses string fields (lowercase for readability in JSON).

---

# 20. Seed Data Strategy

**Status:** Accepted — PostgreSQL seed (T-7.1) and MongoDB sample seed (T-7.2) implemented

**Context:** The project requires a seed with 6–10 clinic documents, 2 locations, at least 3 specialties, and 2 weeks of availability schedules.

**Decision:** Use Prisma seed scripts for PostgreSQL data and a separate MongoDB seed script for conversation examples.

**Implementation status (`apps/api/prisma/seed.ts` + `apps/api/scripts/seed-mongo.ts`):**

- **PostgreSQL (T-7.1):** Idempotent full seed — 2 clinics (Clínica Norte/Cali, Clínica Sur/Bogotá), 8 doctors, 4 specialties, 2-week weekday slots (8:00–17:30 Colombia, 30 min), 12 knowledge documents with `gemini-embedding-001` embeddings (768 dims). `SEED_RESET=true` forces wipe + reseed.
- **MongoDB (T-7.2):** Independent script `pnpm --filter api seed:mongo` — looks up clinic UUIDs from PostgreSQL, ensures indexes, and seeds 3 sample conversations:
  - `seed-conv-resolved-001` (`resolved_by_ai`, Clínica Norte) — horarios Q&A
  - `seed-conv-booked-002` (`appointment_booked`, Clínica Sur) — pediatría booking
  - `seed-conv-escalated-003` (`escalated`, Clínica Norte) — out-of-KB escalation
  - 20 messages (user/assistant with WhatsApp `messageId`s) and 6 AI traces with tool calls (`buscar_conocimiento`, `consultar_disponibilidad`, `agendar_cita`, `escalar_a_humano`).
  - Idempotent: skips when seed conversation ids already exist. `SEED_RESET=true` wipes conversations/messages/ai_traces and reseeds.
  - Placeholder tokens like `{{tomorrow_colombia}}` are resolved at build time against Colombia (UTC-5) calendar dates.
- Seed data helpers live in `apps/api/prisma/seeds/` and `apps/api/scripts/mongo-seeds/` with unit tests.

**Target seed contents (Phase 7):**

- **2 clinics:** Clínica Norte (Cali), Clínica Sur (Bogotá)
- **3+ specialties:** Medicina General, Dermatología, Cardiología, Pediatría
- **6+ doctors:** Distributed across clinics and specialties
- **2 weeks of slots:** 8 AM – 6 PM, 30-minute intervals, weekdays only
- **8 knowledge documents:** Horarios, sedes, preparación de exámenes, políticas de cancelación, servicios, contacto — embedded with `gemini-embedding-001` (768 dims)
- **Sample conversations:** 2–3 conversations with AI traces for dashboard testing — implemented as 3 conversations covering all terminal statuses

---

# 21. Global InfrastructureModule for Cross-Layer DI Tokens

**Status:** Accepted *(implemented — FIX-application-module-di-tokens)*

**Context:** After AppModule wiring (T-3.2), the API failed at bootstrap with `UnknownDependenciesException`: `CreateAppointmentHandler` could not resolve `Symbol(SlotRepository)` inside `ApplicationModule`. Handlers in the application layer inject domain tokens (`SLOT_REPOSITORY`, `APPOINTMENT_REPOSITORY`, `CONVERSATION_REPOSITORY`, `EVENT_PUBLISHER`, `QUEUE_SERVICE`, etc.) that are provided by `InfrastructureModule`. NestJS only resolves a token from a module's own providers, modules it imports that export the token, or global modules. `ApplicationModule` imports only `CqrsModule`, and `InfrastructureModule` was not global — so production DI failed. Unit tests passed only because `application.module.spec.ts` used a `@Global()` mock module that provided all tokens, masking the wiring gap.

**Decision:** Mark `InfrastructureModule` as `@Global()`, matching the existing pattern used by `DatabaseModule` and `EmbeddingModule`.

**Rationale:**

- **Consistent with established pattern** — `DatabaseModule` (`@Global`, exports `PrismaService`/`MongoService`) and `EmbeddingModule` (`@Global`, exports `EMBEDDING_SERVICE`) already use this approach so infrastructure adapters can be injected without direct import edges (documented in T-1.3 and T-3.2).
- **Preserves layer boundaries** — Application handlers still depend only on domain repository/service tokens and interfaces. `@Global` is NestJS DI wiring at the composition root, not a code dependency from Application → Infrastructure.
- **Single fix for all handlers** — Create/cancel appointment, process incoming message, and conversation query handlers all resolve the same InfrastructureModule tokens.
- **No Application → Infrastructure import** — Avoids coupling layers at the module-graph level and keeps `ApplicationModule` testable with mock-only dependency modules.

**Rejected alternative:** Have `ApplicationModule` import `InfrastructureModule`.

- More explicit NestJS wiring, but couples Application to Infrastructure in the module graph.
- Breaks the global-infrastructure-module convention already used for database and embeddings.
- Risks loading real Prisma/Mongo adapters inside `ApplicationModule` unit tests.

**Trade-offs:**

- Global modules make exported tokens visible everywhere once imported in `AppModule`, which can hide a missing explicit import. Mitigated by regression tests asserting ApplicationModule handler resolution against `InfrastructureModule`.
- `LLM_SERVICE` is provided by `LlmModule` (imported by `AIModule`, exported by `ApplicationModule`); `EMBEDDING_SERVICE` is global via `EmbeddingModule`. Application services that need the orchestrator use `AIOrchestratorService` from `AIModule` rather than injecting `LLM_SERVICE` directly.

---

# 22. Domain Entities as Interfaces + Pure Functions

**Status:** Accepted *(implemented in Phase 1)*

**Context:** Domain entities need business invariants (status transitions, slot range checks, conversation transitions) without coupling to NestJS, Prisma, or MongoDB.

**Decision:** Model domain entities as TypeScript **interfaces** (readonly data) plus **pure functions** for validation/transitions, instead of stateful domain classes.

**Examples:**

- `appointment.entity.ts`: `canCancelAppointment`, `assertAppointmentTransition`, `cancelAppointment`
- `conversation.entity.ts`: `isTerminalConversation`, `assertConversationTransition`, `transitionConversation`
- `slot.entity.ts`: `isValidSlotRange`, `assertValidSlotRange`, `isAvailableSlot`
- Enums own transition tables: `APPOINTMENT_TRANSITIONS`, `CONVERSATION_TRANSITIONS`

**Rationale:**

- **Testability** — Pure functions are trivial to unit test without DI containers.
- **Immutability** — Readonly interfaces prevent accidental mutation of persisted models.
- **Simplicity** — No hidden state; handlers compose entities + repositories explicitly.
- **Clean Architecture fit** — Domain stays framework-free (no NestJS decorators on entities).

**Trade-offs:**

- Less encapsulation than OOP entities with private state; invariants are enforced by calling the right functions, not by object methods.
- Newcomers must learn the function-per-entity convention.

---

# 23. Fixed UTC-5 Offset for Colombia Timezone Helpers

**Status:** Accepted *(implemented in Phase 3)*

**Context:** Operations are in Colombia (`America/Bogota`). Prompts, date validation, and slot parsing must interpret patient-relative dates ("mañana") in local time. Colombia has **no DST**.

**Decision:** Implement timezone helpers in `application/llm/colombia-time.ts` using a **fixed UTC-5 offset** (`COLOMBIA_UTC_OFFSET_HOURS = 5`) and UTC Date math, rather than `Intl.DateTimeFormat` with `timeZone: 'America/Bogota'`.

**Helpers:** `formatColombiaDate`, `formatColombiaDateTime`, `isValidCalendarDate`, `parseColombiaDate`, `parseColombiaDateTime`, `isColombiaDateInPast`, `isColombiaDateTimeInPast`.

**Rationale:**

- **Predictable parsing** — `parseColombiaDateTime("2026-10-07", "15:00")` produces a deterministic UTC instant without locale/ICU edge cases.
- **No DST in Colombia** — Fixed offset is correct today; no seasonal surprises.
- **Prompt consistency** — The same helper formats `"Fecha y hora actual en Colombia: ... (UTC-5)"` in the system prompt and validates tool arguments.
- **Testability** — Pure functions accept `now: Date` for deterministic tests.

**Trade-offs:**

- If the system expands to countries with DST, this helper must switch to `Intl.DateTimeFormat` with IANA time zones (e.g., `America/Bogota` remains safe; others may not).
- The constant mirrors `Clinic.timezone` default in Prisma but does not read it at runtime — clinic-level timezone overrides are not supported yet.

---

# 24. pgvector IVFFlat Index Managed in Migration SQL

**Status:** Accepted *(implemented in Phase 1 migration)*

**Context:** RAG search needs a cosine-distance index on `knowledge_documents.embedding`. Prisma schema support for pgvector indexes is limited for `Unsupported("vector(768)")` columns.

**Decision:** Create the IVFFlat index in the **raw migration SQL**, not in `schema.prisma`.

**Implementation:**

```sql
CREATE INDEX "idx_knowledge_docs_embedding"
  ON "knowledge_documents"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

(`apps/api/prisma/migrations/20261003001317_init/migration.sql`)

**Rationale:**

- Prisma does not model `Unsupported("vector(...))` indexes declaratively; raw SQL is the reliable path.
- The index matches the documented design (cosine ops, lists=100).

**Trade-offs / drift risk:**

- Regenerating migrations from `schema.prisma` alone can **drop** this index if not re-applied manually.
- Documented in DESIGN.md; future schema work must keep the raw SQL migration in sync.

---

# 25. Tool Definitions Split Across Definition, Schema, and Validator

**Status:** Accepted *(implemented in Phase 3)*

**Context:** Tool calling requires three concerns: what the LLM sees, what arguments are structurally valid, and what arguments satisfy domain rules.

**Decision:** Separate files under `application/llm/`:

| File | Responsibility |
|------|----------------|
| `tool-definitions.ts` | OpenAI-compatible tool JSON (`TOOL_DEFINITIONS`) passed to the LLM |
| `tool-schemas.ts` | Zod schemas (`TOOL_SCHEMAS`) for structural validation |
| `tool-validator.ts` | `ToolValidator`: Zod → domain rules → parsed result (`clinicId`, `slotId`, etc.) |
| `prompt-builder.ts` | System prompt with Colombia datetime + tool list |
| `ai-orchestrator.service.ts` | Loop, iteration limit, escalation, trace persistence |

**Rationale:**

- **Open/Closed** — Adding a tool means updating definitions + schema + validator cases without rewriting the orchestrator.
- **Untrusted input** — LLM arguments always pass Zod before domain checks; invalid results are returned to the LLM as tool results (not system errors).
- **Testability** — Each layer has dedicated specs (`tool-definitions.spec.ts`, `tool-schemas.spec.ts`, `tool-validator.spec.ts`, `ai-orchestrator.service.spec.ts`).

**Trade-offs:**

- Slight duplication between definition JSON and Zod schemas; mitigated by keeping them adjacent and tested.

---

# 26. MockLLMService for Deterministic Orchestration Tests

**Status:** Accepted *(implemented in Phase 3)*

**Context:** Orchestration tests must verify tool loops, validation feedback, and escalation without hitting Gemini.

**Decision:** Provide `MockLLMService` (`infrastructure/llm/mock-llm.service.ts`) implementing `LLMService`, with:

- `setResponses(responses: LLMChatResult[])` — queue of canned results
- `calls` / `callCount` — inspect prompts/tools sent to the LLM
- Default empty response when queue is empty

**Rationale:**

- Same interface as `GeminiLLMService` — orchestrator code paths are identical in tests and production.
- Tests can assert iteration count (`MAX_TOOL_ITERATIONS = 5`), tool definitions passed, and escalation behavior.

**Trade-offs:**

- Mock fidelity depends on tests constructing realistic `LLMChatResult` objects; contract tests for `GeminiLLMService` still need separate coverage (done via unit specs of the adapter).

---

# 27. Trade-offs Summary

| Decision | Chose | Instead Of | Cost |
|----------|-------|------------|------|
| Dual DB (PG + MongoDB) | PostgreSQL + MongoDB | Single PostgreSQL | Cross-DB consistency complexity |
| pgvector | pgvector | Qdrant/Pinecone | Less optimized at massive scale |
| Direct LLM SDK | Gemini via OpenAI-compatible endpoint | LangChain | Manual tool calling loop |
| Queue + Worker | SQS/BullMQ (InMemory until T-4.1) | Inline processing | Two processes to run |
| Shared multi-tenant | Shared DB + RLS | DB-per-tenant | Less isolation |
| ECS Fargate | Fargate | Lambda | Slightly higher base cost |
| Angular | Angular | Vue/React | More boilerplate |
| Domain style | Interfaces + pure functions | Stateful domain classes | Call sites must invoke transition helpers |
| Colombia time | Fixed UTC-5 offset helpers | Intl timeZone API | Must revisit if multi-country DST |
| pgvector index | Raw migration SQL | schema.prisma index | Drift risk if migrations regenerated |

---

# 28. What I Would Do Differently with More Time

- **Response quality evaluation** — Automated evaluation of LLM responses (correctness, helpfulness, hallucination detection) using a separate evaluation pipeline.
- **Observability** — Distributed tracing (X-Ray) across API → Queue → Worker → LLM. Custom CloudWatch dashboards for cost per conversation, tool call success rates, and escalation rates.
- **Multi-client platform** — Separate configuration per clinic (custom system prompts, knowledge bases, working hours). Tenant-aware rate limiting.
- **Conversation memory** — Summarize long conversations to stay within LLM context windows. Persist conversation summaries for quick context loading.
- **Human handoff** — Integration with a live chat system (e.g., WhatsApp Business API, Twilio) for real human escalation.
- **Infrastructure as Code** — Full CDK or Terraform definitions for all AWS resources. Currently designed but not coded.
- **Evaluation dataset** — A curated set of test conversations with expected responses for regression testing.

---

# 29. Use of AI

**Where AI assisted:**

- Generating seed data (clinic documents, doctor names, availability schedules).
- Drafting the initial Zod schemas for tool argument validation.
- Reviewing AWS architecture options and cost estimates.
- Generating Mermaid diagrams for documentation.

**What AI got wrong or incomplete:**

- Initial suggestions included LangChain for tool calling — rejected because direct SDK is simpler for this use case.
- AI suggested a single PostgreSQL database for everything — rejected because MongoDB is better suited for flexible-schema conversation data.
- Cost estimates required manual verification against AWS pricing pages.

**What I validated or corrected:**

- Verified pgvector availability on RDS PostgreSQL (it is supported as an extension).
- Verified that SQS DLQ configuration matches the retry requirements.
- Confirmed that Colombia does not observe DST, simplifying timezone handling.