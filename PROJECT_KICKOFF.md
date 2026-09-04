# Project Kickoff — Personal AI Workspace v0.1

## Status

**CHATGPT-NATIVE SPIKE 1A = COMPLETE**

**SPIKE 1B = COMPLETE — FUNCTIONAL AND PRIVACY GATES SUPPORTED**

**REAL JOB SEARCH MVP SLICE M1 = COMPLETE — CHATGPT PLATFORM SUPPORTED**

**REAL JOB SEARCH MVP SLICE M2 = COMPLETE — CHATGPT PLATFORM SUPPORTED**

**REAL JOB SEARCH MVP SLICE M3 = COMPLETE — CHATGPT PLATFORM SUPPORTED**

**M4 REAL-DATA DOGFOOD = DAY-0 PASSED — DAY 1 AWAITS FIRST AUTHORIZED REAL WRITE**

## Thesis

> Build a persistent work-state layer for ChatGPT that turns conversations and external events into long-running goals, projects, tasks, actions, and outcomes.

## Architecture Position

```text
ChatGPT = Interface + General Reasoning + Orchestration
Workspace = Persistent Work State + Coordination
Connected Services = Source Facts + Capabilities
MCP / Apps SDK = Bridge
```

## Current Architecture Decision

**MVP is ChatGPT-native and continuity-first.**

The Workspace will not initially rebuild Gmail/Drive/Calendar connectors. The first proof uses ChatGPT's available connected-app surface plus the custom Workspace app where supported.

## Phase Gates

- [x] Project thesis
- [x] Problem / non-goals
- [x] System boundary
- [x] Architecture Review v0.1
- [x] Logical Architecture v0.1
- [x] State/Event Flow v0.1
- [x] State Model v0.1 proposed
- [x] State Model review
- [x] ChatGPT Integration Spike — local and manual ChatGPT-native Spike 1A verified
- [x] Spike 1B architecture review and smallest-scope design
- [x] Spike 1B implementation
- [x] Spike 1B functional ChatGPT cross-app E2E
- [x] Spike 1B fresh-DB privacy/data-minimization rerun
- [x] Spike 1B final verification
- [x] Real Job Search MVP implementation plan approved with M1/M2/M3 gates
- [x] MVP build — Slice M1 Real Application Inventory verified locally and through ChatGPT
- [x] M1 duplicate-protection defect remediated and fresh-DB platform retest supported
- [x] MVP build — Slice M2 Task + Today implemented and verified locally
- [x] M2 create-Task visibility invariant hardened with regression coverage
- [x] M2 fresh-DB ChatGPT platform retest
- [x] MVP build — Slice M3 Real Lifecycle implemented and verified locally
- [x] M3 fresh-DB ChatGPT platform retest
- [x] E2E evidence
- [x] M4 real-data Dogfood Day-0 gate
- [ ] M4 seven-day real-data trial

## Immediate Next Step

**Spike 1B and Real Job Search MVP Slices M1/M2/M3 remain frozen at their
verified milestone tags. M4 Day 0 passed against the empty external real
Workspace. Keep it closed and unseeded until the user explicitly authorizes
the first real Job Application write, which starts Day 1.**

## Session Closeout — 2026-09-04 (M4 Day-0 initialization)

- The approved seven-day M4 operating scope, privacy rules, success gate, and
  stop conditions are recorded in `docs/dogfood/M4_DOGFOOD_PLAN_v0.1.md`.
- The production-like database was created at the Local App Data boundary,
  outside both the repository and OneDrive. No previous database existed and
  the synthetic seed command was not run.
- All three committed migrations applied. One development Principal and one
  Workspace were initialized; Projects, Resources, transitions, Tasks, and
  idempotency records all remained empty.
- HTTP health, MCP discovery, and `workspace_ping` passed against the frozen
  12-tool surface. The Workspace ID is
  `d3c0a312-9c12-4b73-a598-eebf1b1de974`.
- The initialization server was stopped, port 3000 closed, SQLite integrity
  returned `ok`, the WAL was checkpointed, and the external stderr log was
  empty.
- Day 1 has not started and no real job-search content has been written.

## Session Closeout — 2026-09-04 (M3 platform verification)

- The canonical fresh-external-database M3-A/B/C run passed through the
  refreshed 12-tool ChatGPT development connection.
- M3-A verified non-mutating proposals and exactly one approved HIGH derived
  Task for recruiter contact, interview, and offer admissions.
- M3-B verified terminal ACCEPTED closure, atomic cancellation of all four
  open Tasks, idempotent replay, closed-list behavior, and rejection of a
  terminal outgoing edge.
- M3-C verified REJECTED and WITHDRAWN closure plus durable no-write readback
  of all three terminal Projects from a separate ChatGPT conversation.
- Direct read-only SQLite inspection matched ChatGPT: ACCEPTED v5, REJECTED
  v2, and WITHDRAWN v2 were CLOSED with zero open Tasks. Sanitized server and
  tunnel stderr logs were empty.
- The active-only exact lookup returned `NOT_FOUND` for terminal Projects as
  frozen by M1; the independent readback resolved them through the
  closed-inclusive list, with no contract change.
- Full verification remained at 12 test files and 129 tests, plus typecheck,
  production build, and `git diff --check`.
- The one-time Runtime API key was revoked and temporary runtime processes
  were stopped. The external database and sanitized logs remain preserved as
  evidence.

## Session Closeout — 2026-09-04 (M3 local implementation)

- The exact approved seven-state, 13-edge lifecycle is implemented; all 36
  rejected state pairs remain non-mutating proposals.
- Admissions derive the approved HIGH Tasks for recruiter contact, interview,
  and offer states. `REVIEW_OFFER` remains source-owned and cannot be created
  through the frozen M2 manual Task surface.
- Terminal admission atomically closes the Project and cancels obsolete open
  Tasks with SYSTEM audit attribution while preserving terminal Tasks.
- No migration or MCP tool was added; the existing proposal schema now exposes
  the full approved destinations.
- Automated, transport, rollback, concurrency, and retry coverage passes
  locally. The fresh-database ChatGPT M3-A/B/C platform gate remains pending.

## Session Closeout — 2026-09-04 (M2 platform verification)

- A fresh external SQLite database and the refreshed 12-tool ChatGPT
  development connection were used for the canonical retest.
- M2-A passed deterministic Today classification and ordering for overdue,
  due-today, high-priority, blocked, upcoming, application-gap, and recent
  lifecycle-change fixtures.
- M2-B passed optimistic concurrency, completion, `completedAt`, open-Task
  filtering, and terminal-state rejection checks.
- M2-C passed durable separate-conversation readback and three-call
  deterministic equality with no writes.
- Direct read-only database inspection matched the ChatGPT results. The
  original failed-run evidence remains preserved as defect history.
- `npm run verify` passed before the platform run and again after the evidence
  update with 11 test files and 74 tests, plus typecheck and production build;
  `git diff --check` also passed.
- The temporary server and tunnels were stopped, repository-local scratch logs
  were removed, and the one-time platform Runtime API key was revoked. The
  external test database and sanitized logs remain preserved as evidence.
- M3 was not started in this session.

## Session Closeout — 2026-09-02 (M2 defect remediation)

- Closeout verification was refreshed at 23:47 AEST against commit `f55e493`;
  the repository remained clean and aligned with `origin/main` before this
  documentation-only closeout update.
- The M2 platform run stopped at the first manual Task creation after reporting
  a durable ACTIVE/APPLIED Job Application.
- The historical raw MCP payload was unavailable. Recoverable evidence showed
  a runtime/database continuity discrepancy, so reconstructed fields are
  explicitly labeled rather than presented as raw evidence.
- TaskService now uses WorkspaceService's canonical authorized Project resolver;
  the dedicated TaskService boundary and Workspace isolation remain intact.
- The real M1 creation -> Task creation -> persisted reopen path and the
  published MCP transport path are covered by regressions.
- `npm run verify` passes with 11 test files and 74 tests; production build and
  `git diff --check` also pass.
- The M2 platform gate remains failed. Preserve the failed-run evidence and use
  a fresh external database for the next manual retest. M3 and M2 tagging remain
  blocked.
