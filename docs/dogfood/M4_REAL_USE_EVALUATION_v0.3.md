# M4 Integrated Workflow Evaluation v0.3

**Decision date:** 2026-09-08 (Australia/Sydney).
**Status:** ADOPTED PROTOCOL; NOT STARTED — operational prerequisites pending.
**Authority:** User approved the review follow-up and the recommendation to retire
the frozen evaluation and define a prospective replacement.

## Continuity and benefits

The [core workflow](../architecture/CORE_JOB_WORKFLOW.md) and
[deployed release](../mvp/RELEASE_HANDOFF_2026-09-08.md) have outgrown the frozen
12-tool experiment. This package retires that experiment's active applicability,
preserves its evidence and defines a future evaluation of the integrated workflow.
It enables an auditable start after [daily acceptance](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md).
The immediate benefit is an explicit separation of historical results, deployment
and utility claims. The expected long-term benefit is a reproducible investment
decision based on observed use. This document changes no runtime, tool authority,
mailbox access, production configuration or schedule.

## Retirement of the frozen evaluation

[v0.1](M4_DOGFOOD_PLAN_v0.1.md) and [v0.2](M4_REAL_USE_EVALUATION_v0.2.md)
are retired as active evaluation contracts on this decision date. The original
text, dates, thresholds, [Day 0 result](M4_DAY0_RESULTS_v0.1.md) and
[Day 1 ledger](M4_DAILY_LOG_v0.1.md) remain historical evidence.

The September 5 [S1 exception](../mvp/S1_LOCAL_SCOPE_DECISION_2026-09-05.md)
only authorized local development while preserving the deployed M4 boundary.
Later production UI, migrations and ingestion exceeded that experimental
boundary. Their delivery authorizations do not establish experimental isolation.
This decision records the discrepancy now; it does not backdate a broader exception
or claim that the original freeze was maintained.

The old September 10/17 and October 1 gates are no longer pending decisions under
an active frozen trial. Record the experiment as **RETIRED — BOUNDARY CHANGED;
adoption and utility not established**, not PASS, STOP, or a retrospective rescore.
Day 0/1 safety and readback results retain their original limited meaning. Missing
observations stay missing. Later manual writes, deployments and platform failures
must not be mixed into the old denominator or represented as its completion.

## Evaluation boundary

Evaluate the actual integrated product: daily ChatGPT processing of both Gmail
accounts, authorized interactive ChatGPT operations, the shared Workspace database,
and the reporting website with existing explicit per-application mail checks.
Candidate/recommendation features present at baseline are recorded, but their
existence alone is not evidence that the daily Job Tracker loop delivers utility.

The baseline must identify the deployed image and source revision, migrations,
discovered tool contracts, browser operation flags, saved recurring policy version,
account binding availability, schedule/timezone, and known incomplete features.
The release currently documented is `mail-layout-20260908-r2`, migrations 001–011,
29 tools; the actual baseline must be verified at activation.

Backend-owned receipts remain [unimplemented requirements](../architecture/MAIL_SCAN_BACKEND_LEDGER_REQUIREMENTS_2026-09-08.md).
Local diagnostics remain [undeployed](../mvp/MAIL_CHECK_DIAGNOSTICS_2026-09-08.md).
If either ships before activation, record it in the baseline. Website checks
cannot stand in for full-mailbox daily coverage. Other domains, full intelligence
ledger implementation and a replacement scheduler are outside this evaluation.

After activation, fix correctness, availability, security and privacy blockers
with versioned evidence. A material feature, policy, model/executor or source-scope
change requires an explicit amendment before use: close the affected cohort and
define a new prospective one. Never pool cohorts silently or edit observed scores.

## Activation and calendar

Start only after the bounded manual gate and one real scheduled execution pass
the daily acceptance procedure. Capture their evidence separately as acceptance
fixtures; they do not count toward prospective adoption or utility.

Record the baseline and start date below before Day 1. Day 1 is the next Sydney
calendar day after prerequisites are accepted; Day 7/14/28 are start date plus
6/13/27 days. This is a new 28-day observation window, not an extension of v0.2.
No start date or successful acceptance is implied by adoption of this document.

| Activation field | Value |
| --- | --- |
| Manual / scheduled gate evidence | PENDING |
| Image, revision, migrations, tool/policy versions, flags | PENDING |
| Both account bindings and daily 08:00 Australia/Sydney schedule verified | PENDING |
| Excluded acceptance runs and known limitations | PENDING |
| Day 1 / Day 7 / Day 14 / Day 28 dates | NOT STARTED |

## Prospective evidence

Reuse v0.2's real-event definition and next-session-or-24-hour capture deadline.
Log every known eligible event, including bypassed events. Tag capture entry as
`SCHEDULED`, `INTERACTIVE`, or `WEB_MANUAL`; count a source event once across
retries, overlap and entries. Historical import, synthetic acceptance, readback,
irrelevant messages and duplicate evidence do not create eligible events.
Uncertain eligibility or an unknown denominator must be explicit; do not assume
unread mail contains no eligible events.

Report aggregate capture compliance and separate counts by entry. Measure active
human effort for captured events and daily maintenance/recovery work separately;
automation can have zero active capture time, but repair time cannot disappear.
Keep the original median two-minute capture threshold and the user's assessment
of total maintenance burden. v0.3 results are not directly comparable to the
manual-only frozen cohort.

Daily records include expected/observed scheduled executions, per-mailbox range
and status, pending/excluded work, successful checkpoint readback, human recovery
minutes, corrections and bypass reasons. PARTIAL is honest progress, not complete
coverage. A verified empty complete scan can pass; creating business records is
not required when no relevant event exists.

Record fresh-conversation recovery attempts, structural exactness, avoided user
recaps, and whether each non-empty Today session led to a useful next action.
Use sanitized event keys and aggregate counts, never mail bodies, companies,
roles, source message IDs, credentials or private object IDs in public logs.

Append prospective entries below or link an indexed sanitized ledger before use:

| Date / day | Expected / observed schedules | Mailbox scope and result | Pending / excluded | Maintenance minutes | Corrections |
| --- | --- | --- | --- | --- | --- |

| Event key / date | Eligibility | Entry / captured by deadline | Bypass reason | Active capture minutes / approval turns | Correction |
| --- | --- | --- | --- | --- | --- |

| Date | Recovery exact / attempts | Recaps avoided | Actionable / non-empty Today sessions | Unexplained mismatch |
| --- | --- | --- | --- | --- |

No entries yet. User-reported effort and eligibility must be marked as such;
independent database readback establishes stored state, not unseen user behavior.

## Decisions

- **Day 7 operational:** seven expected daily executions must have durable evidence,
  without manual substitution. Each daily RECENT window for both mailboxes must
  complete within 24 hours of its scheduled start. Bounded resumption may finish a
  PARTIAL run; link its later evidence without rewriting the original receipt.
  Report remaining seven-day backfill separately; never infer full coverage from
  RECENT alone. Require no data loss, unauthorized mutation, duplicate business
  records from retries, or unexplained readback mismatch. Any failed condition
  means operational FAIL and blocks a Day 28 CONTINUE claim.
- **Day 14 adoption:** apply the original v0.2 PASS/REVISE/STOP thresholds to this
  new cohort: at least five events, at least 80% capture, median active capture
  effort at most two minutes, and no three consecutive FRICTION/TRUST bypasses
  for PASS. Below 50% capture, more FRICTION/TRUST bypasses than captures, or three
  such consecutive bypasses means STOP once at least five events exist. Otherwise
  REVISE. With fewer than five events, INSUFFICIENT_SAMPLE; evaluate on the fifth
  event or Day 28, whichever comes first. There is no extension.
- **Day 28 utility:** CONTINUE requires operational PASS, adoption PASS, at least
  three fresh-conversation recoveries with at least 90% structurally exact and
  no unexplained mismatch, corrections at most 10% of captured events, no safety
  failure, acceptable total capture/maintenance burden reported by the user, and
  either at least two avoided recaps or at least 50% actionability across five
  or more non-empty Today sessions. Continued scheduled operation must remain
  evidenced; a later unresolved outage prevents CONTINUE. All other outcomes are
  STOP, except one bounded usability defect may support REVISE when safety,
  operational, adoption and recovery gates pass and only utility narrowly fails.
  Insufficient evidence cannot yield CONTINUE. REVISE proposes a separately
  authorized future experiment; it does not extend this window.

Data loss, unauthorized mutation, source-of-truth corruption or a privacy breach
triggers an immediate safety stop under the existing operating procedures.
Missing schedules and platform refusals are availability evidence, not user
adoption failures. Diagnose them explicitly; do not alter dates or exclude them
after seeing results.
