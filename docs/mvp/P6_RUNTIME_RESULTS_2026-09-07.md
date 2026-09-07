# P6 release and acceptance execution — 2026-09-07

**Latest execution:** after the user accepted the overview/font update and
requested continuation, P6 fixtures were created and A07/A08/A11 passed through
live MCP. A02/A04/A05/A09 have partial evidence; remaining browser/device
checks are pending. There are now 140 applications (23 real + 117 synthetic).
See the authoritative [scenario ledger](P6_SCENARIO_EXECUTION_2026-09-07.md).
The pre-fixture status/matrix below is historical.

**Status:** S2 deployed; automated Phase 0B checks pass. Authenticated browser
smoke awaits the user's result. A01–A12 have not started and no P6 fixtures
have been written to the cloud database.

**Subsequent user feedback:** pages open normally; the default count and text
size were confusing. The [UI correction](WEB_OVERVIEW_READABILITY_2026-09-07.md)
is now deployed as `0a9dd15` with ALL as the Web default and larger fonts.
The initial `da0a879` release evidence below is retained as history. P6
scenarios and fixtures remain pending.

## Continuity and benefits

The [P6 plan](P6_ACCEPTANCE_PLAN_v0.1.md) and
[migration rehearsal](../cloud/S2_MIGRATION_REHEARSAL_2026-09-07.md) require
data-preserving deployment before full acceptance. The user authorized steps
1–4 in this session. The delivered increment is a verified S2 upgrade plus
repeat/old-image startup rehearsal and read-only regression evidence.

Immediate verified benefits: pre-existing data survives the upgrade; all 13
existing MCP schemas, Today/application result hashes, and the retained Task
remain identical. The eight added tools are discoverable on the live MCP
server. This enables the complete candidate-to-application P6 journey after
authenticated browser smoke. Long-term expected benefit is repeatable upgrade
and rollback evidence; adoption/usefulness still needs real-use evaluation.

No real application was mutated, no identity/bootstrap setting was changed,
and browser writes remained disabled. Local synthetic fixture automation is
ready and idempotency-tested; local tests do not satisfy cloud/device scenarios.

## Verified execution

| Gate | Evidence | Result |
| --- | --- | --- |
| Local implementation | 28 files / 235 tests; typecheck; build | PASS |
| Release source | `08049ea`, corrected candidate `da0a879`; pushed to origin/main | PASS |
| Initial isolated rehearsal | CRLF/LF historical DDL mismatch; no deployment | FAIL, diagnosed and corrected |
| Pre-release backup | `workspace-20260907T030037Z.db`, integrity ok, migrations 001–005 | PASS |
| Corrected S2 migration rehearsal | 12 old business tables preserved; 5 expected new tables; migrations 006–008 | PASS |
| S2 repeat startup | Same upgraded copy, 18 tables / 194 rows unchanged | PASS |
| Previous image startup | `paw:9303de5` on same upgraded copy, unchanged | PASS |
| Exact-image deployment | `paw:da0a879`, image `sha256:e66f6005d31203b7d78bb1418b68225ec36c8a9a13082c09255b51f2611b5317` | PASS |
| Live migration verification | Read-only comparison against pre-release backup | PASS |
| Public HTTPS checker | All 5 checks, writes off | PASS |
| Network/service health | 443 healthy; 80 closed; 3000/3001 loopback; bootstrap false | PASS |
| MCP contracts | 13 previous schemas identical; discovery now 21 | PASS |
| MCP state | Today, active and closed-inclusive list hashes identical | PASS |
| Retained synthetic Task | DONE v2; completion `2026-09-06T10:10:28.617Z`, unchanged | PASS |
| New S2 reads | Candidates/runs empty; nonexistent candidate NOT_FOUND | PASS |
| Connected-app readback | Existing connector returns retained Task exactly | PASS, same conversation only |
| Authenticated browser smoke | User asked to log in and open Today, Applications, Jobs | PENDING |

VM evidence files: `/srv/paw/deployments/p6-smoke-before-20260907.json` and
`p6-smoke-after-20260907.json`. A programmatic comparison asserted identical
old schemas, hashes and retained Task. No real record bodies are in these
evidence receipts. The pre-release tag is preserved in
`active-image-tag.before-p6-20260907`.

The connected app's currently exposed tool snapshot in this agent still lists
13 tools even though live MCP discovery returns 21. Refresh the custom app's
actions before performing S2 actions from a fresh ChatGPT conversation; do
not interpret a stale action list as missing server functionality.

## A01–A12 evidence matrix

All rows remain PENDING until Phase 0B authenticated browser smoke passes.

| Scenario | Required evidence | Result |
| --- | --- | --- |
| A01 | Saved link/login/exact object, wrong account denied | PENDING |
| A02 | Observation + unadmitted proposal visible; lifecycle unchanged | PENDING |
| A03 | MCP update followed by stale browser write rejected | PENDING |
| A04 | 106 seeded applications and >10 history entries paged through Web | PENDING |
| A05 | Today reasons and application gap verified against MCP | PENDING |
| A06 | Web completion plus fresh ChatGPT readback | PENDING |
| A07 | Save/dismiss survive another recommendation run | PENDING |
| A08 | Duplicate resolution and one candidate/application link | PENDING |
| A09 | Repeated completion intent, one execution, conflict behavior | PENDING |
| A10 | Windows fully off, iPhone portrait/cellular journey | PENDING |
| A11 | Synthetic COMPLETE/FAILED/UNKNOWN coverage/delivery readback | PENDING |
| A12 | Exact Web link and copy-context fallback, fresh retrieval | PENDING |

## Resume

### User browser feedback and count reconciliation

The user reported that pages open normally, questioned the displayed count of
12, and supplied screenshots of the Applications list and its retained S1-05B
fixture. Read-only live MCP reconciliation returned 12 open and 24 total,
neither truncated. The 24 comprise 23 real applications (10 APPLIED,
1 INTERVIEWING, 12 CLOSED/REJECTED) and the one retained ACTIVE/APPLIED
synthetic S1-05B application. Thus the default OPEN count is 11 real + 1 test.
The Web list defaults to OPEN; its existing "查看全部" link selects `status=ALL`.
This is not evidence of lost rows. The screenshots show Applications, not the
separate Jobs candidate list, so Jobs' signed-in empty state is not independently
established by the screenshots. No P6 fixture was written during reconciliation.

1. Obtain the pending user's authenticated-page result. This is test evidence,
   not a renewed permission request. Existing steps 1–4 authority persists.
2. Recheck health/read mode and the deployed image; refresh the app's tools.
3. Run the reviewed `deploy/cloud/p6-fixtures.mjs` via stdin in the live
   container with `PAW_P6_AUTHORITY=approved-steps-1-4-20260907`; preserve its
   synthetic receipt. Run the bounded A04 seed separately. Both have fixed
   inputs/keys and are locally tested for no-write replay.
4. Execute each scenario and record results immediately. Browser mutation
   windows must be bounded; close them before waiting for further input.
5. Arrange Windows-off iPhone and independent ChatGPT evidence with the user.

Do not claim P6 complete until all twelve scenarios pass.
