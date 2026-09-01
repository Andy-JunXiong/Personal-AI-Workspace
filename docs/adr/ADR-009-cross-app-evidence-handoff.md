# ADR-009 — ChatGPT-mediated cross-app evidence handoff

**Status:** Proposed for Spike 1B

## Context

Spike 1A proved that the Workspace can persist Job Application work state and
expose it to separate ChatGPT conversations. Spike 1B must prove that a real
source-app fact can participate in the same continuity flow without moving
source integration or orchestration into Workspace.

The target source is Gmail, accessed through the existing ChatGPT Gmail app.
Users should not need to know a Workspace Project UUID, but a broad search or
matching subsystem would exceed the proof.

## Decision

ChatGPT remains the cross-app orchestration and reasoning host:

```text
Gmail app -> ChatGPT -> Workspace MCP -> durable work state
```

Workspace will not implement a Gmail connector. It will add at most one narrow,
read-only lookup:

```text
workspace_find_job_application(company, role)
```

The lookup uses deterministic exact matching after Unicode NFKC, whitespace,
and case normalization. It returns `EXACT`, `NOT_FOUND`, or `AMBIGUOUS`; it does
not guess.

Gmail evidence enters Workspace through the existing
`workspace_record_observation` command as a minimized Resource with provider,
stable individual message ID, optional deep link, timestamp, and concise
work-relevant facts. Gmail remains authoritative for the email. Workspace owns
the durable interpretation and its relationship to Project state.

Observation, Proposal Validation, Admission Authorization, and Durable State
Mutation remain separate. Email content and model inference cannot authorize
admission. Spike 1B reuses the Spike 1A explicit-user development admission
mechanism and introduces no policy engine or deterministic admission rule.

## Consequences

- Natural project selection is possible without exposing generic search.
- Existing Resource and idempotency uniqueness can deduplicate a repeated
  message when Gmail supplies a stable individual message ID.
- Ambiguity and aliases are surfaced to the user instead of resolved
  heuristically.
- Workspace stores only the evidence needed for continuity, not mailbox
  content.
- ChatGPT platform support for Gmail + Custom App use in one flow and the exact
  Gmail identifier shape remain manual gates.

## Rejected alternatives

### Workspace Gmail connector

Rejected because ChatGPT already owns the connected-app surface and the Spike
does not require background ingestion, provider OAuth, polling, or webhooks.

### Generic or fuzzy project search

Rejected because one exact company + role lookup is sufficient. Full-text,
vector, embedding, alias, and LLM matching add infrastructure and make matching
and deduplication less deterministic.

### Store full Gmail messages

Rejected because Gmail is the source of truth and full message replication is
unnecessary for durable work-state continuity.

### Automatic admission from email evidence

Rejected because evidence and model interpretation do not provide admission
authority. Explicit user approval remains required.
