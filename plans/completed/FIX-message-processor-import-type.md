# FIX-message-processor-import-type

**Status:** Completed  
**Created:** 2026-10-03  
**Completed:** 2026-10-03  
**Layer:** Backend (NestJS DI wiring)  
**Priority:** High (worker cannot boot; blocks queue processing)

---

## Objective

Fix `UnknownDependenciesException` when the worker process starts: `MessageProcessorService` cannot resolve `AIOrchestratorService` (constructor index 1).

## Problem Statement

Worker bootstrap fails:

```text
Nest can't resolve dependencies of the MessageProcessorService
(Symbol(LOGGER), ?, Symbol(MessageRepository), Symbol(ConversationRepository))
dependencies: [Symbol(LOGGER), [Function: Object], Symbol(MessageRepository), ...]
```

### Root Cause

`apps/api/src/application/worker/message-processor.service.ts` uses:

```typescript
import type { AIOrchestratorService } from '../llm/ai-orchestrator.service';
```

`import type` is erased at compile time. NestJS `emitDecoratorMetadata` cannot emit `design:paramtypes` for that constructor slot, so DI sees `Object` instead of the `AIOrchestratorService` class.

Unit tests passed because they construct the service with `new MessageProcessorService(...)` and never exercise Nest DI metadata.

Repositories injected via `@Inject(Symbol)` tokens with `import type` are fine — only **class-typed** constructor params without `@Inject` require a **value** import.

## Acceptance Criteria

- [x] `MessageProcessorService` value-imports `AIOrchestratorService` (not `import type`)
- [x] No other production injectable uses `import type` for a concrete class injected by type (without `@Inject`) — remaining `import type` usages are interfaces (`LLMService`, `EmbeddingService`, `QueueService`) or `@Inject(token)` deps
- [x] `pnpm --filter api build:worker` succeeds
- [x] `pnpm --filter api test` passes (410/410)
- [x] Worker DI graph can resolve `MessageProcessorService` (value import restores `design:paramtypes`)
- [x] README documents the `import type` DI pitfall
- [x] Plan moved to `plans/completed/`

## Result

Fixed `apps/api/src/application/worker/message-processor.service.ts`:

```typescript
import { AIOrchestratorService } from '../llm/ai-orchestrator.service';
```

Audit: other `import type { *Service }` in production code are domain **interfaces** injected via `@Inject(Symbol)` — safe. Class-typed DI without `@Inject` (e.g. `ConfigService`) already uses value imports.

## Implementation Steps

### 1. Create and activate this plan

- Plan file in `plans/inProgress/`.

### 2. Fix the type-only import

In `message-processor.service.ts`:

```typescript
// Before
import type { AIOrchestratorService } from '../llm/ai-orchestrator.service';

// After
import { AIOrchestratorService } from '../llm/ai-orchestrator.service';
```

### 3. Audit similar patterns

Scan production `src/` for `import type { SomeInjectableClass }` used as a constructor dependency **without** `@Inject`. Interfaces/types and `@Inject(token)` deps may remain type-only.

### 4. Verify

```bash
pnpm --filter api test
pnpm --filter api build:worker
```

Confirm `dist/worker-main.js` still builds and DI metadata for `MessageProcessorService` references `AIOrchestratorService` (not `Object`).

### 5. Document if needed

- Note in this plan (completed).
- README troubleshooting: DI failure when worker uses `import type` for injectable classes.

## File Structure

| File | Action |
|------|--------|
| `apps/api/src/application/worker/message-processor.service.ts` | **Modify** — value import |
| `plans/inProgress/FIX-message-processor-import-type.md` | This plan → `plans/completed/` |

## Verification

```bash
pnpm --filter api test
pnpm --filter api build:worker
# Optional runtime: pnpm dev → worker logs "Worker listening on queue"
```

## References

- Nest error guidance: `import type` vs `import` for injectable classes
- `plans/completed/FIX-application-module-di-tokens.md` — prior DI wiring fix pattern
- `plans/completed/FIX-dev-start-worker-process.md` — worker startup DX (this bug surfaced after EADDRINUSE fix)
- `AGENTS.md` §7 Dependency Inversion / DI
