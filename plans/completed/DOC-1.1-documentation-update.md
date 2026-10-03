# DOC-1.1 — Documentation Update After Phases 1–3

**Status:** Completed
**Date:** 2026-10-02
**Completed:** 2026-10-02
**Type:** Documentation

---

## Objective

Sync project documentation (`README.md`, `DESIGN.md`, `DECISIONS.md`, `AGENTS.md`, `plans/master_plan.md`) with the actual implementation of Phases 1–3 (T-1.1 through T-3.4), which are completed. The docs currently describe the full target system (webhooks, queue worker, dashboard endpoints, full seed) as if it were already running, and contain outdated setup commands and folder paths.

---

## Acceptance Criteria

- [x] README reflects real implementation status (Phases 1–3 done; 4–8 backlog)
- [x] README setup commands match real scripts (`apps/api/.env.example`, `db:migrate`/`db:seed`, `mongo:indexes`)
- [x] README API endpoints section is labeled as planned (Phase 5), not currently exposed
- [x] DESIGN.md notes `embedding` nullable until T-7.1 and that IVFFlat lives in migration SQL (not `schema.prisma`)
- [x] DESIGN.md MongoDB `conversations` indexes match `mongo-indexes.ts` (`clinicId+patientPhone`)
- [x] DESIGN.md notes orchestration returns conversation status; Mongo status persistence is wired in Phase 4/5
- [x] DECISIONS.md records real Phase 1–3 implementation decisions (interfaces+pure functions, InMemory queue binding, fixed UTC-5 helper, IVFFlat via migration, partial seed)
- [x] AGENTS.md plan folder paths match reality (`plans/backlog|inProgress|completed`)
- [x] `plans/master_plan.md` includes a short Phase 1–3 completion summary

---

## Implementation Steps

1. Update `README.md`:
   - Add "Implementation Status" section after Tech Stack.
   - Fix env copy path and DB setup commands.
   - Label API endpoints as planned.
   - Correct project-structure comments (presentation placeholder, empty `docs/`/`scripts/`, InMemory queue).
   - Adjust Features to separate implemented vs planned.

2. Update `DESIGN.md`:
   - Add status preamble for Phases 1–3.
   - Fix `knowledge_documents` notes (nullable embedding, IVFFlat in migration).
   - Fix MongoDB conversation indexes.
   - Note conversation-status persistence gap after AI turn.
   - Label API contracts and error catalog as target contracts (Phase 5).

3. Update `DECISIONS.md`:
   - Amend Queue decision (InMemory binding until BullMQ T-4.1).
   - Document fixed-offset Colombia time helper.
   - Document entity-as-interface + pure-function domain style.
   - Document IVFFlat managed in migration SQL.
   - Update seed strategy status (current seed partial; full seed T-7.1).
   - Clarify AIModule wiring for `LLM_SERVICE` (resolves prior InfrastructureModule trade-off note).
   - Add decisions §22–§26 for Phase 1–3 implementation choices; renumber trailing sections.

4. Update `AGENTS.md`:
   - Align plan folder casing with real directories.
   - Clarify `scripts/` location (`apps/api/scripts`) and presentation placeholder status.

5. Update `plans/master_plan.md` with Phase 1–3 completion notes (what exists: domain, repos, CQRS, LLM/RAG/orchestration, unit tests; what is pending: queue/worker/webhook, presentation API, frontend features, full seed, coverage gate).

---

## File Structure

```text
README.md
DESIGN.md
DECISIONS.md
AGENTS.md
plans/master_plan.md
plans/inProgress/DOC-1.1-documentation-update.md   # this plan
plans/completed/DOC-1.1-documentation-update.md    # after completion
```

---

## Verification

- [x] Grep docs for `db:setup`, `plans/Backlog`, `cp .env.example` — no stale matches.
- [x] README states Phases 1–3 Completed and Phases 4–8 Backlog.
- [x] DESIGN notes match `schema.prisma` (`embedding ...?`) and `mongo-indexes.ts`.
- [x] DECISIONS mentions `InMemoryQueueService` as current `QUEUE_SERVICE` binding.
- [x] AGENTS plan paths use lowercase folder names that exist on disk.

---

## References

- `plans/master_plan.md` — phase status table
- `plans/completed/T-1.*`, `T-2.*`, `T-3.*` — completed phase plans
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*/migration.sql`
- `apps/api/src/infrastructure/database/mongo-indexes.ts`
- `apps/api/src/infrastructure/queue/in-memory-queue.service.ts`
- `apps/api/src/application/llm/ai-orchestrator.service.ts`
- `apps/api/src/application/llm/colombia-time.ts`
- `AGENTS.md` §4 Planning Requirement, §5 Architecture
