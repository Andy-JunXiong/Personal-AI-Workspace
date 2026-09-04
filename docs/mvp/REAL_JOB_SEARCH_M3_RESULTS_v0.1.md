# Real Job Search MVP Slice M3 Results v0.1

**Milestone:** Real Lifecycle

**Decision:** COMPLETE — CHATGPT PLATFORM SUPPORTED

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
| ChatGPT platform evaluation | PASS |

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

## ChatGPT platform evidence

The fresh-database M3-A/B/C evaluation passed on 2026-09-04 through the
refreshed 12-tool ChatGPT development connection. The run used Workspace
`08a0662e-1c8f-47b5-a1c1-0a5f2b1e613f` and external database
`%LOCALAPPDATA%\PersonalAIWorkspace\data\m3-platform-20260904-171917.db`.

- M3-A preserved proposal/admission separation through
  `APPLIED -> RECRUITER_CONTACT -> INTERVIEWING -> OFFER`, producing exactly
  the three approved HIGH derived Tasks.
- M3-B admitted `OFFER -> ACCEPTED` at version 5, closed the Project,
  atomically cancelled all four open Tasks with SYSTEM attribution and one
  version increment, safely replayed the same admission, and rejected the
  terminal outgoing edge without mutation.
- M3-C independently admitted APPLIED applications to `REJECTED` and
  `WITHDRAWN`, then a separate conversation read all three terminal Projects
  from the same database with zero open Tasks and no mutation.

Direct read-only SQLite inspection matched the ChatGPT results: ACCEPTED v5,
REJECTED v2, and WITHDRAWN v2 were all CLOSED with zero open Tasks. The four
ACCEPTED-flow Tasks were all CANCELLED at record version 2; the disallowed
`ACCEPTED -> INTERVIEWING` proposal was durably REJECTED. Server and tunnel
stderr logs were empty.

The frozen exact lookup remains active-only, so terminal exact lookups return
`NOT_FOUND`. M3-C correctly resolved exact company/role pairs from the
closed-inclusive list before bounded Project readback. This does not change the
M1 lookup contract.

Platform conversations:

- M3-A/B/C: <https://chatgpt.com/c/6a9a71c9-0f0c-83ec-bc4e-fe39ec9b4327>
- Independent M3-C readback: <https://chatgpt.com/c/6a9a75cc-4e7c-83e8-a968-833ad4253490>

## Completion recommendation

Both required gates are supported. Merge M3 to `main` and freeze the verified
milestone as `m3-real-lifecycle-verified-v0.1`. The scoped Real Job Search MVP
M1/M2/M3 implementation is complete; post-MVP work requires a separately
approved scope.
