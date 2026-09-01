# ADR-008 — Transition admission, concurrency, and idempotency

**Status:** Accepted for Spike 1A

## Decision
- Proposal and Admission are separate.
- Admission authorization is separate from validation.
- ChatGPT/model may propose but does not itself own admission authority.
- Use expected lifecycle version for optimistic concurrency.
- Write tools require command-level idempotency.
- Same key + same payload replays the original result.
- Same key + different payload is an idempotency conflict.
- Derived tasks are unique per source transition + task kind.
- Fuzzy/LLM semantic deduplication is out of scope for Spike 1A.

## Admission authority

`workspace_propose_transition` may be called from model reasoning but never
changes Project lifecycle state. `workspace_admit_transition` describes an
operation exposed through ChatGPT; it does not make ChatGPT the authority.

Runtime admission requires an explicit-user development assertion. Model
inference alone is insufficient. The sole deterministic rule,
`SPIKE_FIXTURE_IMPORT`, only initializes seed data and is not a runtime policy.

## Atomicity and deterministic duplicate protection

Project lifecycle state/version, admitted transition status, and any derived
Task update in one transaction.

Additional duplicate protection is limited to:

- Resource `(project_id, provider, external_id)` when an external ID exists;
- an exact canonical-record hash when it does not;
- an exact canonical proposal hash;
- Task `(source_transition_id, task_kind)`.

Similar but non-identical records remain distinct. No fuzzy matching or LLM
duplicate classification is used.
