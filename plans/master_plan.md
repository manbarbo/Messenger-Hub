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
| Persistence | Prisma schema + init migration + partial seed (clinic/doctor/slots); Mongo service + indexes (`messages.messageId` unique sparse) |
| Repositories | 5 Prisma adapters (appointment, clinic, doctor, slot, knowledge/RAG) + 3 Mongo adapters (conversation, message, ai_trace) |
| CQRS | 3 commands (create/cancel appointment, process incoming message) + 2 queries (list conversations, get detail) + event handlers (log-only) |
| AI pipeline | `LLMService` + `GeminiLLMService` + `MockLLMService`; `EmbeddingService` + `GeminiEmbeddingService`; RAG via pgvector cosine > 0.7; Zod schemas + `ToolValidator`; `AIOrchestratorService` (max 5 iterations, force-escalate, traces); `PromptBuilder`; `colombia-time.ts` |
| DI | `DatabaseModule`, `InfrastructureModule` (@Global), `LlmModule`, `EmbeddingModule` (@Global), `AIModule`, `ApplicationModule` |
| Tests | Vitest unit specs across domain, CQRS, repositories, LLM/RAG/orchestration, infrastructure adapters |

**Current gaps (planned Phases 4–8):**

- Phase 4 (async processing) is complete: BullMQ queue, worker consumer, and `POST /webhooks/messages`.
- Phase 5 is complete: dashboard/simulator controllers (T-5.1) + global `DomainExceptionFilter` (T-5.2). Request validation is Zod-based in controllers; class-validator pipe was not added (see T-5.2 plan notes).
- Orchestrator returns `ConversationStatus`; worker persists it via `ConversationRepository.updateStatus` after `processTurn`.
- Seed does not yet include knowledge documents/embeddings (T-7.1) or Mongo samples (T-7.2).
- Coverage gate (≥ 75%) is Phase 8 (T-8.3).
- IVFFlat index lives in migration SQL, not `schema.prisma` (documented in DECISIONS.md §24).

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
| T-5.1 | API Layer | Controllers & Routes | Backend | Completed | 2–3 |
| T-5.2 | API Layer | Error Handling & Validation | Backend | Completed | 1–2 |
| T-6.1 | Frontend | Angular Foundation | Frontend | Completed | 2–3 |
| T-6.2 | Frontend | Conversation Inbox | Frontend | Completed | 2–3 |
| T-6.3 | Frontend | Conversation Detail + AI Traces | Frontend | Backlog | 3–4 |
| T-6.4 | Frontend | Patient Simulator | Frontend | Backlog | 1–2 |
| T-7.1 | Seed Data | PostgreSQL Seed | Backend | Backlog | 1–2 |
| T-7.2 | Seed Data | MongoDB Seed | Backend | Backlog | 1 |
| T-8.1 | Testing | Backend Testing | Backend | Backlog | 3–4 |
| T-8.2 | Testing | Frontend Testing | Frontend | Backlog | 2–3 |
| T-8.3 | Testing | Coverage Verification | Full Stack | Backlog | 1 |

**Total estimated effort:** 42–60 hours (feasible in 2–3 days with AI assistance)

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

T-4.3 (Webhook) + T-5.1 (Controllers)
  └── T-5.2 (Error Handling)

T-8.1 (Backend Testing) — runs in parallel with T-2.x through T-5.x
T-8.2 (Frontend Testing) — runs after T-6.2, T-6.3, T-6.4
T-8.3 (Coverage Verification) — final gate
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