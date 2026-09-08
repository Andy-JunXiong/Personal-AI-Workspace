# Daily workflow recovery and acceptance

**Status:** BLOCKED BEFORE MANUAL ACCEPTANCE; scheduled acceptance pending.
**Last checked:** 2026-09-08, 19:48 Australia/Sydney (09:48 UTC).

## Continuity and benefits

The [core workflow](../architecture/CORE_JOB_WORKFLOW.md) requires daily GPT
ingestion, durable state and website readback. The [recovery record](JOB_TRACKER_RECOVERY_2026-09-08.md)
documents a reported platform refusal despite explicit approval. This procedure
consolidates the next engineering gate and records a fresh read-only ledger check.
It enables the prospective [v0.3 evaluation](../dogfood/M4_REAL_USE_EVALUATION_v0.3.md)
only after actual execution acceptance. The immediate benefit is a verifiable
definition of recovery; the expected long-term benefit is evidence of reliable
daily use. This documentation package performed no scan, deployment, business
mutation or task configuration change.

## Current evidence and blocker

Live `workspace_ping` returned an available database. Live
`workspace_get_mail_scans` returned one historical MANUAL/PARTIAL run from
September 7, zero checkpoints, zero processing streams and no unfinished runs.
The historical run's 30-day bounds are retained evidence, not today's policy.
This readback does not establish that every business table is unchanged or
re-verify the production image.

Both tasks remain paused according to the latest task readback in the recovery
record. This session has Workspace read tools but no ChatGPT scheduled-task
management or execution interface; task enablement was not independently fetched.
There is no new evidence that the reported host write block has cleared. The
[support report](JOB_TRACKER_PLATFORM_BLOCK_REPORT_2026-09-08.md) records the
existing escalation; no new support message was sent or reply fetched here.

The [backend receipt requirements](../architecture/MAIL_SCAN_BACKEND_LEDGER_REQUIREMENTS_2026-09-08.md)
now have a [locally verified opt-in implementation](../architecture/MAIL_SCAN_BACKEND_LEDGER.md).
Deployment-copy migration, deployment and actual hosted acceptance remain separate
gates; no production scan or task switch was performed in the implementation package. Renaming rejected writes, concealing
write effects in reads, or writing directly to the database is not a recovery
procedure. The successful Codex evidence-only trial proves neither ChatGPT
scheduled acceptance nor scan completion.

## Ordered acceptance gates

| Gate | Action and required evidence | Completion condition |
| --- | --- | --- |
| 1. Execution readiness | In the actual ChatGPT execution context, verify current tool discovery, both existing Gmail bindings, current image/contracts, saved policy and documented resolution or authorized investigation of the host refusal | Required calls are available and their declared write effects receive actual authorization; an error is recorded as a blocker |
| 2. Bounded manual scan | Use the existing [manual acceptance policy](UPDATE_JOB_TRACKER_MANUAL_ACCEPTANCE.txt), maximum seven days with fixed cutoff, bounded next/ack batches and stable source identities | Exact run readback shows honest per-mailbox scope/status; complete required ranges and verify every required business write before claiming manual acceptance |
| 3. Resume / retry | Use legitimate pending work or controlled synthetic evidence to verify persisted progress, deduplication and failure reporting; keep production historical receipts intact | No skipped unread items, false checkpoint advance or duplicated business records; PARTIAL remains PARTIAL until separately evidenced completion |
| 4. Real scheduled execution | After manual acceptance, use the existing replacement task and saved [daily policy](UPDATE_JOB_TRACKER_WORKSPACE_PROMPT.txt); preserve 08:00 Australia/Sydney and keep the obsolete task paused | An actual scheduler execution reference is correlated to its durable receipt, both mailbox results and independent business readback; a manual run cannot satisfy this gate |
| 5. Website and evaluation start | Independently read the shared stored results and coverage in the website; record actual release/policy baseline and acceptance exclusions in v0.3 | Website matches persisted results and distinguishes refresh from scan time; only then set the new prospective Day 1 |

Task configuration must follow existing task-management authority and acceptance
conditions. This procedure itself does not activate a schedule. If completion
requires bounded resumption, preserve each partial receipt and link the final
verified coverage; elapsed time or a quiet task output is not completion.

For each attempt, retain a private exact run/execution reference and sanitized
public evidence: time/timezone, trigger, image/policy version, both mailbox
ranges, pagination/body/ack status, excluded older work, created versus replayed
record counts, checkpoint readback, website result and precise failure stage.
Zero relevant changes is acceptable only after required source processing is
complete. Manual per-application checks cannot advance global daily coverage.

## Engineering order

1. Resolve the actual ChatGPT authorization/execution blocker and execute gates
   1–4. Existing tests and Codex connectivity do not resolve a host-context failure.
2. Design and implement backend-owned receipts under the existing requirements
   as a declared-write, compatible service change. Its platform acceptance remains
   a separate gate; no receipt redesign is presumed to fix the host refusal.
3. The locally verified [manual-check diagnostics/filtering](MAIL_CHECK_DIAGNOSTICS_2026-09-08.md)
   can improve the secondary website check after deployment and live-mail
   validation. It is not a prerequisite or substitute for ChatGPT daily acceptance.
4. After acceptance, measure sustained scheduled operation and utility under
   v0.3. Defer unrelated UI expansion and shared infrastructure extraction.

## Attempt ledger

| Time (Sydney) | Check | Result | Next dependency |
| --- | --- | --- | --- |
| 2026-09-08 19:48 | Live service and scan-ledger reads from Codex | Service available; one historical PARTIAL run, no checkpoints or processing streams | Actual ChatGPT host recovery and execution access; manual/scheduled gates remain pending |
