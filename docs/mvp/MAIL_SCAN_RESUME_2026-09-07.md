# Bounded daily mail processing and resumption

Status: implemented locally, 33 test files / 269 tests, typecheck/build passed.
Not deployed. Cloud remains gmail-mcp-20260907204200 with 27 tools.
This package adds migration 010 and two tools, bringing discovery to 29.

## Continuity and benefits

- Upstream: user-supplied MANUAL receipt d483b9a3-e355-4367-8436-15b3943fd8a6
  persisted as PARTIAL after about nine minutes. Mailbox 1 listing was incomplete;
  mailbox 2 listed 136 IDs but did not finish reading/classifying them. Existing
  Synogize evidence was correctly deduplicated. These are user-reported results,
  not an independently fetched receipt in this development session.
- User correction: this is a daily job, normally yesterday/today. Maximum
  lookback is ONE WEEK, not 30 days. This supersedes the old bootstrap scope.
- Current package: persist page positions, listed/pending IDs and per-message
  processing acknowledgements. RECENT work and remaining first-week BACKFILL
  advance separately; old incomplete trial receipts remain unchanged.
- Downstream: deploy, refresh ChatGPT plugin tool discovery to 29, activate the
  self-contained updated policy, then verify a bounded MANUAL run and a real
  recurring run. No new Gmail authorization or duplicate scheduled task required.
- Short-term verified benefit: tests prove restart recovery, no re-read of
  acknowledged IDs, no advancement past unread/incomplete messages, and no
  automatic application or task writes by source-processing tools.
- Long-term expected benefit: daily progress no longer depends on one conversation
  finishing an entire mailbox. The website reports durable source processing and
  limited coverage accurately; completion time still depends on mailbox volume.

## Boundaries and contracts

First-run scope is run.startedAt minus seven days, capped at the run's fixed
cutoff. RECENT initially covers the last two days. BACKFILL only covers the
remaining five days. Normal subsequent daily windows advance at most one day
with a 24-hour overlap (normally yesterday/today). Window results include only
exact bounded timestamps despite Gmail's second-resolution listing bounds.

Pending work outside the rolling seven-day policy is marked EXPIRED, never DONE.
Its rows and prior receipts remain intact. Per-stream excludedBefore records the
boundary of omitted old work. Coverage reports must not call that work scanned.
If a successful global checkpoint predates the new seven-day baseline after a
long pause, the server permits a new bounded coverage claim only after both
remaining streams are processed; source ranges show the narrower actual scope.

workspace_next_mail_batch requires an owned RUNNING scan, standing authority,
mailbox, lane and optional limit (default 3, maximum 5). It stores one Gmail page
of IDs before returning a bounded set of bodies. No bodies or credentials are
persisted in queue tables. Cursor updates are transactional and revision-checked.
restartListing=true can restart a stale bounded listing without discarding
acknowledged IDs. Read failures remain pending and are reported; they are not
successful empty batches. Listing can continue past blocked items while retaining
those items as blockers to window completion.

workspace_ack_mail_batch requires source bodies read completely in the current
run. IRRELEVANT records a GPT-reviewed non-job message. EXISTING/RECORDED require
matching account-qualified Gmail evidence already persisted in the same Workspace.
These acknowledgements express the authorized GPT's classification and assertion
that all required business writes were verified; the server checks source readiness
and evidence ownership, not the semantic correctness of model classification.
Unresolved matching, unsupported lifecycle edges and failed task/state writes must
remain unacknowledged. Exact retries do not add writes; conflicting outcomes fail.

Source progress survives PARTIAL run finalization. Subsequent executions start a
new receipt and continue pending batches. Existing global receipt checkpoints do
not advance until both permitted streams are complete. New records, transitions
and tasks still use existing authority, provenance and readback rules. Already
acknowledged source IDs are reused across overlapping windows and streams.

The read-only website panel exposes RECENT/one-week backfill progress, listed
pending count, blocked count and excluded boundary. It adds no operational buttons.
Pending count is not an estimate of the entire remaining mailbox.

## Verification

- npm.cmd run typecheck: passed.
- npm.cmd test -- --maxWorkers=2: 33 files / 269 tests passed.
- npm.cmd run build: passed.
- New tests cover file-backed restart after partial finalization, page continuation,
  independent lanes, duplicate/rejected acknowledgements, source incompleteness,
  missing relevant evidence, caller/run/Workspace isolation, stale-page restart,
  truthful global coverage, real MCP next/ack/read transport, old migration/receipt
  preservation, seven-day initialization and expiry after a long pause.
- The first default-parallel full run hit the existing synthetic-seed 5s timeout;
  it passed independently. The full suite passes with two workers; no timeout,
  assertion, or test was disabled. Transport array validation uses Array.isArray
  plus exact expected length to avoid cross-context constructor matching.

Known limits: extremely large or unreadable message bodies remain explicitly
blocked under the existing reader contract; they are never silently acknowledged.
Source acknowledgements cannot independently prove a model's relevance decision.
The daily processing budget can produce PARTIAL with saved progress; it does not
guarantee all incoming volume can be classified in one invocation.

## Activation

Deploy this package before using the updated recurring/manual prompt files.
Refresh the Personal AI Workspace plugin's tool list explicitly after deployment;
changing the server alone does not refresh existing ChatGPT discovery snapshots.
Confirm workspace_next_mail_batch and workspace_ack_mail_batch are callable in
the task context. Preserve the existing daily schedule and both mailbox consents.
No production deployment, mailbox read, task edit or real database write was
performed during this development package. Existing uncommitted work is retained.
