# Real Job Search MVP Slice M2 Results v0.1

**Milestone:** Task + Today

**Decision:** LOCAL IMPLEMENTATION COMPLETE; CHATGPT PLATFORM VERIFICATION PENDING

## Result summary

M2 proves the local Workspace boundary for durable manual Task state and a
deterministic daily attention view. It adds no Job Application lifecycle state
or edge and does not begin M3.

| Gate | Result |
| --- | --- |
| Frozen pre-code decisions | COMPLETE |
| Migration 003 | PASS |
| Task command tests | PASS |
| Today query tests | PASS |
| Frozen Spike 1A/1B and M1 regression suite | PASS |
| Local MCP transport/discovery | PASS |
| ChatGPT platform smoke | PENDING |

## Architecture decisions

- `TaskService` owns manual Task create/update behavior.
- `TodayQueryService` owns the read-only derived view, timezone date
  classification, and deterministic ordering.
- `DONE` and `CANCELLED` are terminal; resumed work creates a new Task.
- `DONE` sets `completedAt`; `CANCELLED` leaves it null.
- Task mutations are explicit-user-authorized, single-record, Workspace-scoped,
  versioned, and idempotent.
- Manual Task kinds are constrained. No fuzzy/title deduplication is added; an
  open transition-derived Task of the same kind remains source-owned.
- Today uses `PAW_TIME_ZONE`, defaulting to `Australia/Sydney`, and an injected
  clock. It is not persisted and performs no external-source read or write.
- One attention Task carries every applicable ordered reason, avoiding
  duplicate rows.

## Migration

`003_task_attention.sql` adds exactly:

```text
tasks.record_version INTEGER NOT NULL DEFAULT 1
tasks.updated_by TEXT NOT NULL DEFAULT 'SYSTEM'
tasks.completed_at TEXT NULL
```

Existing `due_at`, `created_by`, and transition-source uniqueness are reused.
An upgrade test proves a pre-M2 Task retains `created_by = SYSTEM` and receives
the expected defaults.

## MCP surface

Before M2: 9 tools. After M2: 12 tools.

Added:

- `workspace_create_task`
- `workspace_update_task`
- `workspace_get_today`

## Automated evidence

Final local verification:

```text
npm run verify
Test Files  11 passed (11)
Tests       73 passed (73)
TypeScript typecheck: passed
Production build: passed
git diff --check: passed
```

Focused coverage includes all requested create/update transitions and terminal
rejections, authority, Project/Workspace isolation, invalid Projects,
idempotent replay, version increments and stale-version rejection,
`completedAt`, every Today classification, Sydney boundary behavior, inclusive
seven-day upcoming behavior, gap signals, recent admitted changes,
deterministic ordering, injected clock behavior, and read-only behavior.

## Architecture drift review

No M2 architecture drift was found. The implementation retains the verified
external database boundary, leaves frozen Spike result/evaluation evidence
unchanged, adds no model ranking or external connector, and does not expand the
M3 lifecycle. The Task kind spelling `PREPARE_FOR_INTERVIEW` deliberately
matches the already-approved MVP vocabulary but has no M3-derived behavior in
this slice.

## Readiness recommendation

Proceed to the controlled ChatGPT M2 smoke in `tests/evaluations/chatgpt-m2.md`
against a fresh external database. Do not tag/freeze M2 and do not start M3
until all platform observations are supported and recorded.
