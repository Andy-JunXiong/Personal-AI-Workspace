# S2-01 Candidate Storage and Decisions — Results v0.1

**Date:** 2026-09-06 (Australia/Sydney).

**Status:** Local implementation complete. Typecheck, production build and the
full repository test gate pass (24 files / 208 tests). No cloud deployment,
browser view or real-data mutation is included.

## Continuity and benefits

### Upstream requirement

The
[Job Search Secondary Interface requirements](JOB_SEARCH_SECONDARY_INTERFACE_REQUIREMENTS_v0.1.md)
R09/R10 and the
[P0 technical plan](JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md) P3 package require
candidate continuity: durable save/dismiss/restore decisions, stable posting
identity and provenance, and actor-attributed audit. S1 delivered application
and Task continuity but no recommendation/candidate records, so a candidate
decision could not survive a conversation.

### Current package

This package delivers the candidate data layer and manual decisions as the first
S2 increment, MCP-first. It adds a `job_candidates` table (separating the user
decision from source availability and any later application link), a
`candidate_decisions` audit table, a `CandidateService` with idempotent
recording and decision commands, four MCP tools, and bounded read queries. It
does not include candidate Web views, application linking, digest recording, or
run coverage.

### Downstream enablement

This enables S2-02 candidate Web views and application linking (A07/A08), and
S2-03 scoped digest recording plus run coverage (A11). The candidate schema is
the stable foundation the later slices reuse without rebuilding tables. The
remaining condition is the separately authorized S2-02 increment.

### Short-term benefits

- Candidate save/dismiss/restore decisions now survive reloads and new
  conversations (verified by 11 new integration tests).
- Candidate recording deduplicates by provider posting identity or canonical
  source URL, and never changes a user decision (verified).
- Every decision is actor-attributed with MCP/WEB channel and authority type
  (verified).

### Long-term benefits

- The candidate/decision/audit schema is the durable base for the full
  recommendation-to-application-to-task journey, with provenance and audit
  available for the S2 recommendation-continuity release.

## Delivered scope

- `db/migrations/006_job_candidates.sql` — `job_candidates` and
  `candidate_decisions`. Decision is a separate column from source availability
  and from `linked_project_id`. Exact dedup keys are
  `(workspace_id, provider, posting_id)` and `(workspace_id, source_url)`.
- `src/application/candidate-service.ts` — `recordCandidate` (create-or-update
  latest fit fields, preserving decision/link) and `decideCandidate`
  (SAVE/DISMISS/RESTORE with optimistic concurrency and audit). Authority seam
  follows `TaskService`: `EXPLICIT_USER_DEV` for MCP, `EXPLICIT_USER_WEB` for
  the Web channel; a forged development authority on Web is rejected.
- `src/application/job-search-query-service.ts` — `listCandidates` (decision and
  linked filters, pagination, search) and `getCandidate`.
- `src/application/workspace-service.ts` — exposes `candidateService`.
- `src/mcp/create-server.ts` — four additive tools:
  `workspace_record_candidate`, `workspace_decide_candidate`,
  `workspace_list_job_candidates`, `workspace_get_job_candidate`. Tool discovery
  is now 17; the original twelve contracts are unchanged.
- `src/domain/types.ts` — candidate decision/source/fit types and
  `JobCandidateRecord`.

Decision transition semantics: SAVE targets `SAVED`, DISMISS targets `DISMISSED`,
RESTORE targets `UNREVIEWED`. A no-op decision returns `changed: false` and does
not bump the version; a stale `expectedRecordVersion` is a concurrency conflict.

## Non-goals

- Candidate Web views and save/dismiss/restore browser controls (S2-02).
- Application linking and its audit (S2-02, A08).
- Digest recording capability, recommendation-run history and coverage (S2-03,
  A11).
- Any change to the frozen M4 runtime, existing application/lifecycle/Task
  commands, or the private MCP cloud deployment.

## Verification

- `npm run typecheck` — passed (server and browser configs).
- `npm run build` — passed.
- `npm run verify` — passed: 24 test files, 208 tests (was 192 before this
  slice). The 11 new integration tests cover recording dedup, decision
  transitions, idempotency, concurrency, audit, Web authority rejection, and
  read filtering/pagination.
- `tests/integration/database-backup.test.ts` and
  `tests/integration/mcp-transport.test.ts` expected values were updated to
  include migration `006_job_candidates.sql` and the four new tools.
- `vitest.config.ts` now pins `pool: "vmForks"`. The default worker-thread and
  native-fork pools fail to initialise the runner context under the Windows
  nvm4w Node symlink; this is an environment fix, not a change to any test
  assertion or application behavior.

No browser, device, cloud, or real-data acceptance was run. S2-01 is a local
code-and-test increment only.
