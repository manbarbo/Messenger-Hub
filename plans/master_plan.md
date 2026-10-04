# Master Implementation Plan

## MessengerHub — Task Summary

This document provides a high-level overview of all implementation tasks. Detailed task plans are in the `backlog/` folder, organized by phase and layer.

**Timeline:** 2–3 days
**Stack:** NestJS + Angular + PostgreSQL (pgvector) + MongoDB + Google Gemini

---

## Phase 1–3 Completion Notes (2026-10-02)

Phases 1–3 are **Completed**. What exists in the codebase today:

| Area | Delivered |
|------|-----------|
| Domain | Entities (interfaces + pure functions), enums, value objects, repository/service DI tokens, domain errors, domain events |
| Persistence | Prisma schema + init migration + full PG seed (2 clinics, 8 doctors, 2-week slots, 12 knowledge docs + embeddings); Mongo service + indexes (`messages.messageId` unique sparse) |
| Repositories | 5 Prisma adapters (appointment, clinic, doctor, slot, knowledge/RAG) + 3 Mongo adapters (conversation, message, ai_trace) |
| CQRS | 3 commands (create/cancel appointment, process incoming message) + 2 queries (list conversations, get detail) + event handlers (log-only) |
| AI pipeline | `LLMService` + `GeminiLLMService` + `MockLLMService`; `EmbeddingService` + `GeminiEmbeddingService`; RAG via pgvector cosine > 0.7; Zod schemas + `ToolValidator`; `AIOrchestratorService` (max 5 iterations, force-escalate, traces); `PromptBuilder`; `colombia-time.ts` |
| DI | `DatabaseModule`, `InfrastructureModule` (@Global), `LlmModule`, `EmbeddingModule` (@Global), `AIModule`, `ApplicationModule` |
| Tests | Vitest unit specs across domain, CQRS, repositories, LLM/RAG/orchestration, infrastructure adapters |

**Current gaps (planned Phases 4–8):**

- Phase 4 (async processing) is complete: BullMQ queue, worker consumer, and `POST /webhooks/messages`.
- Phase 5 is complete: dashboard/simulator controllers (T-5.1) + global `DomainExceptionFilter` (T-5.2). Request validation is Zod-based in controllers; class-validator pipe was not added (see T-5.2 plan notes).
- Orchestrator returns `ConversationStatus`; worker persists it via `ConversationRepository.updateStatus` after `processTurn`.
- PostgreSQL seed (T-7.1) and MongoDB sample seed (T-7.2) are complete: 2 clinics, 8 doctors, 4 specialties, 2-week weekday slots, 12 knowledge documents with `gemini-embedding-001` (768 dims); 3 sample conversations (resolved_by_ai / appointment_booked / escalated) with 20 messages and 6 AI traces.
- Coverage gate (≥ 75%) is complete (Phase 8): backend 98%+, frontend 95%+, thresholds enforced in vitest and Angular test configs.
- IVFFlat index lives in migration SQL, not `schema.prisma` (documented in DECISIONS.md §24).

---

## Phase 8 Completion Notes (2026-10-02)

Phase 8 (Testing & Quality) is **Completed**.

| Task | Result |
|------|--------|
| T-8.1 Backend Testing | 56 spec files / 350 tests; coverage 98.44% stmts, 95.13% branch, 100% funcs, 98.44% lines |
| T-8.2 Frontend Testing | 11 spec files / 56 tests; coverage 95.3% stmts, 90.19% branch, 85.71% funcs, 96.93% lines |
| T-8.3 Coverage Verification | `pnpm test` passes both apps; 75% thresholds enforced; no real LLM/DB/queue in unit tests |

Key fixes in Phase 8:
- Aligned Angular web coverage tooling (`@vitest/coverage-v8@^5.0.0` to match vitest 5.x from Angular 22 builder)
- Added lifecycle tests for `MongoService` / `PrismaService`
- Closed remaining backend branch gaps (orchestrator edge cases, filter HttpException fallbacks, worker DLQ/completed paths, Gemini error wrapping)
- Coverage thresholds configured in `apps/api/vitest.config.ts` and `apps/web/angular.json`

---

## Phase 9 Completion Notes (2026-10-03)

Phase 9 (Structured Logging) is **Completed**.

| Task | Result |
|------|--------|
| T-9.1 Backend Logging System | `Logger` interface + `LOGGER` DI token, `WinstonLoggerService`, `LoggingInterceptor` with body sanitization, daily rotate file transport, `LoggerModule` (@Global) |
| T-9.2 Frontend Logging & Error Tracking | `LoggerService` injectable, `GlobalErrorHandler`, runtime error listeners, API error logging, `ErrorBoundaryComponent` |
| T-9.3 Add Structured Logging Across Application | 28 backend files + 5 frontend files instrumented; all `new Logger(...)` and `console.*` replaced with structured logging |
| T-9.4 Backend List Clinics | `GET /api/clinics` CQRS query (`ListClinicsQuery` + handler), `ClinicRepository.findAll()`, `PrismaClinicRepository`, `ClinicsController` |
| T-9.5 Frontend Clinic Dropdowns | Simulator clinic name select + conversation list clinic filter via `ApiService.listClinics()` |
| T-9.6 Chat-like Patient Simulator | Form → chat mode, reuses `MessageTimelineComponent`, polls `GET /api/conversations/:id` for `assistant:${messageId}`, multi-turn composer |

Key outcomes:
- **Backend:** All 419 tests pass, lint clean. Zero `new Logger(` or `console.*` in source. All state mutations, external calls (LLM, embedding, DB), queue operations, and error paths logged with structured metadata. `GET /api/clinics` returns clinic `id` + `name` for dashboard dropdowns.
- **Frontend:** All 87 tests pass (coverage 95%+), lint clean. Components log data loading, user actions, and errors via `LoggerService`. Simulator is a WhatsApp-like chat window after the first message; conversation list filters by clinic name.
- **Structured logging is now mandatory** for all future implementations (AGENTS.md §18, Definition of Done §24).

---

## Phase 10 Planned (2026-10-03)

Phase 10 (RAG Knowledge Base Management) is **Planned** — task plans live in `plans/backlog/`.

Enable operators to **consult, create, update, and delete** RAG `knowledge_documents` from the dashboard (admin CRUD for the clinic knowledge base used by semantic search). Patient-facing tool-calling flows are unchanged; this phase is a management surface on top of the existing RAG pipeline.

| Task | Layer | Scope |
|------|-------|--------|
| T-10.1 Backend Knowledge Repository CRUD | Backend | **Completed (2026-10-03):** `KnowledgeRepository` + Prisma adapter (`findById`, `findMany` paginated, `update`, `delete`); `KnowledgeDocumentNotFoundError`; embedding raw SQL on update; 429 API tests pass |
| T-10.2 Backend Knowledge CQRS | Backend | Create/Update/Delete commands + List/Get queries; handlers use `EMBEDDING_SERVICE` (re-embed when title/content change); structured logging |
| T-10.3 Backend Knowledge REST API | Backend | `KnowledgeDocumentsController` — `GET/POST /api/knowledge`, `GET/PATCH/DELETE /api/knowledge/:id`; Zod validation; DESIGN.md + README |
| T-10.4 Frontend Knowledge List | Frontend | `/knowledge` route + nav; clinic/category filters; table + pagination + detail consult; `ApiService.listKnowledgeDocuments` |
| T-10.5 Frontend Knowledge CRUD | Frontend | Create/edit form, delete confirmation, list refresh; form validation; tests |

Key design constraints for Phase 10:
- All documents are scoped by `clinicId` (multi-tenant RAG).
- Embeddings use the same model/dims as search (`gemini-embedding-001`, 768) — re-embed on create and on title/content update (AGENTS.md §14).
- Repository stays persistence-only; command handlers orchestrate embedding via domain `EmbeddingService` port.
- No Prisma schema change required for basic CRUD (`embedding` column already exists).

---

## Phase 4 Extension Completion Notes (2026-10-03)

T-4.4 (BullBoard Queue Monitoring) is **Completed**.

| Task | Result |
|------|--------|
| T-4.4 BullBoard Queue Monitoring | `BullBoardService` infrastructure adapter mounts BullBoard at `/admin/queues` on the API process; both `message-processing` + DLQ; env-gated (dev on / prod off); optional basic auth |

Key outcomes:
- Queue review UI available at `http://localhost:3000/admin/queues` in development.
- Backend: 410 tests pass (62 files), typecheck clean, lint clean.
- Domain/app layers never import `@bull-board/*`; adapter-only integration reusing existing BullMQ queue instances.

---

## DX Fix Completion Notes (2026-10-03)

FIX-dev-start-worker-process: `pnpm dev` now starts **api + worker + web** via `concurrently`. Root `package.json` also exposes `dev:worker`. Queue jobs no longer sit in Bull Board `waiting` when using the default local command. The worker remains a separate process (DECISIONS.md §7 unchanged); README documents startup and the `waiting` / `EADDRINUSE` troubleshooting paths.

Follow-up: worker Nest CLI config fixed — `entryFile: "worker-main"` must be at the **root** of `apps/api/nest-cli.worker.json` (not under `compilerOptions`). `deleteOutDir: false` on both nest-cli configs avoids concurrent webpack builds overwriting each other’s `dist/*.js` bundles. Verified: `build:worker` emits `dist/worker-main.js` with `WorkerModule`; worker does not listen on port 3000.

Follow-up: worker DI fix — `MessageProcessorService` value-imports `AIOrchestratorService` (was `import type`, which erased Nest `design:paramtypes` and caused `UnknownDependenciesException` with `[Function: Object]` at constructor index 1). See `plans/completed/FIX-message-processor-import-type.md`.

---

## Implementation Order

```text
Phase 1: Foundation (Day 1 — Morning)
  1.1 Project Scaffolding
  1.2 Domain Layer
  1.3 Database Setup (PostgreSQL + MongoDB + Docker Compose)

Phase 2: Backend Core — Data (Day 1 — Afternoon)
  2.1 Infrastructure Layer — PostgreSQL Repositories
  2.2 Infrastructure Layer — MongoDB Repositories
  2.3 CQRS Commands
  2.4 CQRS Queries

Phase 3: AI Pipeline (Day 1 Evening — Day 2 Morning)
  3.1 LLM Service & Tool Calling
  3.2 RAG Pipeline (Embeddings + Knowledge Search)
  3.3 Tool Calling Validation (Zod Schemas)
  3.4 AI Orchestration (Prompt, Iteration Limits, Escalation)

Phase 4: Async Processing (Day 2 — Midday)
  4.1 Queue Service (BullMQ)
  4.2 Worker (Message Processing)
  4.3 Webhook Endpoint

Phase 5: API Layer (Day 2 — Afternoon)
  5.1 Controllers & Routes
  5.2 Error Handling & Validation

Phase 6: Frontend (Day 2 Evening — Day 3 Morning)
  6.1 Angular Foundation
  6.2 Conversation Inbox View
  6.3 Conversation Detail View (Messages + AI Traces)
  6.4 Patient Simulator

Phase 7: Seed Data (Day 3 — Midday)
  7.1 PostgreSQL Seed (Clinics, Doctors, Slots, Knowledge)
  7.2 MongoDB Seed (Sample Conversations + Traces)

Phase 8: Testing & Quality (Day 3 — Afternoon)
  8.1 Backend Testing
  8.2 Frontend Testing
  8.3 Coverage Verification

Phase 9: Logging (Day 3 — Evening)
  9.1 Backend Logging System
  9.2 Frontend Logging & Error Tracking
  9.3 Add Structured Logging Across Application

Phase 10: RAG Knowledge Base Management
  10.1 Backend Knowledge Repository CRUD
  10.2 Backend Knowledge CQRS Commands & Queries
  10.3 Backend Knowledge REST API
  10.4 Frontend Knowledge Base List
  10.5 Frontend Knowledge CRUD UI
```

---

## Task Summary Table

| ID | Phase | Task | Layer | Status | Est. Hours |
|----|-------|------|-------|--------|------------|
| T-1.1 | Foundation | Project Scaffolding | Full Stack | Completed | 1–2 |
| T-1.2 | Foundation | Domain Layer | Backend | Completed | 2–3 |
| T-1.3 | Foundation | Database Setup | Backend | Completed | 2–3 |
| T-2.1 | Backend Core | PostgreSQL Repositories | Backend | Completed | 2–3 |
| T-2.2 | Backend Core | MongoDB Repositories | Backend | Completed | 2–3 |
| T-2.3 | Backend Core | CQRS Commands | Backend | Completed | 2–3 |
| T-2.4 | Backend Core | CQRS Queries | Backend | Completed | 1–2 |
| T-3.1 | AI Pipeline | LLM Service & Tool Calling | Backend | Completed | 3–4 |
| T-3.2 | AI Pipeline | RAG Pipeline | Backend | Completed | 2–3 |
| T-3.3 | AI Pipeline | Tool Calling Validation | Backend | Completed | 2–3 |
| T-3.4 | AI Pipeline | AI Orchestration | Backend | Completed | 2–3 |
| T-4.1 | Async Processing | Queue Service | Backend | Completed | 1–2 |
| T-4.2 | Async Processing | Worker | Backend | Completed | 2–3 |
| T-4.3 | Async Processing | Webhook Endpoint | Backend | Completed | 1–2 |
| T-4.4 | Async Processing | BullBoard Queue Monitoring | Backend | Completed | 1–2 |
| T-5.1 | API Layer | Controllers & Routes | Backend | Completed | 2–3 |
| T-5.2 | API Layer | Error Handling & Validation | Backend | Completed | 1–2 |
| T-6.1 | Frontend | Angular Foundation | Frontend | Completed | 2–3 |
| T-6.2 | Frontend | Conversation Inbox | Frontend | Completed | 2–3 |
| T-6.3 | Frontend | Conversation Detail + AI Traces | Frontend | Completed | 3–4 |
| T-6.4 | Frontend | Patient Simulator | Frontend | Completed | 1–2 |
| T-7.1 | Seed Data | PostgreSQL Seed | Backend | Completed | 1–2 |
| T-7.2 | Seed Data | MongoDB Seed | Backend | Completed | 1 |
| T-8.1 | Testing | Backend Testing | Backend | Completed | 3–4 |
| T-8.2 | Testing | Frontend Testing | Frontend | Completed | 2–3 |
| T-8.3 | Testing | Coverage Verification | Full Stack | Completed | 1 |
| T-9.1 | Logging | Backend Logging System | Backend | Completed | 2–3 |
| T-9.2 | Logging | Frontend Logging & Error Tracking | Frontend | Completed | 2–3 |
| T-9.3 | Logging | Add Structured Logging Across Application | Full Stack | Completed | 4–6 |
| T-9.4 | Clinic Dropdowns | Backend List Clinics (`GET /api/clinics`) | Backend | Completed | 1–2 |
| T-9.5 | Clinic Dropdowns | Frontend Clinic Dropdowns (Simulator + Conversation List) | Frontend | Completed | 2 |
| T-9.6 | Chat Simulator | Chat-like Patient Simulator | Frontend | Completed | 2–3 |
| T-10.1 | Knowledge Base | Backend Knowledge Repository CRUD | Backend | Completed | 2–3 |
| T-10.2 | Knowledge Base | Backend Knowledge CQRS Commands & Queries | Backend | Backlog | 3–4 |
| T-10.3 | Knowledge Base | Backend Knowledge REST API | Backend | Backlog | 2–3 |
| T-10.4 | Knowledge Base | Frontend Knowledge Base List | Frontend | Backlog | 2–3 |
| T-10.5 | Knowledge Base | Frontend Knowledge CRUD UI | Frontend | Backlog | 3–4 |

**Total estimated effort:** 64–90 hours (Phases 1–9 completed; Phase 10 adds ~12–17h for RAG document management)

---

## Dependencies

```text
T-1.1 (Scaffolding)
  ├── T-1.2 (Domain)
  │     └── T-2.1 (PG Repos)
  │     └── T-2.2 (Mongo Repos)
  │           └── T-2.3 (Commands)
  │           └── T-2.4 (Queries)
  │                 └── T-5.1 (Controllers)
  │                       └── T-5.2 (Error Handling)
  ├── T-1.3 (Database)
  │     └── T-2.1 (PG Repos)
  │     └── T-2.2 (Mongo Repos)
  │     └── T-7.1 (PG Seed)
  │     └── T-7.2 (Mongo Seed)
  └── T-6.1 (Angular Foundation)
        └── T-6.2 (Conversation Inbox)
        └── T-6.3 (Conversation Detail)
        └── T-6.4 (Simulator)

T-1.2 (Domain)
  └── T-3.3 (Tool Validation)
        └── T-3.4 (AI Orchestration)

T-3.1 (LLM Service)
  └── T-3.4 (AI Orchestration)
        └── T-4.2 (Worker)

T-3.2 (RAG Pipeline)
  └── T-3.4 (AI Orchestration)

T-2.3 (Commands) + T-2.4 (Queries)
  └── T-5.1 (Controllers)

T-4.1 (Queue)
  └── T-4.2 (Worker)
  └── T-4.3 (Webhook)
  └── T-4.4 (BullBoard Monitoring) — depends on T-4.1 (queues) + T-4.2 (DLQ)

T-4.3 (Webhook) + T-5.1 (Controllers)
  └── T-5.2 (Error Handling)

T-8.1 (Backend Testing) — runs in parallel with T-2.x through T-5.x
T-8.2 (Frontend Testing) — runs after T-6.2, T-6.3, T-6.4
T-8.3 (Coverage Verification) — final gate

T-5.2 (Error Handling)
  └── T-9.1 (Backend Logging)

T-6.1 (Angular Foundation)
  └── T-9.2 (Frontend Logging)

T-9.1 (Backend Logging)
  └── T-9.2 (Frontend Logging) — optional: backend /api/logs endpoint depends on T-9.1 LOGGER
  └── T-9.3 (Add Structured Logging) — depends on both T-9.1 and T-9.2
  └── T-9.4 (Backend List Clinics) — depends on T-2.4 (ClinicRepository)
  └── T-9.5 (Frontend Clinic Dropdowns) — depends on T-9.4 (GET /api/clinics)
  └── T-9.6 (Chat-like Simulator) — depends on T-9.5 + T-6.3 (message timeline)

T-3.2 (RAG Pipeline) + T-9.1 (Logging)
  └── T-10.1 (Knowledge Repository CRUD)
        └── T-10.2 (Knowledge CQRS)
              └── T-10.3 (Knowledge REST API)
                    └── T-10.4 (Frontend Knowledge List) — also depends on T-9.4 (clinics dropdown)
                          └── T-10.5 (Frontend Knowledge CRUD)
```

---

## Files Per Task (Quick Reference)

| Task | Key Files |
|------|-----------|
| T-1.1 | `package.json`, `pnpm-workspace.yaml`, `docker-compose.yml`, `apps/api/`, `apps/web/` |
| T-1.2 | `apps/api/src/domain/entities/`, `apps/api/src/domain/enums/`, `apps/api/src/domain/repositories/`, `apps/api/src/domain/events/`, `apps/api/src/domain/errors/` |
| T-1.3 | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `docker-compose.yml` |
| T-2.1 | `apps/api/src/infrastructure/repositories/prisma-*.repository.ts`, `apps/api/src/infrastructure/database/prisma.service.ts` |
| T-2.2 | `apps/api/src/infrastructure/repositories/mongo-*.repository.ts`, `apps/api/src/infrastructure/database/mongo.service.ts` |
| T-2.3 | `apps/api/src/application/commands/` |
| T-2.4 | `apps/api/src/application/queries/` |
| T-3.1 | `apps/api/src/infrastructure/llm/gemini-llm.service.ts`, `apps/api/src/domain/services/llm.service.ts` |
| T-3.2 | `apps/api/src/infrastructure/embeddings/gemini-embedding.service.ts`, `apps/api/src/infrastructure/repositories/prisma-knowledge.repository.ts` |
| T-3.3 | `apps/api/src/application/llm/tool-schemas.ts`, `apps/api/src/application/llm/tool-validator.ts` |
| T-3.4 | `apps/api/src/application/llm/ai-orchestrator.service.ts`, `apps/api/src/application/llm/prompt-builder.ts` |
| T-4.1 | `apps/api/src/infrastructure/queue/bullmq-queue.service.ts`, `apps/api/src/infrastructure/queue/queue.module.ts` |
| T-4.2 | `apps/api/src/application/worker/message-processor.service.ts`, `apps/api/src/infrastructure/queue/bullmq-message.worker.ts`, `apps/api/src/application/worker/worker.module.ts`, `apps/api/src/worker-main.ts` |
| T-4.3 | `apps/api/src/presentation/controllers/webhook.controller.ts`, `apps/api/src/presentation/presentation.module.ts` |
| T-4.4 | `apps/api/src/infrastructure/queue/bull-board.service.ts`, `apps/api/src/infrastructure/queue/bullmq-queue.service.ts`, `apps/api/src/main.ts`, `apps/api/.env.example` |
| T-5.1 | `apps/api/src/presentation/controllers/conversations.controller.ts`, `apps/api/src/presentation/controllers/simulator.controller.ts` |
| T-5.2 | `apps/api/src/presentation/filters/`, `apps/api/src/presentation/pipes/` |
| T-6.1 | `apps/web/src/app/`, routing, shared components, API service |
| T-6.2 | `apps/web/src/app/conversations/conversation-list/` |
| T-6.3 | `apps/web/src/app/conversations/conversation-detail/` |
| T-6.4 | `apps/web/src/app/simulator/` |
| T-7.1 | `apps/api/prisma/seed.ts`, `apps/api/prisma/seeds/` |
| T-7.2 | `apps/api/scripts/seed-mongo.ts` |
| T-8.1 | `apps/api/src/**/*.spec.ts` |
| T-8.2 | `apps/web/src/**/*.spec.ts` |
| T-8.3 | Coverage reports |
| T-9.1 | `apps/api/src/domain/services/logger.interface.ts`, `apps/api/src/infrastructure/logging/`, `apps/api/src/presentation/interceptors/logging.interceptor.ts` |
| T-9.2 | `apps/web/src/app/core/logger.service.ts`, `apps/web/src/app/core/global-error.handler.ts`, `apps/web/src/app/shared/components/error-boundary/` |
| T-9.3 | 28 backend files (handlers, services, repositories, controllers) + 5 frontend files (components, api service) |
| T-9.4 | `apps/api/src/application/queries/list-clinics/`, `apps/api/src/presentation/controllers/clinics.controller.ts`, `apps/api/src/infrastructure/repositories/prisma-clinic.repository.ts` |
| T-9.5 | `apps/web/src/app/core/models/clinic.model.ts`, `apps/web/src/app/simulator/`, `apps/web/src/app/conversations/conversation-list/` |
| T-9.6 | `apps/web/src/app/simulator/` (chat mode, polling, timeline reuse) |
| T-10.1 | `apps/api/src/domain/errors/knowledge-document-not-found.error.ts`, `apps/api/src/domain/repositories/knowledge.repository.ts`, `apps/api/src/infrastructure/repositories/prisma-knowledge.repository.ts` |
| T-10.2 | `apps/api/src/application/commands/knowledge-documents/`, `apps/api/src/application/queries/knowledge-documents/`, `apps/api/src/application/application.module.ts` |
| T-10.3 | `apps/api/src/presentation/controllers/knowledge-documents.controller.ts`, `apps/api/src/presentation/dto/knowledge-document.schema.ts`, `DESIGN.md`, `README.md` |
| T-10.4 | `apps/web/src/app/core/models/knowledge-document.model.ts`, `apps/web/src/app/core/api.service.ts`, `apps/web/src/app/knowledge/knowledge-list/`, `apps/web/src/app/app.routes.ts`, `apps/web/src/app/shared/layout/layout.component.html` |
| T-10.5 | `apps/web/src/app/knowledge/knowledge-form/`, `apps/web/src/app/knowledge/knowledge-list/`, `apps/web/src/app/shared/confirm-dialog/`, `apps/web/src/app/core/api.service.ts` |

---

## Day Breakdown

### Day 1

| Time Block | Tasks | Goal |
|------------|-------|------|
| Morning (3h) | T-1.1, T-1.2 | Monorepo scaffold + domain layer |
| Afternoon (4h) | T-1.3, T-2.1, T-2.2 | Database setup + both repository layers |
| Evening (3h) | T-2.3, T-2.4, T-3.1 | CQRS handlers + LLM service adapter |

### Day 2

| Time Block | Tasks | Goal |
|------------|-------|------|
| Morning (3h) | T-3.2, T-3.3 | RAG pipeline + tool validation |
| Midday (3h) | T-3.4, T-4.1, T-4.2 | AI orchestration + queue + worker |
| Afternoon (3h) | T-4.3, T-5.1, T-5.2 | Webhook + controllers + error handling |
| Evening (3h) | T-6.1, T-6.2 | Angular foundation + conversation inbox |

### Day 3

| Time Block | Tasks | Goal |
|------------|-------|------|
| Morning (3h) | T-6.3, T-6.4 | Conversation detail + simulator |
| Midday (2h) | T-7.1, T-7.2 | Seed data for both databases |
| Afternoon (3h) | T-8.1, T-8.2, T-8.3 | Testing + coverage verification |
| Evening (2h) | T-9.1, T-9.2 | Backend + frontend logging |