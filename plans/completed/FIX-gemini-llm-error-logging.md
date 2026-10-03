# FIX-gemini-llm-error-logging

**Status:** Completed  
**Created:** 2026-10-03  
**Completed:** 2026-10-03  
**Layer:** Backend (infrastructure / LLM adapter)  
**Priority:** Medium (observability for provider failures)

---

## Objective

When Gemini/OpenAI-compatible calls fail, logs must include enough context to distinguish **400 / 404 / 429 / 503** at a glance: HTTP `status`, provider `errorBody`, and `baseURL` **host only** — never the API key.

## Problem

Current failure log is only:

```text
LLM request failed {"model":"gemini-3.8-flash","error":"400 status code (no body)"}
```

Operators cannot tell a bad payload (400) from rate limit (429) or overload (503) without extra curl tests.

## Acceptance Criteria

- [x] `GeminiLLMService` catch path logs `status` (when present on the error)
- [x] Logs `errorBody` when the provider returns an error object (OpenAI SDK `error.error` or similar)
- [x] Logs `baseURLHost` derived safely from `LLM_BASE_URL` (host only; no key, no path secrets)
- [x] API key is never logged
- [x] Unit tests assert new log metadata on failure
- [x] `pnpm --filter api test` passes (412/412)
- [x] Plan → `plans/completed/`

## Result

`LLM request failed` now includes `status`, `code`, `errorBody`, and `baseURLHost` (e.g. `generativelanguage.googleapis.com`). Helper `toSafeBaseURLHost` exported for tests.

## Implementation Steps

1. Add a small helper `toSafeBaseURLHost(baseURL?: string): string | undefined` using `URL` → `.host`.
2. In `chat()` catch block, extract `status` and `errorBody` from the thrown error without logging the full client config.
3. Include `status`, `errorBody`, `baseURLHost` in the existing `logger.error('LLM request failed', ...)`.
4. Extend `gemini-llm.service.spec.ts` failure tests for the new fields.
5. Run tests.

## File Structure

| File | Action |
|------|--------|
| `apps/api/src/infrastructure/llm/gemini-llm.service.ts` | Modify logging + helper |
| `apps/api/src/infrastructure/llm/gemini-llm.service.spec.ts` | Assert new fields |
| `plans/inProgress/FIX-gemini-llm-error-logging.md` | This plan |

## Verification

```bash
pnpm --filter api test -- src/infrastructure/llm/gemini-llm.service.spec.ts
pnpm --filter api test
```

## References

- `AGENTS.md` §18 structured logging
- `AGENTS.md` §20 error handling
- Prior diagnosis: Gemini 404/400/503 during worker E2E
