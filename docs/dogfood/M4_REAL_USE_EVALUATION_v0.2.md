# M4 Prospective Real-Use Evaluation Addendum v0.2

**Status:** LOCKED BEFORE DAY 2

**Adopted:** 2026-09-04, after the Day 1 operational evidence was complete

## Purpose and authority

This addendum measures whether the frozen MVP creates enough personal utility
to justify its capture and maintenance cost. It does not replace or weaken
[`M4_DOGFOOD_PLAN_v0.1.md`](M4_DOGFOOD_PLAN_v0.1.md).

The original seven-day plan remains authoritative for the operational gate.
This addendum applies prospectively from Day 2. Day 1 import activity and its
scripted cross-conversation readback remain valid operational evidence but do
not count toward adoption or utility thresholds below. Thresholds must not be
changed after Day 2 begins.

The fixed local-date gates are:

| Gate | Local date | Question |
| --- | --- | --- |
| Day 7 operational | 2026-09-10 | Did the frozen system operate safely and reliably for seven days? |
| Day 14 adoption | 2026-09-17 | Does the user naturally keep real work in Workspace? |
| Day 28 utility | 2026-10-01 | Does Workspace create enough daily value to justify its cost? |

An immediate stop condition in the original plan overrides every scheduled
gate.

## Frozen evaluation boundary

The feature freeze continues through the Day 28 decision.

Permitted changes are limited to defects that block real use or threaten
correctness: data loss, incorrect lifecycle behavior, broken MCP behavior,
security or privacy defects, and failures that make the frozen surface
unavailable. Every such change must preserve the original observation in the
log and receive its own verification.

Convenience or expansion work is prohibited during the evaluation, including
automatic Gmail ingestion, dashboards, smarter Today ranking, notifications,
a UI, a second domain, a generic Goal model, new tools, and schema expansion.
The Day 28 date does not move because of a usability defect. A safety stop may
end the evaluation early.

## Prospective event definition

An eligible event is a new real-world or user-decided change after this
addendum takes effect that reasonably requires Workspace state to be created
or updated. Eligible events include:

- a new Job Application;
- a registration metadata change;
- new external evidence relevant to an Application;
- an Application lifecycle change; or
- an explicit Application Task creation, status change, or completion.

One real event counts once even if Workspace requires multiple MCP commands.
Retries, verification reads, Today reads, scripted tests, historical backfill,
and information intentionally judged irrelevant before capture are not
eligible events.

An eligible event is `CAPTURED` when the authoritative Workspace state reflects
it by the end of the next intentional job-search session or within 24 hours,
whichever comes first. It is `BYPASSED` when the user knowingly handles it in
chat, notes, email, or memory without Workspace by that cutoff. Only a
sanitized bypass reason is logged: `FRICTION`, `TRUST`, `FORGOT`,
`UNAVAILABLE`, or `OTHER`.

## Five locked metrics

### 1. Capture compliance

```text
capture compliance = captured eligible events / all eligible events
```

The denominator comes from the prospective sanitized event ledger, including
bypassed events. Day 1 historical import is excluded.

### 2. Capture friction

For every captured event, record only user-visible effort:

- active elapsed-time band: `<1m`, `1-2m`, `3-5m`, or `>5m`; and
- extra clarification or approval turns after the user's initial instruction.

Internal MCP calls, retries invisible to the user, and automated readback do
not count as user effort.

### 3. Recovery value

A recovery attempt starts in a fresh ChatGPT conversation without reconstructing
prior chat. It is structurally exact only when authoritative comparison
confirms all of the following for the selected Application scope:

- the correct Project is resolved;
- lifecycle state and lifecycle version match;
- the open-Task set matches; and
- active or closed status matches.

Record whether the recovery avoided a user recap. Do not record the Project,
company, role, Task title, or other real content in Git.

### 4. Today actionability

The denominator is one distinct daily Today session with at least one surfaced
item. A session is actionable only if it directly leads during the same local
day to one of `FOLLOW_UP`, `APPLICATION`, `TASK_COMPLETION`,
`LIFECYCLE_CHECK`, or `PRIORITY_CHANGE`.

Opening Today, rereading it, or running another query does not count as an
action. Multiple resulting actions still count as one actionable session.

```text
Today actionability = actionable non-empty Today sessions /
                      all non-empty Today sessions
```

### 5. Correction and reconciliation

A correction is counted when stored or retrieved Workspace state must be
changed solely because the prior Workspace representation was wrong, omitted,
or duplicated. A new real event is not a correction. Record the count and
reconciliation time band, not the sensitive content.

## Day 14 adoption gate

Evaluate all eligible events from Day 2 through Day 14.

`PASS` requires all of the following:

- at least five eligible events;
- capture compliance of at least 80%;
- median active capture effort no greater than two minutes; and
- no three consecutive eligible events bypassed for `FRICTION` or `TRUST`.

`STOP` applies if at least five eligible events exist and any of the following
is true:

- capture compliance is below 50%;
- more events are bypassed for `FRICTION` or `TRUST` than are captured; or
- three consecutive eligible events are bypassed for `FRICTION` or `TRUST`.

Any result between the `PASS` and `STOP` boundaries is `REVISE`, but it does
not authorize feature work during the evaluation. Record the causal friction
and continue the freeze to the Day 28 decision.

If fewer than five eligible events exist on Day 14, record `INSUFFICIENT_SAMPLE`
and evaluate adoption when the fifth event occurs or on Day 28, whichever
comes first. There is no extension beyond Day 28.

## Day 28 utility gate

`CONTINUE` requires every mandatory condition:

- the original Day 7 operational gate passed;
- the adoption result is `PASS` rather than `REVISE`, `STOP`, or
  `INSUFFICIENT_SAMPLE`;
- at least three post-addendum fresh-conversation recovery attempts were run,
  at least 90% were structurally exact, and no mismatch remains unexplained;
- corrections are no more than 10% of captured eligible events, with no data
  loss, unauthorized mutation, or source-of-truth corruption;
- the user judges the observed capture and maintenance cost acceptable; and
- at least one direct utility signal passes: two or more user recaps were
  avoided, or Today actionability is at least 50% across at least five
  non-empty Today sessions.

`STOP` applies if an immediate stop condition occurs, the adoption gate is
`STOP`, any mandatory Day 28 condition fails, or the evidence remains
insufficient at Day 28. The repository and database are preserved as a
completed personal experiment; no additional product investment is implied.

`REVISE` is available only at the final decision when the safety, adoption,
and recovery conditions pass but one bounded usability defect is the sole
reason a utility threshold narrowly fails. It identifies a candidate future
experiment; it does not extend this evaluation or authorize implementation.

## Evidence discipline

Use [`M4_DAILY_LOG_v0.1.md`](M4_DAILY_LOG_v0.1.md) for sanitized event, Today,
recovery, and correction entries. The user may state an event count or effort
estimate explicitly; Codex must not infer an unseen event or fabricate a
denominator. Missing data stays missing.

No company, role, posting reference, message content, Project identifier, Task
title, credential, or other real job-search payload may enter Git-tracked
evidence. Gate calculations must be reproducible from the sanitized ledger.
