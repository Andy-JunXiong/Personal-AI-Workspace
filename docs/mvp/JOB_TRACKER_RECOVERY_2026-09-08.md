# Job Tracker recovery — 2026-09-08

Status: production upgrade and plugin refresh passed. Manual acceptance did not execute; the ChatGPT conversation reported a platform safety block at scan creation. Actual scheduled-run acceptance remains pending; automation is not restored.

Subsequent release: [mail ingestion alignment](MAIL_INGESTION_ALIGNMENT_2026-09-08.md)
first shipped as `mail-ingestion-20260908-r1`, migration 011. Current production
is `mail-layout-20260908-r2`; see the [final release handoff](RELEASE_HANDOFF_2026-09-08.md).
Its website-only
single-application acceptance saved evidence but returned PARTIAL; it did not
retry the blocked ChatGPT call or restore either paused schedule. Release details
below preserve the earlier migration 010 recovery evidence.

## Continuity and benefits

- Upstream: today's missing-Workspace report and the user's authorization to deploy, refresh, repair scheduling and verify receipts. Follow the [core workflow](../architecture/CORE_JOB_WORKFLOW.md) and [seven-day resumption contract](MAIL_SCAN_RESUME_2026-09-07.md).
- Current: deployed durable batches and migration 010, verified data preservation, refreshed tool discovery; repair the incompatible task context without duplicate scanners.
- Downstream: manual and actual scheduled processing/readback must pass before declaring daily 08:00 Australia/Sydney restored.
- Verified short-term benefits: 277 tests pass; 19 business tables preserved; both mailbox identities and 29 tools live.
- Expected long-term benefit: acknowledged processing survives interruptions; receipts distinguish partial coverage from completed no-change scans.

## Production release evidence

- Lightsail paw-mvp, ap-southeast-2; active image `paw:mail-batch-20260908-r2`, SHA-256 `221d769cd9916cf7557813f6f41012076346de35c498a60f7401ae7dd8280b3d`.
- Source staging `/opt/paw-mail-batch-20260908`; old `/opt/paw` and `paw:gmail-mcp-20260907204200` retained. Shared Compose project, persistent data, active-image tag, private MCP and read-only website settings preserved.
- Pre-cutover backup `/srv/paw/backups/workspace-20260907T230439Z.db`, integrity OK, migrations 001–009. Rehearsal backup `workspace-20260907T225757Z.db`.
- Database-copy upgrade, candidate restart and old-image startup on upgraded copy passed. Baseline 24 tables / 226 rows; 19 business tables unchanged and four new queue tables empty.
- Live migration verification passed for exactly `010_mail_scan_batches.sql`. Live read-only MCP probe passed: 29 tools, database available, both identities AVAILABLE, historical MANUAL/PARTIAL retained, unfinished=0, streams=0 before acceptance. Probe executes no scan.
- External `npm.cmd run web:check -- --origin https://workspace.ai-radar-lab.com --writes off` passed all five checks.
- Plugin Refresh completed with “操作已刷新”; settings show `workspace_next_mail_batch` and `workspace_ack_mail_batch`.

## Access and release diagnostics

Direct SSH timed out; temporary /32 access was removed and original firewall rules verified. Temporary SSH credentials deleted. User signed into AWS; browser SSH completed deployment.

Source-only archive SHA-256 `2D9E95FE672C94B2D2B955D4E36A4650EC78D7A0068872AE0F4B94C43CE43697`, excluding credentials, databases, node_modules and Git history. Large terminal paste truncated; private temporary S3 object and short-lived URL transferred the archive with exact hash verification. Object and local URL file deleted; bucket security unchanged.

First candidate exposed extraction permissions from umask 077: container user could not read migrations. Source permissions corrected before immutable r2 build. Rehearsal retains failed probe containers for bounded diagnostic logs and explicitly removes healthy stopped probes; cleanup remains.

## Task context and policy

- Original task `6a96859d64fc81918dda300e7262b74e`: paused, daily 08:00 Australia/Sydney, exact_schedule; last run `2026-09-07T22:00:14.212123Z`. [Original conversation](https://chatgpt.com/c/6a96814a-0c00-83ec-a456-8e2b52083a00) linked by task UI. Saved policy still has old 30-day rule.
- Selecting plugin there exposed definitions, but actual ping/receipt/account calls returned `FORBIDDEN: This conversation does not support developer MCPs`. Refresh alone cannot repair this restriction.
- [Working conversation](https://chatgpt.com/c/6a9e952f-e428-83ec-bd86-c1ee823531b9) called live ping and read scheduler settings. Update schema has no conversation rebinding field; replacement required, original remains paused as history.
- [Complete policy](UPDATE_JOB_TRACKER_WORKSPACE_PROMPT.txt) now prohibits scan executions from changing schedules. Missing tools stop that execution and report failure; scheduler repair here has separate user authorization.
- Manual acceptance: one RECENT batch per mailbox, limit 3, at most six messages, honest PARTIAL receipt, no BACKFILL. A placeholder all-zero ack request was rejected before execution and corrected to require actual returned IDs.

## Local validation

- Full `npm.cmd run verify -- --maxWorkers=2`: 34 files / 277 tests, typecheck/build pass. Argument reached build rather than Vitest; test run used default workers.
- Read-only `deploy/cloud/mail-batch-cloud-smoke.mjs` syntax check passed.
- Rehearsal diagnostic correction: all 11 cloud deployment unit tests pass.
- Existing uncommitted additive-migration verifier and eight tests retained. No Git commit/push.

## Remaining acceptance

The user subsequently replied “重新发起”, explicitly authorizing another manual
acceptance attempt (at most six messages) and confirmation of the corresponding
Workspace write approval prompts. The retry completed without a scan: account
and receipt prechecks succeeded, but one `workspace_start_mail_scan` call for
`e117d305-c3e2-4c5f-a1c3-a4dcb878ede4` returned the exact platform error:
“此工具调用被 OpenAI 的安全检查屏蔽。请仔细检查你发送的内容。” No approval
entry or more specific error code was exposed. Independent connector readback
for that exact run returned `NOT_FOUND: Run not found`. No batch was acquired,
mail read, acknowledgement saved or business record changed. Scheduling remains
paused. Repeated user authorization did not resolve the platform block; do not
repeat the same approval request or treat another route as authorization to
bypass this rejection. Platform rejection diagnosis remains the next gate.

Replacement task `6a9f456860248191b81d0361dd42cad3` is saved with title Update Job Tracker, daily 08:00 Australia/Sydney, exact_schedule, first planned point September 9, is_enabled=false and last_run_time=null. Original task is renamed Update Job Tracker — 旧环境已停用 and remains paused. Both paused states were independently confirmed in the scheduler UI. The saved replacement prompt is 13,638 characters and exactly matches the local 13,688-character file after CRLF normalization and trimming. No scan-specific six-message limit or setup instructions were included. No active Job Tracker exists yet.

The working chat reported two blocked `workspace_start_mail_scan` attempts for proposed run `1f8db2d2-69ac-4871-8a3e-0907ae4deb0b`. Subsequent read-only diagnosis could not recover an exact error/code/message or an authorization link, so the specific cause is unverified. The previously visible suspicious-instructions alert belonged to the rejected placeholder ack; do not attribute it to scan creation without evidence.

Independent Workspace readback still shows only historical receipt `d483b9a3-e355-4367-8436-15b3943fd8a6`, unfinished=0 and processing.streams=[]. No new scan, source processing or business records resulted. Do not route around the reported safety block through the server or a scheduled execution. Prepare the replacement paused; resolve authorization before manual and actual scheduled acceptance.

After authorization is resolved: record exact manual receipt/progress, verify an actual scheduled replacement run with complete policy, then enable the same replacement ID daily 08:00 Australia/Sydney and read back settings. Manual success or PARTIAL is not full seven-day coverage.

## Platform block investigation

Read-only Plugin Management inspection of app
`asdk_app_6a96f6b223848191944d51276294344e` confirmed:

- Global permission: **Allow low-risk actions**. The tool describes this mode as
  automatically approving low-risk actions while potentially denying actions
  involving sensitive information.
- App override: **Use my default**. Workspace inherits that global mode.
- Thus conversational consent does not itself change the saved approval mode.
  Automatic review is a plausible explanation for the absence of an approval
  card, but the generic rejection does not establish the exact classifier cause.

The local start handler only validates five inputs and inserts/replays a scan
receipt; it does not read Gmail or start scheduling. Its annotations correctly
declare write=true (`readOnlyHint=false`), destructive=false, openWorld=false and
idempotent=true. Error formatting produces structured Workspace error codes,
not the reported Chinese OpenAI safety-check message. Existing transport tests
already exercised start/finish/readback in the successful full release suite.
No code defect explaining this platform message was found; no metadata or
authorization validation was weakened to influence the safety check.

The expanded browser tool-call list exposed resource discovery, account reads
and scan reads, but no inspectable start-call payload. The exact start parameters
must not be claimed verified from that UI. No per-request server arrival log was
collected, so database absence alone is not proof that no HTTP request arrived.

A follow-up in the same ChatGPT conversation explicitly requested the original
five-parameter input and response without reconstructing them. The conversation
could recover neither payload; only its earlier user-visible error report and
the proposed runId remain. Therefore the quoted Chinese error is a recorded
ChatGPT report, not a newly inspected raw response. Exact request correctness,
the specific platform classifier and the cause of its decision remain unproven.

The proposed diagnostic option was a **Workspace-only** override to
**Allow read actions / ask before writes**, followed by one manually approved
acceptance attempt. This is a different saved permission mode, requires the
user's explicit selection; its subsequent execution is recorded below. It is not guaranteed to
resolve other platform checks and is not unattended scheduled-run acceptance.
If the same block persists, provide this evidence to platform support rather
than repeatedly asking the user to authorize the same scan.

Official references: [developer mode confirmation behavior](https://developers.openai.com/api/docs/guides/developer-mode)
and [plugin troubleshooting escalation](https://developers.openai.com/plugins/deploy/troubleshooting).

## User-approved permission diagnostic

The user explicitly approved the proposed Workspace-only mode change. Plugin
Management updated the app override to `ask_before_writes`; independent readback
confirmed **Allow read actions**, asking before changes. The global default
remains **Allow low-risk actions**. The browser conversation was refreshed.

Manual acceptance is staged so the exact start payload is reviewable before any
source acquisition: runId `e5346d69-6937-4f90-ae21-f50176834297`,
`userConfirmed=true`, the standing authority reference,
`triggerType=MANUAL`, `executionReference=""`. Only one start call and readback
were requested initially. No mail batch or scheduler change is requested in
that first step.

The browser displayed an actual start-call approval card. Its details showed
all five exact parameters above; **Allow once** was selected, not Always allow.
ChatGPT then reported the same safety-check block. Independent connector readback
for the exact UUID returned `NOT_FOUND: Run not found`. No batch was acquired,
mail read, business data changed or new receipt persisted. Post-attempt permission
inspection still confirms ask-before-writes and an unchanged global default.

This disproves the hypothesis that changing approval mode alone is sufficient.
The exact classifier cause remains unavailable. The chat's claim that there was
no approval card conflicts with direct browser observation; use the browser
evidence for the confirmation step. A [platform report](JOB_TRACKER_PLATFORM_BLOCK_REPORT_2026-09-08.md)
was prepared locally. The user then authorized submission; the report and
follow-up were sent through OpenAI Help Center, and the UI confirmed escalation
to a support specialist with an expected response in the coming days, also by
email. No numeric case ID was displayed. The linked public report summarizes the
submission; raw support messages and screenshots are retained locally and excluded
from Git. No further bypass or retry was attempted.

## User-authorized restart check — September 8, 17:26 Sydney

The user explicitly requested another check before restarting daily Job Tracker.
The existing task conversation was used for one new manual attempt; no alternate
write route or scheduled execution was used after its rejection.

Before the attempt, the replacement's instructions were updated in the scheduler
editor to the latest `UPDATE_JOB_TRACKER_WORKSPACE_PROMPT.txt`, including copying
the reader's exact account-qualified externalId and preserving uncertain legacy
identities. Reopening the editor confirmed exact equality after LF normalization
and trimming (13,936 characters). The existing daily 08:00 schedule remained;
both the replacement and the retired task were verified paused afterward.
This supersedes the earlier statement that the latest local policy was not saved
online. It does not establish unattended scheduling acceptance.

Independent connector reads confirmed the database available, both expected
mailboxes AVAILABLE, only the historical PARTIAL receipt, no unfinished runs and
empty processing streams. This Codex tool catalog exposed 27 Workspace tools,
without next/ack batch tools; the actual ChatGPT task conversation separately
reported all five required scan/batch tools available. Neither context's discovery
should be generalized to the other.

The manual attempt used runId `1eccccb0-9986-494b-80f1-19e44fa41246`,
`userConfirmed=true`, the existing September 7 authority reference,
`triggerType=MANUAL` and `executionReference=""`. ChatGPT reported one start call
and the same platform safety-check error. No approval card was observed in this
attempt. The tool list exposed scan readback; a separate raw start error payload
and specific classifier reason were not recovered. Therefore the error wording
remains a ChatGPT-reported result, not independently inspected platform internals.

Independent exact-run connector readback returned `NOT_FOUND: Run not found`.
No mail batches, acknowledgements or business changes were attempted in this
check. The daily tasks were not resumed. The next gate remains platform write
recovery, then bounded manual and actual scheduled acceptance. The website-only
diagnostics/filtering code does not remove this platform restriction.
