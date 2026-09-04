# Real Job Search MVP Slice M3 Results v0.1

**Milestone:** Real Lifecycle

**Decision:** LOCALLY COMPLETE — CHATGPT PLATFORM GATE PENDING

## Result summary

| Gate | Result |
| --- | --- |
| Approved lifecycle matrix | PASS |
| Proposal/admission separation | PASS |
| Derived lifecycle Tasks | PASS |
| Terminal Project closure and Task cancellation | PASS |
| Admission transaction rollback | PASS |
| Optimistic concurrency and idempotency regressions | PASS |
| MCP schema and transport | PASS |
| Frozen Spike, M1, and M2 regressions | PASS |
| ChatGPT platform evaluation | PENDING |

## Implemented behavior

M3 expands the Job Application lifecycle to the complete approved seven-state,
13-edge graph. The existing proposal path persists invalid edges as REJECTED
without changing Project state. The admission path retains explicit user
authority, Workspace isolation, lifecycle-version concurrency, evidence
attribution, and idempotency.

Admissions to `RECRUITER_CONTACT`, `INTERVIEWING`, and `OFFER` create exactly
one HIGH transition-derived Task of kind `RESPOND_TO_RECRUITER`,
`PREPARE_FOR_INTERVIEW`, and `REVIEW_OFFER`, respectively. The new offer Task
kind remains excluded from manual Task creation.

Admissions to `ACCEPTED`, `REJECTED`, or `WITHDRAWN` close the Project and
cancel every obsolete open Task in the same transaction. Cancellation
increments Task versions, attributes the update to SYSTEM, and does not alter
already-DONE or already-CANCELLED Tasks. A forced failure at the final
idempotency write proves that lifecycle, transition admission, and Task
cancellation roll back together.

## Migration and architecture review

No database migration was added. M3 reuses the existing Project lifecycle and
status columns, state-transition records, Task strings and audit fields,
unique transition-derived Task index, idempotency table, and SQLite transaction
boundary.

The MCP surface remains 12 tools. Only
`workspace_propose_transition.toState` expands. M2 manual Task kinds, Today
classification, inventory semantics, external database boundary, and frozen
Spike behavior remain unchanged.

## Automated evidence

Local verification on 2026-09-04:

```text
npm run verify
Test Files  12 passed (12)
Tests       129 passed (129)
TypeScript typecheck: passed
Production build: passed
git diff --check: passed
```

The M3 suite exercises all 13 admitted edges and all 36 rejected state pairs,
all three derived Task kinds, all terminal outcomes, Task cancellation audit
fields, closed-list behavior, exact and new-key admission retry, full rollback,
and the source-owned `REVIEW_OFFER` boundary. The transport test drives
`RECRUITER_CONTACT -> INTERVIEWING -> OFFER -> ACCEPTED` through MCP and checks
the final closed Project has no open Tasks.

## Readiness recommendation

Refresh the ChatGPT development connection against this branch and execute the
fresh-database platform gate in `tests/evaluations/chatgpt-m3.md`. Do not merge
to `main`, tag/freeze M3, or claim the overall MVP complete before that gate is
recorded as supported.
