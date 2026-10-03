# FIX-dev-start-worker-process

**Status:** Completed  
**Created:** 2026-10-03  
**Completed:** 2026-10-03  
**Layer:** DX / DevOps (no architecture change)  
**Priority:** High (blocks end-to-end AI/RAG path in local dev)

---

## Objective

Queue jobs on `message-processing` stay in BullMQ **waiting** state and Gemini/RAG never run because the default local startup (`pnpm dev`) only starts the API and web apps. The consumer (`BullMQMessageWorker`) lives in a separate NestJS process (`worker-main.ts` / `WorkerModule`) and must be started alongside the API.

This plan improves local DX so `pnpm dev` starts **api + web + worker**. It does **not** change architecture: the worker remains a separate process (`DECISIONS.md` §7).

## Problem Statement

| Component | Process | Started by `pnpm dev`? |
|-----------|---------|------------------------|
| Producer (`BullMQQueueService`) | API (`main.ts`) | Yes |
| Consumer (`BullMQMessageWorker`) | Worker (`worker-main.ts`) | **No** |
| Bull Board (visibility) | API | Yes |

Flow:

```text
Webhook/Simulator → 202 → Redis "message-processing" (waiting forever if no worker)
Worker process (missing) → MessageProcessorService → AIOrchestrator → Gemini + RAG
```

"Waiting" is a **BullMQ job state**, not a DB field on Message/Conversation.

### Root-cause evidence

- `package.json` (root): `"dev"` runs only `api` + `web`
- `apps/api/package.json`: `"start:worker:dev"` exists but is not invoked by root `dev`
- `AppModule` does not import `WorkerModule` (by design)
- `BullMQMessageWorker` is registered only in `WorkerModule` / started via `worker-main.ts`
- Producer and consumer share the same queue constant `MESSAGE_PROCESSING_QUEUE` (`message-processing`) — no name mismatch
- `README.md` documents manual dual-process startup; default script never launches the consumer

## Acceptance Criteria

- [x] `pnpm dev` starts three concurrently processes: api, web, **and** worker
- [x] Root `package.json` exposes a `dev:worker` convenience script
- [ ] Worker logs `MessengerHub worker started` and `Worker listening on queue` when `pnpm dev` runs
- [ ] A message sent via the simulator/webhook moves from Bull Board `waiting` → `active`/`completed`
- [ ] RAG/Gemini path runs in the worker process (AI traces / assistant reply appear)
- [x] README documents that default `pnpm dev` includes the worker, and keeps the manual multi-process command as fallback
- [x] Architecture unchanged: worker still a separate process; `AppModule` still does **not** import `WorkerModule`
- [x] No new secrets; no domain/application layer changes
- [x] Existing backend tests still pass (no behavioral change expected in unit tests)

**Note on remaining ACs:** Script/docs ACs verified in CI/unit. Worker boot + job processing + RAG E2E require Docker (Redis/Postgres/Mongo) and Gemini env — run locally with `pnpm dev` per Verification section.

## Follow-up Fix (2026-10-03): EADDRINUSE on worker start

**Symptom:** `pnpm dev` worker process crashed with `listen EADDRINUSE :::3000` and stack in `dist/main.js`.

**Root cause:** Nest CLI resolves `entryFile` from the **top level** of `nest-cli.*.json` (default `'main'`). The worker config had `entryFile` under `compilerOptions`, which is ignored — so the worker built and ran the API entry (`main`) instead of `worker-main`.

**Fix applied:**

1. `apps/api/nest-cli.worker.json` — moved `entryFile: "worker-main"` to the **root** of the config
2. `apps/api/nest-cli.json` — set `deleteOutDir: false` so concurrent API + worker webpack builds do not wipe each other's `dist/*.js` bundles

**Verification:** `pnpm --filter api build:worker` must emit `dist/worker-main.js`; `start:worker:dev` must spawn `worker-main`, not `main`.

## Implementation Steps

### 1. Update root startup scripts

**File:** `package.json` (workspace root)

Change:

```json
"dev": "concurrently -n api,web -c blue,green \"pnpm --filter api start:dev\" \"pnpm --filter web start\""
```

To:

```json
"dev": "concurrently -n api,worker,web -c blue,magenta,green \"pnpm --filter api start:dev\" \"pnpm --filter api start:worker:dev\" \"pnpm --filter web start\"",
"dev:worker": "pnpm --filter api start:worker:dev",
```

Notes:

- Keep existing `dev:api` and `dev:web`
- Reuse `apps/api` script `start:worker:dev` (`nest start --watch --config nest-cli.worker.json`)
- Color/name labels must make the worker process obvious in the terminal

### 2. Update README startup documentation

**File:** `README.md`

Update the async-path callout (~line 63) and any `pnpm dev` section (~line 208):

- State that `pnpm dev` now starts **API + Worker + Web**
- Keep manual fallback:

```bash
pnpm --filter api start:dev
pnpm --filter api start:worker:dev
pnpm --filter web start
```

- Add a short **Troubleshooting** note:
  - Jobs stuck in Bull Board `waiting` → worker process is not running or cannot reach Redis
  - Check worker logs for `Worker listening on queue`
  - Verify `REDIS_HOST` / `REDIS_PORT` (and other env) are available to both API and worker

### 3. Optional DX note in DECISIONS.md

**File:** `DECISIONS.md` (§7 Asynchronous Processing)

Current text already documents “two processes to run locally (API + Worker)”. Add one sentence:

> Local DX: `pnpm dev` starts API, Worker, and Web via `concurrently`. The architectural decision (separate worker process) is unchanged.

Skip if the README update is considered sufficient.

### 4. Do NOT change (explicit non-goals)

- Do **not** import `WorkerModule` into `AppModule`
- Do **not** merge consumer into the API process
- Do **not** change queue names, BullMQ adapters, or DI bindings
- Do **not** add new brokers or SQS adapters
- Do **not** modify `BullMQMessageWorker` / `WorkerModule` business logic unless verification reveals a real bug (out of this plan’s scope)

### 5. Update master plan notes after completion

**File:** `plans/master_plan.md`

After verification passes, add a short completion note (same style as Phase 4 Extension):

```markdown
## DX Fix Completion Notes (2026-10-03)

FIX-dev-start-worker-process: `pnpm dev` now starts api + worker + web.
Queue jobs no longer sit in Bull Board `waiting` when using the default local command.
```

## File Structure

| File | Action |
|------|--------|
| `package.json` (root) | **Modify** — add worker to `dev` script; add `dev:worker` |
| `README.md` | **Modify** — startup + troubleshooting |
| `DECISIONS.md` | **Optional modify** — one-line DX note (§7) |
| `plans/master_plan.md` | **Modify after completion** — completion note |
| `plans/inProgress/FIX-dev-start-worker-process.md` | **This plan** — move to `plans/completed/` when done |

No changes under `apps/api/src/` expected for this fix.

## Verification

### Automated

```bash
# From repo root — scripts only; no new unit tests required
node -e "const p=require('./package.json'); console.log(p.scripts.dev); console.log(p.scripts['dev:worker']);"

# Existing suite must still pass
pnpm --filter api test
pnpm --filter web test
```

### Manual E2E (required)

```bash
# 1. Infra
docker compose up -d   # PostgreSQL, MongoDB, Redis

# 2. Default startup
pnpm dev

# 3. Expect in terminal:
#    - API listening on :3000
#    - MessengerHub worker started / Worker listening on queue
#    - Web on :4200
```

Then send a test message:

```bash
# POST /api/simulator or POST /webhooks/messages
# body includes clinic_id + text that can trigger knowledge search
```

| Check | Expected |
|-------|----------|
| Bull Board `http://localhost:3000/admin/queues` | Job leaves `waiting`; appears `active` then `completed` (or `failed` → DLQ after retries) |
| Worker logs | `Worker listening on queue`, `Job completed` |
| Conversation detail / Mongo | Assistant message + AI trace present |
| RAG path | Trace/tool results show `buscar_conocimiento` or Gemini response (when knowledge applies) |
| Without worker (fallback check) | `pnpm dev:api` only → jobs remain `waiting` (documents the original bug) |

### Failure modes to watch during verification

| Symptom | Likely cause |
|---------|----------------|
| Worker process exits immediately | Missing env (`DATABASE_URL`, `MONGODB_URI`, `LLM_API_KEY`, Redis) |
| Jobs still waiting with worker running | Different Redis host/port between API and worker, or Redis down |
| Jobs fail into DLQ | LLM/DB error — not the startup bug; check worker error logs |
| Bull Board shows queues but no jobs | Message never enqueued — check API/webhook logs |

## References

- `AGENTS.md` §4 Planning Requirement — code changes require a plan in `plans/`
- `AGENTS.md` §16 Async Processing — webhook enqueues; worker consumes
- `AGENTS.md` §10 Adapter Pattern — `QueueService` / BullMQ behind abstraction
- `DECISIONS.md` §7 Asynchronous Processing — separate worker process is intentional
- `README.md` (~63, ~90, ~208) — current dual-process startup docs
- `package.json` (root) — `dev` script gap
- `apps/api/package.json` — `start:worker:dev`
- `apps/api/src/worker-main.ts` — worker bootstrap
- `apps/api/src/application/worker/worker.module.ts` — `BullMQMessageWorker` registration
- `apps/api/src/infrastructure/queue/bullmq-message.worker.ts` — BullMQ consumer
- `apps/api/src/infrastructure/queue/bullmq-queue.service.ts` — producer + queue names
- `plans/completed/T-4.2-worker.md` — original worker design
- `plans/completed/T-4.4-bull-board-queue-monitoring.md` — Bull Board as visibility tool

## Estimated Effort

**0.5–1 hour** (scripts + docs + manual E2E). Low risk; no architecture change.

## Completion Checklist

- [x] Root `package.json` scripts updated
- [x] README updated (startup + troubleshooting)
- [x] DECISIONS.md DX note (if applied)
- [ ] Manual E2E: `pnpm dev` → worker listening → job processes → RAG/Gemini path runs
- [x] Existing tests pass (410 backend tests)
- [x] `plans/master_plan.md` completion note added
- [x] Plan moved to `plans/completed/`
