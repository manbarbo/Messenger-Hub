# FIX-gemini-tool-result-role

**Status:** Completed  
**Created:** 2026-10-03  
**Completed:** 2026-10-03  
**Layer:** Backend (LLM adapter / Gemini OpenAI-compat)  
**Priority:** High (blocks multi-turn tool calling)

---

## Objective

After the first tool call (`buscar_conocimiento`), the second Gemini chat request fails with `400 status code (no body)`. Root cause: Gemini’s OpenAI-compatible endpoint **rejects** OpenAI-style follow-up messages with `role: "tool"` + `tool_call_id`.

## Evidence

Reproduced with OpenAI SDK against the same `LLM_BASE_URL`:

| Payload after tool call | HTTP |
|-------------------------|------|
| `assistant(tool_calls)` + `role:"tool"` | **400** no body |
| `assistant(tool_calls)` + tool result as `role:"user"` | **200** |
| tool result only as labeled `user` | **200** |

Worker logs match: iteration 0 OK + RAG similarity 0.765; iteration 1 (`messageCount: 4`) → 400.

## Acceptance Criteria

- [x] `GeminiLLMService.toOpenAIMessage` maps `role: 'tool'` → `role: 'user'` with the tool result content (labeled for clarity)
- [x] Assistant messages with `tool_calls` remain OpenAI-compatible
- [x] Unit tests cover tool-message mapping
- [x] `pnpm --filter api test` passes (412/412)
- [x] Plan → `plans/completed/`

## Result

Adapter maps tool results to labeled user messages. Domain still uses `role: 'tool'`. DECISIONS.md §LLM notes the Gemini OpenAI-compat limitation.

## Implementation Steps

1. Update `toOpenAIMessage` in `gemini-llm.service.ts` to convert tool results to user messages.
2. Keep domain `LLMMessage` roles unchanged (Clean Architecture — adapter-specific mapping only).
3. Extend `gemini-llm.service.spec.ts` for the multi-turn tool payload shape.
4. Run tests.

## File Structure

| File | Action |
|------|--------|
| `apps/api/src/infrastructure/llm/gemini-llm.service.ts` | Map tool → user in OpenAI payload |
| `apps/api/src/infrastructure/llm/gemini-llm.service.spec.ts` | Tests |
| `plans/inProgress/FIX-gemini-tool-result-role.md` | Plan |

## References

- Reproduction: OpenAI SDK curl variants (role:tool 400 vs user 200)
- `ai-orchestrator.service.ts` `appendToolExchange` (appends assistant tool_calls + tool result)
- AGENTS.md §10 Adapter Pattern — Gemini quirks stay in infrastructure
