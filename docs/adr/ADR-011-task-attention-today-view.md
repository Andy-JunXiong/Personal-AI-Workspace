# ADR-011 - Task attention and deterministic Today view

**Status:** Accepted for Real Job Search MVP Slice M2

## Context

M1 made Job Applications durable, but it did not answer what needs attention
today. M2 needs useful daily work without adding a scheduler, external-source
scan, model ranking, or a second durable aggregate.

## Decision

Workspace owns manual Task state in a dedicated `TaskService`. Create and
update are single-Task, Workspace-scoped, explicitly user-authorized,
idempotent commands. Updates require `expectedRecordVersion`; every effective
mutation increments `recordVersion`.

`DONE` and `CANCELLED` are terminal. `DONE` sets `completedAt` to the command
time. `CANCELLED` leaves `completedAt` null. Resumed work is represented by a
new Task.

Manual Task creation uses a constrained kind enum and no fuzzy, semantic, or
title deduplication. If an open transition-derived Task of the same kind
already exists for the Project, creation is rejected because the admitted
transition already owns that work.

Workspace owns attention calculation in a dedicated `TodayQueryService`.
`workspace_get_today` is a read-only derived view, not stored state. It uses an
injected clock and the configured IANA timezone, initially
`Australia/Sydney`. Calendar-date rules and fixed tie-breakers determine all
classification and ordering. An attention Task appears once with ordered
state-backed reasons.

The exact result contract and ordering rules are frozen in
`REAL_JOB_SEARCH_M2_PLAN_v0.1.md`.

## Consequences

- ChatGPT can explain durable daily work without calculating or ranking it.
- Task concurrency is independent of Project lifecycle and registration
  versions.
- Today reads are reproducible in tests at timezone boundaries.
- Active applications with no open Task are visible gap signals, not errors.
- There is no persisted Today object, reminder engine, background work, or
  inferred importance.

## Rejected alternatives

- Reopening terminal Tasks.
- Reusing Project lifecycle or record versions for Task concurrency.
- Returning the same Task once per attention category.
- Ranking with an LLM or persisting a computed urgency score.
- Scanning Gmail or Calendar during a Today read.
- Adding generic recurrence, dependency, workflow, or notification machinery.
