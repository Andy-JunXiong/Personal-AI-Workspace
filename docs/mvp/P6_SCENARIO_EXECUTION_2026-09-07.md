# P6 scenario execution — 2026-09-07

## Continuity and benefits

The [P6 plan](P6_ACCEPTANCE_PLAN_v0.1.md) follows the
[verified S2 deployment](P6_RUNTIME_RESULTS_2026-09-07.md). After the
[overview/font correction](WEB_OVERVIEW_READABILITY_2026-09-07.md), the user
accepted the update and requested the next step. Existing authorization for
steps 1–4 and synthetic acceptance writes remains in effect.

This package executes the previously prepared fixtures and deterministic
server scenarios, separating live MCP evidence from pending browser/device
evidence. Immediate verified value: decisions survive a repeat recommendation,
duplicates do not create another application/link, truthful coverage/delivery
states remain readable, and pre-test rows remain intact. The remaining user
journey checks enable the P6 release decision. Long-term usefulness/adoption
still requires actual dogfood, not synthetic success.

## Fixture creation

- Pre-test backup: `workspace-20260907T043222Z.db`, integrity ok, migrations 001–008.
- Fixture runner: 10 applications, 6 tasks, 12 NOTE observations, one unadmitted
  proposal, 5 candidates, 3 synthetic runs. Fixed inputs and idempotency keys.
- Separate bounded A04 seed: 106 applications, authority `P6-A04-acceptance`.
- Current total: 140 applications = 23 real + 117 synthetic (including the
  earlier retained S1 fixture). 10 total tasks, 5 candidates.
- Web writes and bootstrap remain false. No real task was completed.
- VM receipts: `/srv/paw/deployments/p6-fixtures-20260907.json`,
  `p6-a04-20260907.json`, `p6-server-acceptance-20260907.jsonl`.

## Evidence matrix

| Scenario | Result | Verified evidence / remaining condition |
| --- | --- | --- |
| A01 | PENDING | Saved-link login and wrong-account denial need user/browser evidence |
| A02 | PARTIAL | MCP state APPLIED, stored proposal PROPOSED; Web display pending |
| A03 | PENDING | Dedicated task TODO; stale browser write not attempted |
| A04 | PARTIAL | Deployed query path read 106 applications over 5 pages and 11 NOTE rows over 3 pages, no duplicates; user screenshot shows 106/106 applications loaded and end reached; browser duplicate check and evidence paging remain pending |
| A05 | PARTIAL | HIGH_PRIORITY; OVERDUE + BLOCKED counted once; gap present; Web comparison pending |
| A06 | PENDING | Dedicated task TODO; Web completion/fresh conversation pending |
| A07 | PASS | Saved/dismissed decisions survive a repeat run; no new candidate/application/lifecycle rows |
| A08 | PASS | POSSIBLE_DUPLICATE with no writes; one link to dedicated App-A08; replay byte-identical DB |
| A09 | PARTIAL | Connected app completed only Task-A09; replay returned same DONE v2; changed payload rejected; one audit/idempotency row, DB unchanged on replay/conflict; browser input retention pending |
| A10 | PENDING | Dedicated task/candidates untouched; Windows-off iPhone journey pending |
| A11 | PASS | COMPLETE/FAILED/COMPLETE, all delivery UNKNOWN, empty items read back exactly |
| A12 | PENDING | Exact link/context-copy/new-conversation journey pending |

These server PASS results were exercised through live loopback MCP by the
operator's acceptance client. They are not an independent ChatGPT-conversation
or iPhone result. Synthetic COMPLETE coverage is an explicit fixture, not a
claim that an external source was searched.

## Data and validation

After A07/A08/A11, every one of the 194 pre-test rows matched the backup,
including all real records and retained S1 evidence. SQLite integrity and
foreign-key checks passed. The server runner is covered by local MCP fixture,
scenario, and no-write full replay verification; 28 files / 236 tests pass,
plus typecheck and build. The extended scenario test uses a scoped 20-second
timeout because it performs four child-process transport runs.

A09 subsequently completed the dedicated synthetic Task through the connected
Workspace app at `2026-09-07T04:38:48.685Z`, DONE version 2. Exact retry returned
`replayed: true`; changing status to CANCELLED under the same key returned
`IDEMPOTENCY_CONFLICT` and did not cancel the Task. The completion key is
`p6-20260907-A09-completion`. Before/after retry+conflict fingerprints both equal
`4fab5078e78d1ebd71486fbbe959a964487cc269d416cf3fbe14c8fbe1e1ace1`
(18 tables / 617 rows). One completion audit and one idempotency row exist.
The VM retains `p6-a09-before-replay-20260907.txt` and
`p6-a09-after-replay-20260907.txt` under `/srv/paw/deployments`.

Fixture receipts contain creation-time snapshots. Always read current state
before the next action: A09 is now DONE and must not be used for another
completion scenario. A03/A06/A10 remain reserved for their own human checks.

## Human handoff links

- A04 applications: `/workspace/job-search/applications?q=P6-A04%20Company`
  (106 rows; load all pages).
- A04 evidence: `/workspace/job-search/applications/e2cb9919-be33-43b9-8109-8c5eb466815e?section=resources&pageSize=5`
  (11 rows; load all pages).
- A02 application: `6d37d07e-4679-4f1b-9469-e4745c3ea636`.
- A06 task: `81069bc0-09e2-4e3b-b756-b8696bd094d2`.
- A09 task: `45ef434c-47f3-4a67-a3cf-46426187ebca`.
- A10 task: `7399990b-219c-4baa-8d1f-b59ef57f7be7`.

Keep browser writes disabled while waiting for the user. Schedule a bounded
write window only when the user is ready for the required browser actions.
