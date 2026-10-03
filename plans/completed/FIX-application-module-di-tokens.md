# FIX — ApplicationModule DI: resolve InfrastructureModule tokens

**Phase:** Bug Fix
**Layer:** Backend (NestJS DI wiring)
**Status:** Completed
**Completion Date:** 2026-10-02
**Estimated Effort:** 30–45 minutes
**Dependencies:** None (fixes regression after T-2.3 + T-3.2 AppModule wiring)

---

## Objective

Fix `UnknownDependenciesException` at API bootstrap: `CreateAppointmentHandler` cannot resolve `Symbol(SlotRepository)` (and other repository/service tokens) inside `ApplicationModule`.

---

## Root Cause

1. `CreateAppointmentHandler` is registered in `ApplicationModule`, which only imports `CqrsModule`.
2. The handler injects `SLOT_REPOSITORY`, `APPOINTMENT_REPOSITORY`, `EVENT_PUBLISHER` via `@Inject(Symbol)`.
3. Those tokens are provided and exported by `InfrastructureModule`, but `InfrastructureModule` was **not** `@Global()` and is **not** imported by `ApplicationModule`.
4. NestJS DI rules: a module can only resolve tokens from (a) its own providers, (b) modules it imports that export the token, or (c) global modules.
5. Unit tests passed because `application.module.spec.ts` uses a `@Global()` `MockApplicationDepsModule` that provides all tokens — masking the production wiring gap.

Affected handlers (same class of failure):

| Handler | Missing tokens (when InfrastructureModule is not visible) |
|---------|-----------------------------------------------------------|
| `CreateAppointmentHandler` | `SLOT_REPOSITORY`, `APPOINTMENT_REPOSITORY`, `EVENT_PUBLISHER` |
| `CancelAppointmentHandler` | `SLOT_REPOSITORY`, `APPOINTMENT_REPOSITORY`, `EVENT_PUBLISHER` |
| `ProcessIncomingMessageHandler` | `CONVERSATION_REPOSITORY`, `MESSAGE_REPOSITORY`, `QUEUE_SERVICE` |
| `ListConversationsHandler` | `CONVERSATION_REPOSITORY`, `CLINIC_REPOSITORY` |
| `GetConversationDetailHandler` | `CONVERSATION_REPOSITORY`, `MESSAGE_REPOSITORY`, `AI_TRACE_REPOSITORY`, `CLINIC_REPOSITORY` |

---

## Decision

**Mark `InfrastructureModule` as `@Global()`.**

Rationale (consistent with existing project pattern):

- `DatabaseModule` is already `@Global()` (exports `PrismaService`, `MongoService`).
- `EmbeddingModule` is already `@Global()` (exports `EMBEDDING_SERVICE`).
- T-3.2 explicitly documented this pattern: *"`EmbeddingModule` is `@Global` so `InfrastructureModule` can resolve `EMBEDDING_SERVICE` without a direct import edge (same pattern as `DatabaseModule` → `PrismaService`)"*.
- `AppModule` already imports `InfrastructureModule`; once global, its exports are visible to `ApplicationModule` without an Application → Infrastructure import edge.
- Application handlers still depend only on domain tokens/interfaces — no Clean Architecture boundary is broken. `@Global` is DI wiring, not a code dependency.

**Rejected alternative:** `ApplicationModule` imports `InfrastructureModule`.

- More explicit NestJS wiring, but couples layers at the module-graph level.
- Breaks the established pattern used for `DatabaseModule` / `EmbeddingModule`.
- Risks loading real Prisma/Mongo adapters inside `ApplicationModule` unit tests.

**Note for T-3.4:** `LlmModule` is not global. If `AIOrchestratorService` (application layer) injects `LLM_SERVICE`, apply the same `@Global` treatment or import `LlmModule` from the module that registers the orchestrator.

---

## Acceptance Criteria

- [x] `InfrastructureModule` is decorated with `@Global()`.
- [x] `ApplicationModule` still imports only `CqrsModule` (no Application → Infrastructure import edge).
- [x] Regression test: `ApplicationModule` command/query handlers resolve when `InfrastructureModule` + mocked DB/embedding/event deps are in the module graph.
- [x] Regression test asserts `InfrastructureModule` metadata marks it global (`__module:global__`).
- [x] `pnpm --filter api test` passes (156/156).
- [x] `pnpm --filter api exec tsc --noEmit` passes.
- [x] `pnpm --filter api lint` passes.
- [x] DECISIONS.md records the `@Global` InfrastructureModule decision (ADR #21).
- [x] Plan moved to `plans/completed/` with completion date.

---

## Implementation Steps

### 1. Create and activate this plan

- Write plan to `plans/backlog/FIX-application-module-di-tokens.md`.
- Move to `plans/inProgress/` before code changes.

### 2. Mark InfrastructureModule as global

File: `apps/api/src/infrastructure/infrastructure.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
// ... existing imports ...

@Global()
@Module({
  providers: [ /* unchanged */ ],
  exports: [ /* unchanged */ ],
})
export class InfrastructureModule {}
```

Providers/exports lists unchanged.

### 3. Add regression tests

File: `apps/api/src/infrastructure/infrastructure.module.spec.ts`

- Import `ApplicationModule` and command/query handlers.
- Assert `Reflect.getMetadata('__module:global__', InfrastructureModule)` is `true` (NestJS 11 `GLOBAL_MODULE_METADATA` key).
- Compile `MockInfrastructureDepsModule + InfrastructureModule + ApplicationModule` and assert `CreateAppointmentHandler`, `CancelAppointmentHandler`, `ListConversationsHandler`, `GetConversationDetailHandler` instantiate — production wiring scenario that previously failed.

### 4. Update documentation

- `DECISIONS.md`: ADR #21 `Global InfrastructureModule for Cross-Layer DI Tokens` (sections 22–24 renumbered).

### 5. Verify

```bash
pnpm --filter api test
# 31 files, 156 tests passed — includes new @Global + ApplicationModule resolution tests

pnpm --filter api exec tsc --noEmit
# Typecheck clean

pnpm --filter api lint
# Lint clean
```

### 6. Close out

- Move plan to `plans/completed/FIX-application-module-di-tokens.md`.
- Mark all acceptance criteria checked.

---

## File Structure

| File | Action |
|------|--------|
| `plans/backlog/FIX-application-module-di-tokens.md` | Create (this plan) |
| `plans/inProgress/FIX-application-module-di-tokens.md` | Active during work |
| `apps/api/src/infrastructure/infrastructure.module.ts` | Modify — add `@Global()` |
| `apps/api/src/infrastructure/infrastructure.module.spec.ts` | Modify — regression tests |
| `DECISIONS.md` | Modify — ADR #21 + renumber 22–24 |
| `plans/completed/FIX-application-module-di-tokens.md` | Final location |

---

## Verification

```bash
pnpm --filter api test
# All tests pass, including new InfrastructureModule @Global + ApplicationModule resolution tests

pnpm --filter api exec tsc --noEmit
# Typecheck clean

pnpm --filter api lint
# Lint clean

pnpm dev:api
# API boots without UnknownDependenciesException for SlotRepository / AppointmentRepository / EventPublisher
```

**Result (2026-10-02):** 156 tests passed (31 files), typecheck clean, lint clean. New regression tests in `infrastructure.module.spec.ts` cover `@Global` metadata and ApplicationModule handler DI resolution.

---

## References

- AGENTS.md §5 (Architecture), §10 (Adapter Pattern), §22 (Architectural Decision Rule)
- AGENTS.md §4 (Planning Requirement)
- `plans/completed/T-3.2-rag-pipeline.md` — `@Global` EmbeddingModule pattern
- `plans/completed/T-1.3-database-setup.md` — `@Global` DatabaseModule pattern
- `plans/completed/T-2.3-cqrs-commands.md` — ApplicationModule registers CQRS handlers
- `apps/api/src/application/application.module.ts`
- `apps/api/src/infrastructure/infrastructure.module.ts`
- `apps/api/src/app.module.ts`
- DECISIONS.md #21 — Global InfrastructureModule for Cross-Layer DI Tokens
