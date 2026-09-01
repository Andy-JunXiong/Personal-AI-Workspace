# ChatGPT Integration Spike v0.1

## Purpose

Validate the critical ChatGPT-native assumptions before writing the full MVP.

## Scope split

### Spike 1A — current implementation scope

- Workspace MCP connectivity
- durable Job Application persistence
- cross-conversation reads
- observation recording
- separate transition proposal and admission
- command idempotency and derived-task uniqueness

### Spike 1B — deferred

- Connected App + Workspace orchestration
- cross-app structured handoff

Spike 1A must not implement Gmail, Drive, Calendar, or other external
connectors. Test 3 below belongs to Spike 1B and is non-blocking for Spike 1A.

## Test 1 — Custom Workspace app loads

Expose:

```text
workspace.ping()
```

**Pass:** ChatGPT discovers and invokes it.

## Test 2 — Durable state across conversations

Seed one Job Application.

Expose:

```text
workspace.get_project(project_id)
```

**Pass:**
- Chat A reads the object.
- Chat B reads the same persisted object.
- no previous chat transcript is needed.

This is the smallest proof of the project thesis.

## Test 3 — Connected app + Workspace app in one task (Spike 1B)

Prompt concept:

> Find the latest recruiter message for Example Co and compare it with the current application state in my Workspace.

**Pass:**
- ChatGPT uses the source app,
- ChatGPT uses the Workspace app,
- both results participate in one reasoning flow.

## Test 4 — Cross-app handoff

Expose:

```text
workspace.record_observation(...)
```

**Pass:** structured recruiter-message facts can be persisted with source/provenance.

## Test 5 — Write/modify path

Expose:

```text
workspace.propose_transition(...)
workspace.admit_transition(...)
```

**Pass:**
- current account/workspace permits the required write/modify behavior,
- confirmation behavior is understood,
- mutation persists.

The model may propose but cannot supply admission authority through inference
alone. Admission requires an explicit user-authority assertion or a named,
enumerated deterministic rule. Spike 1A enables only the explicit-user
development mechanism. `SPIKE_FIXTURE_IMPORT` is the only deterministic rule;
it initializes seed data and cannot admit a runtime lifecycle edge.

If unsupported, record the platform constraint before changing architecture.

## Test 6 — Idempotency

Invoke the same transition twice.

**Pass:**
- one admitted transition,
- no duplicate task.

Command-level behavior is mandatory:

```text
same key + same canonical payload -> replay existing result
same key + different canonical payload -> conflict
```

Additional deduplication is limited to deterministic provider/external IDs or
exact canonical records. Fuzzy or LLM-based semantic deduplication is excluded.

## Exit criteria

Each test must be classified:

```text
SUPPORTED
SUPPORTED_WITH_CONSTRAINT
NOT_SUPPORTED
```

Do not build the broad MVP until these are known.

For Spike 1A, Test 3 is recorded as `DEFERRED_TO_SPIKE_1B` rather than treated
as an implementation failure.
