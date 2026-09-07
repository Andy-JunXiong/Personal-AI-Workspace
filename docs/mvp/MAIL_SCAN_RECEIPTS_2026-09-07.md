# Durable daily application-mail scan receipts

## Subsequent acceptance and current scope

User refreshed the plugin to 27 tools and verified both Gmail accounts through Workspace. A one-off scheduled ping succeeded. The user then supplied MANUAL receipt `d483b9a3-e355-4367-8436-15b3943fd8a6`: PARTIAL for both mailboxes, saved/read back, zero new business writes and successful existing-evidence deduplication. Full coverage remains unverified. Jun subsequently limited lookback to seven days, normally yesterday/today. [Bounded resumption](MAIL_SCAN_RESUME_2026-09-07.md) is locally verified (269 tests, migration 010, 29 tools) but not deployed; current cloud release remains `gmail-mcp-20260907204200` with 27 tools. Historical configuration and release-time observations below are retained as evidence.

Status: deployed as `paw:scan-receipts-20260907192417` on 2026-09-07.
Local gate: 31 files / 254 tests, typecheck and production build pass.
The saved ChatGPT task still needs the updated instructions and new-tool access;
no actual scheduled run or synthetic production receipt was created.

## Deployment verification

- Initial backup before migration 009: `workspace-20260907T092447Z.db`.
- New image started healthy; all 17 prior business tables compared identically,
  migration 009 applied, integrity ok, compiled MCP discovery returned 24 tools,
  receipt read returned no runs, and read-only page rendering passed.
- A mistaken public `/healthz` probe returned 404 and triggered rollback to
  `detail-20260907171450`. That health endpoint is not exposed publicly. The old
  image ran successfully with additive migration 009 present.
- Corrected the public check to the real unauthenticated `/api/v1/session` 401
  boundary and redeployed the same application build. Second backup:
  `workspace-20260907T092552Z.db`. All 19 pre-retry business tables matched after
  startup; integrity, tools, receipt read and web rendering passed again.
- Final application count: 24. General browser writes remain false; Gmail remains
  enabled. The release does not include a browser dossier editing endpoint.
- Original SSH firewall was restored and temporary private access files removed.
- Rollback image retained: `paw:detail-20260907171450`.
- This conversation still exposes its older connector tool snapshot; service
  registration does not prove the saved task has refreshed its available tools.


## Continuity and benefits

- Upstream: [core workflow](../architecture/CORE_JOB_WORKFLOW.md) requires GPT
  operations, Workspace persistence and a reporting website. The prior task
  retained its scan coverage only in execution context, preventing the website
  from proving whether each mailbox had been checked.
- Current: dedicated scan ledger and successful mailbox checkpoints; three GPT
  tools; authenticated web read API; read-only panels on Today and Applications;
  updated [task instructions](UPDATE_JOB_TRACKER_WORKSPACE_PROMPT.txt).
- Downstream: deploy migration 009 and code, refresh connected-app tools, then
  replace the existing task instructions and verify one actual scheduled run.
  No new scheduler, model executor or browser write control was introduced.
- Short-term verified benefit: durable receipt/checkpoint readback survives
  database reopen; incomplete runs remain visible; failed sources do not advance
  coverage and cannot be presented as successful no-update checks.
- Long-term expected benefit: resumable incremental scanning and reportable
  ingestion history across conversations, with one durable Workspace ledger.

## Contract

`workspace_start_mail_scan`: stable client UUID runId, explicit standing authority,
triggerType SCHEDULED/MANUAL/UNKNOWN and actual executionReference (empty if not
exposed). Returns server start time, run and per-mailbox successful checkpoints.
Start before application writes. Reusing an ID never changes origin attribution.
SCHEDULED is GPT-reported attribution, not independent scheduler attestation.

`workspace_finish_mail_scan`: exact runId and authority, both distinct aliases,
COMPLETE/PARTIAL/FAILED per mailbox, searchedFrom, coveredThrough and failureReason,
plus newApplicationIds/evidenceIds/admittedTransitionIds/newTaskIds. Arrays must
contain unique actual Workspace-owned records created/admitted inside the run's
time window; registration's initial transition is excluded from state-change
counts. Counts are computed from referenced rows, never arbitrary numeric totals.
The caller must omit replays and verify writes. Timestamps establish membership
in the run interval; they do not independently prove which tool execution created
a record when scans overlap.

COMPLETE requires an explicit bounded range, no unresolved errors, and a cutoff
no later than the server's run start. New mail arriving during the run is handled
next time. Failed/partial mailboxes require a reason and null coveredThrough.
Previously covered ranges cannot be skipped; successful checkpoint updates are
monotonic. A first successful range is a bounded initial baseline, not a claim
of complete historical mailbox coverage. Finishing and checkpoint updates are
atomic. Exact finish retries return the saved result; changed retries conflict.
Recovery leaves uncompleted runs visible rather than inventing completion.

`workspace_get_mail_scans`: exact run by ID, or latest ten runs, all successful
mailbox checkpoints and total unfinished count. No writes and no scheduler/Gmail
side effects. Web GET `/api/v1/job-search/mail-scans` uses the same service and
authenticated Workspace identity. No scan-ledger browser POST endpoint exists;
service writes explicitly reject WEB request contexts.

The migration adds only mail_scan_runs and mail_scan_checkpoints. It does not
reuse recommendation_runs, change application lifecycle policy, or alter raw
Gmail messages. Both aliases are fixed in the task prompt; receipt payloads store
aliases rather than full mailbox addresses. Failure text should be minimal and
must not contain raw email content. Website text is escaped.

## Verification

- Full MCP transport: discover all 24 tools, begin, finish and read a synthetic
  receipt through the actual tool schemas.
- Restart: partial results and only the successful mailbox checkpoint survive.
- Concurrency/idempotency: gap rejection is atomic, exact finish replay has no
  writes, completed receipt changes conflict, older coverage cannot regress.
- Authority: missing user authority, WEB writers and other Workspace reads/writes
  rejected. Unknown/old result IDs rejected; real in-window rows counted.
- Reporting: empty, unfinished and failed states are truthful, text is escaped,
  and rendering produces no database writes or action controls.
- Migration: S2 data and existing migration history preserved; repeat migration
  and startup with old migration files work. Frozen S1-to-S2 regression tests now
  use an explicit 001–008 fixture directory, retaining their original assertions.
- Backup verification includes 009. Synthetic P6 fixture tool count changes from
  21 to 24; no fixtures were written to production.

## Activation order and remaining acceptance

1. DONE: backed up the cloud DB and deployed code with additive migration 009, preserving the
   current Gmail credentials, data and read-mode settings. Validate read-only
   health and the empty/new receipt view; no synthetic cloud records required.
2. Refresh Personal AI Workspace actions in the ChatGPT task context; verify
   workspace_start_mail_scan, workspace_finish_mail_scan and workspace_get_mail_scans
   are available. Local tool registration does not prove connector refresh.
3. Only then save the updated task prompt. Keep the existing daily schedule and
   verify Australia/Sydney. This session cannot edit that external task directly.
4. Run once with real evidence, retain the actual task-run reference if available,
   read back its exact receipt/checkpoints and compare website output. Report a
   manual test as MANUAL; unattended execution requires its own run evidence.

No full scheduled-run acceptance is claimed by passing local tests. The user's
previously saved task prompt still lacks these new calls until replaced.
