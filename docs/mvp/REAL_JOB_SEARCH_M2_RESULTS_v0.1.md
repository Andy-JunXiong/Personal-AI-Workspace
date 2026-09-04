# Real Job Search MVP Slice M2 Results v0.1

**Milestone:** Task + Today

**Final decision:** COMPLETE

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
| ChatGPT platform M2-A — Daily Attention | SUPPORTED |
| ChatGPT platform M2-B — Task Mutation Integrity | SUPPORTED |
| ChatGPT platform M2-C — Determinism and cross-conversation read | SUPPORTED |
| Slice M2 overall | COMPLETE |

## Platform defect history and closure

The M2 platform run reported that Project
`feea9770-d834-4201-8ec1-b4e342e0a280` was returned as an ACTIVE/APPLIED
Project by the application path and then reported as not found by
`workspace_create_task`. That run was stopped immediately and was not reused
for the final platform decision.

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

The failed smoke database remains preserved as failed-run evidence and was not
used to claim the passing retest. The MCP tool schema and metadata did not
change. The canonical fresh-database rerun below closed the defect.

## Manual ChatGPT platform evidence

The canonical retest ran on 2026-09-04 through ChatGPT Work and the refreshed
Personal AI Workspace development connection. It used a fresh external SQLite
database named `m2-platform-retest-20260904-1551.db`, Workspace
`e30f6fd2-4c69-43c5-a887-93b2c9e328fb`, `PAW_TIME_ZONE=Australia/Sydney`, and
only controlled synthetic records. ChatGPT discovery showed all 12 Workspace
tools before the run.

The materialized time fixture was:

```text
TEST_DATE            = 2026-09-04
OVERDUE_AT           = 2026-09-03T17:00:00+10:00
DUE_TODAY_AT         = 2026-09-04T23:30:00+10:00
UPCOMING_PLUS_7_AT   = 2026-09-11T09:00:00+10:00
```

| Checkpoint | Observed result |
| --- | --- |
| M2-A — Daily Attention | SUPPORTED |
| M2-B — Task Mutation Integrity | SUPPORTED |
| M2-C — Determinism and cross-conversation read | SUPPORTED |
| Global negative-scope checks | SUPPORTED |

M2-A created `M2 Smoke Co — Platform Engineer`, four open attention Tasks,
one +7-day upcoming Task, and `M2 Gap Co — Data Analyst` without a Task.
`workspace_get_today` returned date `2026-09-04`, timezone
`Australia/Sydney`, and the exact attention order `M2 overdue` (`OVERDUE`),
`M2 due today` (`DUE_TODAY`), `Send M2 follow-up` (`HIGH_PRIORITY`), then
`M2 blocked` (`BLOCKED`). It returned `M2 upcoming seven` in `upcoming`, the
Gap application in `applicationsWithoutOpenTask`, and both admitted creation
transitions newest first in `recentLifecycleChanges`.

M2-B moved `Send M2 follow-up` from TODO to IN_PROGRESS with
`recordVersion` 1 -> 2. A one-time stale version-1 update returned
`CONCURRENCY_CONFLICT` and did not change priority. Completion moved the Task
to DONE with version 2 -> 3 and set
`completedAt=2026-09-04T06:40:20.597Z`; the subsequent Project read excluded
it from `openTasks`. A one-time DONE -> IN_PROGRESS attempt returned
`VALIDATION_ERROR` and created no replacement Task.

M2-C began in a separate ChatGPT conversation without reconstructed context.
The first durable Today read returned the remaining attention order
`OVERDUE`, `DUE_TODAY`, `BLOCKED`; the same upcoming Task, application gap,
and lifecycle ordering; and no completed follow-up Task. Two additional
read-only calls were identical field-for-field to the first.

Direct read-only inspection of the external database matched the platform
results: the follow-up Task was DONE at version 3 with the same `completedAt`;
the four remaining Tasks had the expected status, priority, and normalized UTC
timestamps; and the Gap application had no Task. Sanitized logs recorded MCP
initialization for `personal-ai-workspace` 0.1.0 and forwarded platform calls
throughout M2-A/B/C. An optional OAuth discovery warning and an unsupported
`server/discover` probe did not prevent standard MCP initialization, tool
discovery, or any checkpoint.

No Gmail or Calendar scan, model ranking, reminder, scheduler, background
processing, or M3 lifecycle behavior was invoked. No runtime credential,
private database, or raw external log is committed.

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

Slice M2 is complete and may be frozen at
`m2-task-today-verified-v0.1`. M3 may begin only as a separate implementation
change that preserves the frozen M1/M2 and Spike gates.

## Session closeout — 2026-09-04

- The fresh-database ChatGPT M2-A/B/C platform retest passed every required
  checkpoint and global negative-scope check.
- The original failed-run evidence remains preserved as historical defect
  evidence; it was not reused for the passing result.
- Independent database inspection matched the structured platform results.
- Final `npm run verify` passed with 11 test files and 74 tests, plus typecheck
  and production build; `git diff --check` also passed.
- Temporary runtime processes and repository-local scratch logs were removed,
  and the one-time platform Runtime API key was revoked. The external database
  and sanitized logs remain preserved as evidence.
- M3 was not started.

## Session closeout — 2026-09-02

- Final closeout re-verification completed at 23:47 AEST: 11 test files and 74
  tests passed, with typecheck, production build, and `git diff --check` also
  passing.
- Server-side invariant hardening and all requested regression coverage are
  complete locally.
- `npm run verify` passes: 11 test files, 74 tests, typecheck, and production
  build.
- The MCP schema and metadata are unchanged.
- The platform gate remains `FAILED / DEFECT FOUND`; no M2 continuation, M3
  implementation, or M2 tag was performed.
- Next session begins with deployment/connection refresh and the exact
  fresh-database defect retest before restarting M2-A.
