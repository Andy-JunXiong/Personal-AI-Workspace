# S2-02 Candidate Web Views and Application Linking — Results v0.1

**Date:** 2026-09-06 (Australia/Sydney).

**Status:** Local implementation complete. Typecheck, production build and the
full repository test gate pass (24 files / 215 tests). No cloud deployment,
browser device test or real-data mutation is included.

## Continuity and benefits

### Upstream requirement

The
[Job Search Secondary Interface requirements](JOB_SEARCH_SECONDARY_INTERFACE_REQUIREMENTS_v0.1.md)
R05, R09, R10 and R11 plus acceptance scenarios A07/A08 require candidate
continuity to be visible and actionable from a browser, not only from ChatGPT:
candidates shown in a separately labeled view, durable save/dismiss/restore
decisions, and recording an actual application by linking a candidate to an
existing application without duplicating it. The
[P0 technical plan](JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md) P3 package is the
shared home for the candidate schema, manual decisions and application linking.

### Current package

S2-01 delivered the candidate data layer and manual decisions as MCP-only.
S2-02 closes the P3 slice by exposing candidates over the same authenticated Web
surface S1 built: a Jobs list and candidate detail, browser save/dismiss/restore
controls, and actor-attributed application linking. It also adds the
`workspace_link_job_candidate` MCP tool so ChatGPT can link after creating or
resolving a duplicate application.

### Downstream enablement

This completes the P3 candidate/link contracts for A07/A08 and leaves S2-03
(scoped digest recording, recommendation-run history and coverage, A11) as the
remaining recommendation-continuity increment. The candidate link schema is a
stable base for that slice; no table rebuild is required.

### Short-term benefits

- Candidates are now readable, filterable and decidable from the browser Jobs
  view, with the same decision/linked filters S2-01 exposed over MCP.
- A candidate links to an existing owned application exactly once; retrying the
  same intent replays without duplicating the link or the application (verified).
- Every link is actor-attributed with MCP/WEB channel and authority type, and
  never changes the candidate's save/dismiss decision (verified).

### Long-term benefits

- The candidate/decision/link audit trail is the durable foundation for the full
  recommendation-to-application journey, including provenance for the S2
  recommendation-continuity release.

## Delivered scope

- `db/migrations/007_candidate_links.sql` — `candidate_links` audit table with
  workspace/candidate/project references, channel, principal and authority
  attribution. A candidate links through the existing `job_candidates.
  linked_project_id` column; the audit table records each link action.
- `src/application/candidate-service.ts` — `linkCandidateToApplication`
  (create-once link to an owned `job_application`, idempotent, version-bumping,
  audit-writing; rejects a second different link and a non-application target),
  plus `decideCandidateFromWeb` and `linkCandidateFromWeb` wrappers that require
  a verified `WEB` channel and derive the authority reference from the request
  principal and intent key.
- `src/mcp/create-server.ts` — `workspace_link_job_candidate` tool (18 total).
  Linking requires `userConfirmed` and an authority reference; it never creates
  an application and never resolves a duplicate on the model's behalf.
- `src/auth/job-search-read-router.ts` — `GET /api/v1/job-search/candidates`
  and `/candidates/:id`.
- `src/auth/job-search-write-router.ts` — `POST /candidates/:id/decide`
  (SAVE/DISMISS/RESTORE) and `POST /candidates/:id/link`, CSRF-bound through the
  existing write router.
- `src/web/page-router.ts` — `/workspace/job-search/jobs` and `/jobs/:id`
  object routes, plus the return-path allowlist for login.
- `src/auth/web-auth-app.ts` — extended the object-route allowlist to the Jobs
  routes.
- `src/web/views.ts` — `candidateListView` and `candidateView`, the Jobs sidebar
  navigation entry, candidate decision/source labels, and a candidate context
  copy for ChatGPT handoff.
- `src/web/assets/workspace.js` — progressive-enhancement handlers for
  `data-decide-candidate` and `data-link-candidate` with per-intent keys and
  offline handling, mirroring Task completion.

Linking semantics: a candidate links to an owned `job_application` exactly once.
Linking to the same project is a no-op; linking to a different project is
rejected; a missing or non-`job_application` target returns NOT_FOUND. Linking
bumps `record_version` and never mutates `decision`.

## Non-goals

- Web creation of a new Job Application from a candidate (the A08 "authorized
  creation" path remains the existing `workspace_create_job_application` plus the
  new `workspace_link_job_candidate`; S1 did not add a browser application-creation
  write).
- Unlinking or re-linking a candidate to a different application.
- Digest recording, recommendation-run history, source coverage/failure tracking
  and retention (S2-03, A11).
- Any change to the frozen M4 runtime or the deployed S1 cloud surface.

## Verification

- `npm run typecheck` — passed (server and browser configs).
- `npm run build` — passed.
- `npm run verify` — passed: 24 test files, 215 tests (was 208 before this
  slice). Seven new tests cover linking dedup/idempotency/audit, rejection of a
  second or non-application link, web-channel authority, forged development
  authority rejection, and the authenticated Web candidate read/decide/link
  routes with CSRF and replay protection.
- `tests/integration/mcp-transport.test.ts` now expects 18 tools and includes
  `workspace_link_job_candidate`.
- `tests/integration/database-backup.test.ts` now expects migration
  `007_candidate_links.sql`.

No browser, device, cloud or real-data acceptance was run. S2-02 is a local
code-and-test increment only.
