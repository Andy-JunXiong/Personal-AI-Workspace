# ChatGPT M2 Platform Evaluation

**Current status:** BLOCKED - M2 CREATE-TASK PLATFORM GATE FAILED / DEFECT FOUND

The first M2-A run created and returned an ACTIVE/APPLIED Project but the next
manual Task creation reported that Project as not found. Do not continue
M2-A, M2-B, M2-C, M3, or tagging from that run. Preserve the failed database
and evidence. After the server-side invariant fix is deployed, start again at
the preconditions with a fresh external database and a refreshed ChatGPT
development connection.

Automated/local evidence and manual ChatGPT platform evidence are separate.
Run this evaluation against a fresh external SQLite database under the verified
`PAW_DB_PATH` boundary with `PAW_TIME_ZONE=Australia/Sydney`. Use only the
synthetic names below. Do not reuse or modify M1 or Spike result evidence.

## Preconditions

1. Start the committed M2 baseline against a fresh database outside the
   repository and OneDrive.
2. Refresh the ChatGPT development connection and confirm MCP discovery shows
   12 tools.
3. Immediately before M2-A, record the current Australia/Sydney calendar date,
   local time, and UTC offset. Materialize the three timestamp tokens below as
   explicit ISO 8601 timestamps with the offset applicable to each instant.
4. Begin the fixture run before `DUE_TODAY_AT`. If Sydney local time has reached
   or passed 23:30, defer until after the next local midnight and recompute all
   three timestamps. Do not substitute a relative phrase.
5. Preserve the materialized prompts, structured results, database, and
   sanitized server log as the platform evidence.

## Canonical absolute-time fixture

Before sending any fixture prompt, replace every token in the prompts with the
materialized value for that run:

```text
TEST_DATE            = current Australia/Sydney YYYY-MM-DD
OVERDUE_AT            = previous Sydney date at 17:00:00 with explicit offset
DUE_TODAY_AT          = TEST_DATE at 23:30:00 with explicit offset
UPCOMING_PLUS_7_AT    = TEST_DATE + 7 calendar days at 09:00:00 with explicit offset
```

For the planned canonical run on 2 September 2026, the materialized values are:

```text
TEST_DATE             = 2026-09-02
OVERDUE_AT             = 2026-09-01T17:00:00+10:00
DUE_TODAY_AT           = 2026-09-02T23:30:00+10:00
UPCOMING_PLUS_7_AT     = 2026-09-09T09:00:00+10:00
```

The prompts below are materialized for that planned run. If the actual test
date differs, update all three explicit timestamp strings in a preserved copy
of the prompts immediately before execution. The canonical evidence must
contain the resulting absolute timestamp strings,
not `yesterday`, `today at 5pm`, `seven days from today`, or unresolved tokens.
The user-facing text may explain their human meaning after giving the exact
timestamp.

## M2-A — Daily Attention

This is the primary M2 product-value checkpoint. Send each materialized quoted
prompt as a separate user turn in one ChatGPT conversation.

1. "Use Personal AI Workspace and call `workspace_ping`. Tell me whether the
   durable Workspace database is available."

2. "I explicitly authorize you to register a synthetic active Job Application
   for company `M2 Smoke Co` and role `Platform Engineer`."

3. "I explicitly want you to create a HIGH-priority, undated FOLLOW_UP Task on
   the `M2 Smoke Co — Platform Engineer` application titled `Send M2 follow-up`.
   Create exactly one Task."

4. "I explicitly want you to create an OTHER Task on `M2 Smoke Co — Platform
   Engineer` titled `M2 overdue`, priority LOW, with exact dueAt
   `2026-09-01T17:00:00+10:00` (the prior Sydney day at 5:00 PM)."

5. "I explicitly want you to create an OTHER Task on `M2 Smoke Co — Platform
   Engineer` titled `M2 due today`, priority MEDIUM, with exact dueAt
   `2026-09-02T23:30:00+10:00` (11:30 PM on the recorded Sydney test date)."

6. "I explicitly want you to create an OTHER Task on `M2 Smoke Co — Platform
   Engineer` titled `M2 upcoming seven`, priority LOW, with exact dueAt
   `2026-09-09T09:00:00+10:00` (9:00 AM on Sydney calendar date plus seven)."

7. "I explicitly want you to create an OTHER Task on `M2 Smoke Co — Platform
   Engineer` titled `M2 blocked`, priority MEDIUM, with no due date, and then
   update that same Task to BLOCKED."

8. "I explicitly authorize you to register a second synthetic active Job
   Application for company `M2 Gap Co` and role `Data Analyst`. Do not create a
   Task for it."

9. "Call `workspace_get_today`. Explain the structured result exactly as
   Workspace classified and ordered it; do not rescore, reorder, scan Gmail or
   Calendar, or infer urgency. Identify `M2 overdue` as OVERDUE, `M2 due today`
   as DUE_TODAY, `Send M2 follow-up` as HIGH_PRIORITY, `M2 blocked` as BLOCKED,
   `M2 upcoming seven` in `upcoming`, `M2 Gap Co — Data Analyst` in
   `applicationsWithoutOpenTask`, and the admitted application creations in
   `recentLifecycleChanges`."

### M2-A expected evidence

- The synthetic `M2 Smoke Co — Platform Engineer` application is created.
- `attention` demonstrates `OVERDUE`, `DUE_TODAY`, `HIGH_PRIORITY`, and
  `BLOCKED` using only the explicit fixtures.
- `upcoming` contains the exact +7-calendar-day Task.
- `applicationsWithoutOpenTask` contains `M2 Gap Co — Data Analyst` as a gap
  signal, not an error.
- `recentLifecycleChanges` contains recent admitted application creation
  changes.
- The result date equals `TEST_DATE`, the timezone is `Australia/Sydney`, and
  ChatGPT preserves Workspace classification and ordering.

Do not proceed to M2-B if any fixture timestamp sent to a tool differs from the
materialized absolute value or any expected classification is absent.

## M2-B — Task Mutation Integrity

Continue in the M2-A conversation so ChatGPT may use the Task identity and
versions returned by the preceding Workspace operations.

1. "I explicitly want you to update `Send M2 follow-up` from TODO to
   IN_PROGRESS using its current `recordVersion`. Report the previous and new
   versions from the structured result."

2. "Attempt to update `Send M2 follow-up` to CRITICAL using stale
   `expectedRecordVersion = 1`. This is an intentional concurrency test. Do
   not retry with a newer version and do not perform another mutation."

3. "I explicitly want you to mark the IN_PROGRESS `Send M2 follow-up` Task DONE
   using its current version. From the structured update result, report the
   status, previous and new `recordVersion`, and `completedAt`. Then read the
   Project and confirm the completed Task is absent from `openTasks`."

4. "Attempt to update that same DONE `Send M2 follow-up` Task to IN_PROGRESS
   using its current version. This is an intentional terminal-state test. Do
   not create a replacement Task and do not retry."

### M2-B expected evidence

- `TODO -> IN_PROGRESS` succeeds and increments `recordVersion` from 1 to 2.
- The stale version-1 command returns `CONCURRENCY_CONFLICT` with no write.
- `IN_PROGRESS -> DONE` succeeds at the current version, increments the version
  once, and sets `completedAt`.
- The completed Task is absent from `workspace_get_project.openTasks`.
- `DONE -> IN_PROGRESS` returns `VALIDATION_ERROR` with no write.
- No replacement Task is created.

## M2-C — Determinism and cross-conversation read

Start a new ChatGPT conversation connected to the same committed Workspace and
database. Do not paste, summarize, or reconstruct the M2-A/B conversation.

1. "Without reconstructing any previous conversation, call
   `workspace_get_today` from durable Personal AI Workspace state. Report its
   date, timezone, ordered attention reasons, upcoming Tasks,
   applications-without-open-Task gaps, and recent lifecycle changes. Confirm
   that the completed `Send M2 follow-up` Task is absent. Do not perform any
   mutation."

2. "Call `workspace_get_today` two more times with no mutation between or after
   the calls. Compare the structured results with each other and with the prior
   call in this conversation. Confirm identical classification and ordering,
   and confirm `Send M2 follow-up` remains absent. Do not perform any write."

### M2-C expected evidence

- Durable state is read successfully without prior-conversation reconstruction.
- All three `workspace_get_today` results are identical while state, timezone,
  and local date are unchanged.
- Classification and ordering are unchanged.
- The completed Task remains absent.
- No write tool is called.

## Global negative-scope checks

Across M2-A, M2-B, and M2-C:

- each mutation is attributable to explicit user intent and uses an
  idempotency key;
- no Gmail or Calendar scan occurs;
- no LLM ranking, reminder, scheduler, stale heuristic, UI, notification, or
  background processing is introduced or invoked; and
- no M3 lifecycle behavior is invoked.

## Decision recording

Record M2-A, M2-B, and M2-C separately as `SUPPORTED`, `NOT SUPPORTED`, or
`INCONCLUSIVE`, with the materialized prompt timestamps, relevant structured
results, and sanitized server-log evidence. M2 platform verification is
complete only when all three checkpoints and every global negative-scope check
are supported. Do not tag M2 as verified from local evidence alone.
