# Backend-managed mail scan receipts

Status: implemented and locally verified on 2026-09-08, based on main
`9b3620a`. Not deployed; ChatGPT manual and scheduled acceptance remain pending.

End-of-day handoff: the user requested documentation updates and a commit/push
to GitHub main, then stopping work for today. The containing Git commit identifies
this source package; publication is not a deployment or task activation.
Resume at the deployment-copy migration/release gate below. Do not restart
strategy discussion or treat the synthetic checks as restored daily ingestion.

## Continuity and benefits

The [approved requirements](MAIL_SCAN_BACKEND_LEDGER_REQUIREMENTS_2026-09-08.md)
and [core workflow](CORE_JOB_WORKFLOW.md) require durable daily source coverage
without GPT assembling receipt totals. This package adds an opt-in backend
receipt mode, transactional business-write attribution, and recovery rules to
the existing services. It adds no scheduler, model executor or website scan entry.

Local tests establish automatic aggregation, honest incomplete results and
recoverable source processing. This enables a reviewed deployment followed by
[actual ChatGPT manual and scheduled acceptance](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md).
The expected long-term benefit is reliable daily accounting while retaining GPT
interpretation and the existing authorization boundary. Platform acceptance and
daily usefulness are still unverified.

## Ownership check

1. This is Job Search source coverage and business-record attribution, a domain
   responsibility. It is not a general agent runtime or execution-history service.
2. The [Platform Watch](../strategy/OPENAI_PLATFORM_WATCH.md) records platform
   capabilities separately from target-environment evidence. This package adds
   no new claim about OpenAI eligibility, API access or hosted-write compatibility.
3. Execution logs alone do not establish which Gmail sources produced PAW rows,
   whether required actions succeeded, or which mailbox interval was completed.
   PAW therefore owns this database transaction and its derived receipt.
4. Revisit the execution boundary when target-environment capabilities are
   verified. Retain domain evidence, ownership and checkpoint invariants even if
   the platform later owns more orchestration.

## Tool contract and compatibility

| Operation | Backend-mode contract |
| --- | --- |
| `workspace_start_mail_scan` | Existing authorized write; add `receiptMode: "BACKEND"`. Keep a stable UUID `runId` for retries. Stores original authority/origin, both configured account bindings, fixed cutoff and bounded scope before fetching Gmail. Does not itself fetch mail. |
| `workspace_next_mail_batch` | Same bounded acquisition inputs. Stores run-to-batch acquisition, page cursor, IDs, body completeness and source identity. Existing recent/backfill lanes and seven-day policy remain. |
| Seven existing business tools | Optional `scanContext: {runId, batchId, messageId, actionKey}` attaches each attempted action to a completely read, pending source. The original command still checks business authority, evidence, expected versions, privacy and idempotency. |
| `workspace_ack_mail_batch` | Backend items require `verified: true`, `requiredActionKeys: []` or the actual required keys, and `projectId` for relevant mail. Failed/pending attempts and absent required actions block acknowledgement. Conflicting application associations also block it. |
| Automatic settlement | After next/ack, both completely processed mailbox ranges cause backend receipt/checkpoint settlement. GPT supplies no totals or final coverage claim. |
| `workspace_close_mail_scan` | New explicit write for early closure, with existing user confirmation/authority plus a reason. Backend derives each mailbox's actual completeness; pending source work survives. Repeated closure reads the immutable result. |
| `workspace_get_mail_scans` / website | Read-only receipt and progress, including mode, fixed scope, heartbeat and expired-lease/unresolved-action diagnostics. Reads do not fetch Gmail or reap runs. |

The seven business tools are create/update application, record observation,
propose/admit transition, and create/update task. `actionKey` identifies one
source obligation. Successful keys cannot change operation or payload. Failed
attempts may be corrected under the same key/operation; attempt hashes and
statuses remain. Changed business commands need appropriate idempotency keys.
Duplicate warnings and rejected proposals retain their original command results
and remain unresolved ledger actions.

Relevant acknowledgements query persisted account-qualified Gmail evidence for
the selected application. `RECORDED` requires an actual new scoped evidence
insert; a previously stored observation uses `EXISTING`. Excluded advertising
uses `IRRELEVANT`, explicit confirmation and no business actions. Classification,
matching and the assertion that all necessary actions/readbacks are included
remain GPT responsibilities; the backend cannot independently prove semantic
correctness or detect a necessary action that was never declared or attempted.

Omitting `receiptMode` preserves `LEGACY`; its existing start/finish/next/ack
contracts remain. Manual finish cannot override a backend run. The workspace
serializes scans while a backend run is active; finish an existing legacy run
before opting in. Unresolved backend source actions cannot be skipped by a
later legacy acknowledgement. Ordinary business writes without `scanContext`
are not attributed to a backend run just because their timestamps overlap it.
Saved task prompts are unchanged: opt in only after deployment and refreshed
tool discovery, with actual authorization in the target environment.

All ledger-affecting tools retain explicit write metadata. The existing hosted
`workspace_start_mail_scan` refusal is unresolved. This functional redesign is
not a renamed retry or proof of platform recovery; a refused write must stop.

## Persistence and recovery

Migration 012 adds six ledger tables and four scoped capture triggers; it
does not rewrite historical runs, queues or business rows. The write scope
exists only inside a synchronous SQLite transaction. Actual application,
Gmail evidence and task inserts, and admissions excluding the initial `NONE`
transition, are linked to the action/run/source in that same transaction.
Replays and ordinary concurrent writes do not produce new counts. Minimal
result IDs and request hashes are saved, not mail bodies or command payloads.

An action intent is durable before the business transaction. Exceptions roll
back business rows, idempotency rows and captured effects together, leaving a
failed attempt. Source obligations follow mailbox/message identity across runs
and clipped replacement batches. Completed receipts retain their original
write ownership; new runs do not reclaim previous inserts.

The inactivity lease is 30 minutes, refreshed by authorized processing. It is
not evidence that a worker is currently alive. Reads expose `EXPIRED` without
writing. A new authorized backend start closes expired runs as PARTIAL, with
no timeout-derived checkpoints, before resuming retained work under a new UUID.
Late source responses are rechecked against the running lease before persistence.
No background timer or task configuration was added.

Complete mailbox ranges and a receipt commit atomically. Early closure can
preserve one proven mailbox checkpoint while the other remains partial.
Exclusions older than seven days remain visible and never count as scanning.
Exact acknowledgement retries, including after automatic completion, are
read-only replays. A closed run cannot accept new business actions.

## Local verification and release gates

- Type checking and production build pass; 41 test files / 340 tests pass.
- [Ledger integration tests](../../tests/integration/mail-scan-ledger.test.ts)
  exercise authorization, source completeness, empty scans, duplicate and actual
  writes, admission, rollback, restart/timeout, late responses, MCP transport,
  per-mailbox coverage and atomic checkpoint failure/retry. Existing batch tests
  retain pagination, seven-day expiration and binding-isolation coverage.
- [012 migration verifier](../../scripts/verify-mail-scan-ledger-migration.ts)
  passes on a populated version-11 copy: unchanged old rows/schema history,
  exact additive schema, empty new tables, integrity and foreign-key checks.
- [Previous-code compatibility check](../../scripts/verify-mail-scan-ledger-rollback.mjs)
  passes using built main `9b3620a`: read a closed backend receipt and application
  without writes, perform/replay an ordinary synthetic observation, then reopen
  with new code and retain the receipt. No live mailbox/database was accessed.

To reproduce: run `npm run typecheck`, `npm test -- --maxWorkers=2`, and
`npm run build`. Build an isolated checkout of `9b3620a`, then run
`node scripts/verify-mail-scan-ledger-rollback.mjs <built-previous-source-root>`.
For a prepared 011/012 database pair, run the built
`dist/scripts/verify-mail-scan-ledger-migration.js <before.db> <after.db>`.

Before release, take a SQLite-consistent backup and run that verifier on the
actual deployment copy; synthetic evidence does not substitute for this gate.
Keep task policies paused while changing runtime versions. Before reverting
to old code, close backend runs with new code and keep daily scanning paused:
old binaries can read the additive schema but do not enforce backend obligations.
Retain the upgraded database and ledger rows; restoring a pre-upgrade snapshot
after new business writes would discard those writes.

After deployment, refresh discovery, verify the optional schemas and 30-tool
inventory, then independently record an authorized ChatGPT manual run, database
and website readback, and a real scheduled run. Production remains documented as
`mail-layout-20260908-r2` / migration 011 / 29 tools until that release occurs.
