# S2-03 Digest Run Recording and Coverage — Results v0.1

**Date:** 2026-09-06 (Australia/Sydney).

**Status:** Local implementation complete. Typecheck, production build and the
full repository test gate pass (25 files / 222 tests). No cloud deployment,
browser view or real-data mutation is included.

## Continuity and benefits

### Upstream requirement

The
[Job Search Secondary Interface requirements](JOB_SEARCH_SECONDARY_INTERFACE_REQUIREMENTS_v0.1.md)
R10 and R13 plus acceptance scenario A11 require the daily digest to become a
narrowly scoped, authorized recorder rather than a read-only filter. A run/item
ledger must retain stable source identity, run time, selected candidate IDs,
attempted delivery and known delivery outcome, recording "delivery unknown" when
no acknowledgment exists, and track source coverage/failures so "no new jobs"
differs from "search unavailable". The
[P0 technical plan](JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md) P5 package carries
this scoped recording capability plus run coverage.

### Current package

S2-01 delivered candidate storage and manual decisions; S2-02 delivered candidate
Web views and application linking. S2-03 closes recommendation continuity by
adding the run/item ledger and a single scoped recording command. It does not
add a scheduler, a web run view, or any broader intelligence model.

### Downstream enablement

This completes the S2 recommendation-continuity package (P3 + P5). The remaining
gate is the full P6 acceptance run (A01–A12) over the complete
recommendation-to-application journey; no further data-layer slice is required
before that run.

### Short-term benefits

- The digest can durably record each run and its candidates while the recording
  command is provably narrow: it never changes a save/dismiss decision, never
  creates an application, and never admits a lifecycle change (verified).
- Coverage and delivery are recorded truthfully: an empty result with COMPLETE
  coverage is a real "no new jobs", while a FAILED source or UNKNOWN delivery is
  not silently reported as success (verified).
- Each run snapshots its own fit suggestion, so a later run does not overwrite an
  earlier run's delivery context (verified).

### Long-term benefits

- Recommendation provenance now survives the digest's transient conversation:
  run history, per-run fit context and delivery outcomes are durable Workspace
  records available for the S2 release's audit and coverage story.

## Delivered scope

- `db/migrations/008_recommendation_runs.sql` — `recommendation_runs` (source,
  run time, coverage status, delivery status, coverage note, item count,
  retention boundary) and `recommendation_run_items` (candidate + per-run fit
  snapshot, deduplicated by candidate within a run).
- `src/domain/types.ts` — `CoverageStatus`, `DeliveryStatus`,
  `RecommendationRunRecord`, `RecommendationRunItem`, `RecommendationRunDetails`.
- `src/application/candidate-service.ts` — extracted `normalizeCandidateFields`
  and `upsertCandidateRecord` (shared by `recordCandidate` and the new command),
  plus `recordRecommendationRun`: idempotent and atomic, appends/dedupes
  candidates, snapshots run items, and never writes decisions, links, projects,
  transitions or tasks. Default retention is `run_at + 90 days`, overridable per
  run via `retentionUntil`.
- `src/application/job-search-query-service.ts` — `listRecommendationRuns`
  (bounded, ordered) and `getRecommendationRun` (run plus ordered items).
- `src/mcp/create-server.ts` — `workspace_record_recommendation_run`,
  `workspace_list_recommendation_runs` and `workspace_get_recommendation_run`
  (tool discovery is now 21). The recording tool requires explicit user
  authority and an authority reference.

Coverage/delivery semantics: `coverage_status` is `COMPLETE`, `PARTIAL`,
`FAILED` or `UNKNOWN`; `delivery_status` is `DELIVERED`, `ATTEMPTED` or
`UNKNOWN`. An empty `items` list is valid and, with `COMPLETE`, records a
truthful "no new jobs". Run items deduplicate by the resolved candidate ID,
keeping the first position in the run.

## Non-goals

- A browser run/coverage view (S2-03 is MCP-first, like S2-01).
- Automatic retention cleanup or a backend scheduler; retention is a recorded
  contract (`retention_until`) with no scheduled writer.
- Digest scheduling and notification delivery (remain the external ChatGPT
  workflow's concern).
- Any richer intelligence model, matching/scoring, or new domain.

## Verification

- `npm run typecheck` — passed (server and browser configs).
- `npm run build` — passed.
- `npm run verify` — passed: 25 test files, 222 tests (was 215 before this
  slice). Seven new tests cover run/item recording, idempotent replay, narrow
  policy (decision/project/lifecycle non-mutation), truthful empty and
  failed/unknown runs, per-run snapshot isolation, in-run dedup, validation, and
  bounded run reads with wrong-owner rejection.
- `tests/integration/mcp-transport.test.ts` now expects 21 tools.
- `tests/integration/database-backup.test.ts` now expects migration
  `008_recommendation_runs.sql`.

No browser, device, cloud or real-data acceptance was run. S2-03 is a local
code-and-test increment only.
