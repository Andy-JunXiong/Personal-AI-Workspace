# Real Job Search MVP Slice M2 Results v0.1

**Milestone:** Task + Today

**Decision:** BLOCKED; M2 CREATE-TASK PLATFORM GATE FAILED / DEFECT FOUND

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
| ChatGPT platform smoke | FAILED / DEFECT FOUND |

## Blocking platform defect investigation

The M2 platform run reported that Project
`feea9770-d834-4201-8ec1-b4e342e0a280` was returned as an ACTIVE/APPLIED
Project by the application path and then reported as not found by
`workspace_create_task`. M2-A, M2-B, M2-C, M3, tagging, and platform
completion remain blocked.

The historical raw MCP payload was not logged and cannot be recovered from
the repository or current database. The best-recoverable request is therefore
explicitly classified as reconstructed evidence:

```json
{
  "projectId": "feea9770-d834-4201-8ec1-b4e342e0a280",
  "title": "Send M2 follow-up",
  "taskKind": "FOLLOW_UP",
  "priority": "HIGH",
  "dueAt": "unknown: omitted or null",
  "userConfirmed": true,
  "authorityReference": "unknown",
  "idempotencyKey": "unknown"
}
```

Repository inspection found that the MCP handler forwarded `input.projectId`
unchanged to `TaskService`; `WorkspaceService` and `TaskService` received the
same `better-sqlite3` database object and resolved the same development
principal and Workspace. The Task lookup did not filter by Project type,
Project status, lifecycle state, or UUID representation. No second database
connection existed at the M2 module boundary.

The recoverable running smoke environment pointed the tunnel at
`http://127.0.0.1:3000/mcp`, and the server reported Workspace
`6ef570b0-3c66-439f-bdfe-e2c8a2520014`. Its configured
`%LOCALAPPDATA%\PersonalAIWorkspace\data\m2-platform-smoke.db` contained only
the frozen Spike fixture: it contained neither the reported Project, a manual
Task, nor M1/M2 idempotency records. A direct read through
`workspace_get_project` also returned `NOT_FOUND` for the reported ID. This
proves a runtime/database continuity discrepancy in the evidence available
after the failure, but it does not prove which historical MCP payload or
runtime instance produced the earlier success response.

The server-side hardening removes TaskService's duplicate Project query.
TaskService now delegates Project visibility to the exact authorized Project
resolver used by `workspace_get_project`. Thus the invariant is structural:
if that resolver can read a Project for the current Workspace, TaskService
uses the same resolver before creating a Task. Workspace isolation and
authorization remain unchanged.

Regression coverage now uses the real M1 Job Application creation path,
passes the generated ID directly to TaskService, checks ACTIVE/APPLIED
visibility, checks exact idempotent replay, closes and reopens the same
file-backed database, and verifies that both Project and Task remain visible.
The MCP transport test now invokes the published `workspace_create_task`
schema against the Project ID returned by
`workspace_create_job_application`, with an undated HIGH `FOLLOW_UP`, and
checks replay and Project readback. Existing cross-Workspace, nonexistent
Project, fixture, M1, and Spike regressions remain in the full suite.

The failed smoke database must be preserved as failed-run evidence and must
not be used to claim a passing retest. Use a fresh external database for the
next controlled platform run. The MCP tool schema and metadata did not
change.

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
Tests       74 passed (74)
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

After the defect fix is deployed and the ChatGPT development connection is
refreshed, restart the controlled M2 smoke from M2-A step 1 against a fresh
external database. Do not continue the failed run, tag/freeze M2, or start M3
until all platform observations are supported and recorded.

## Session closeout — 2026-09-02

- Server-side invariant hardening and all requested regression coverage are
  complete locally.
- `npm run verify` passes: 11 test files, 74 tests, typecheck, and production
  build.
- The MCP schema and metadata are unchanged.
- The platform gate remains `FAILED / DEFECT FOUND`; no M2 continuation, M3
  implementation, or M2 tag was performed.
- Next session begins with deployment/connection refresh and the exact
  fresh-database defect retest before restarting M2-A.
