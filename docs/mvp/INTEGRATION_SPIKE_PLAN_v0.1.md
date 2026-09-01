# Integration Spike 1A Implementation Plan v0.1

**Status:** APPROVED IMPLEMENTATION BASELINE

## Objective

Prove that a ChatGPT-accessible Workspace MCP server can persist one Job
Application outside conversation state, retrieve it across separate
conversations, record an observation, propose and explicitly admit
`APPLIED -> RECRUITER_CONTACT`, and safely replay duplicate commands.

## Scope

### Included

- one TypeScript MCP server with Streamable HTTP at `/mcp`,
- one configured development Principal and Workspace,
- SQLite migrations and one seeded Job Application,
- `workspace_ping`,
- `workspace_get_project`,
- `workspace_record_observation`,
- `workspace_propose_transition`,
- `workspace_admit_transition`,
- exact idempotency and optimistic concurrency,
- one deterministic derived Task for the blocking lifecycle edge,
- unit, integration, and local MCP transport tests.

### Excluded

- Spike 1B Connected App handoff,
- Gmail, Drive, Calendar, or other connectors,
- UI,
- model API calls or an LLM gateway,
- login, RBAC, or OAuth administration,
- schedulers, event buses, background ingestion, and workflow engines.

## Admission mechanism

Proposal validation and admission authorization are separate.

The only enabled Spike 1A admission mechanism is an explicit-user development
assertion supplied to the admission command after the user explicitly requests
or confirms the mutation. The server records `EXPLICIT_USER_DEV` and the
authority reference. No automatic runtime lifecycle admission rule is enabled.
The explicitly enumerated `SPIKE_FIXTURE_IMPORT` rule only establishes the
initial seeded `APPLIED` state.

This mechanism proves the domain boundary but is not a production
authentication mechanism.

## Persistence

The minimal schema contains Principals, Workspaces, Projects, Resources,
StateTransitions, transition evidence links, Tasks, and idempotency records.
The seeded Project starts at `APPLIED`, version 1, with an admitted IMPORT
transition so the current-state invariant holds from creation.

## Delivery sequence

1. Establish canonical docs and project tooling.
2. Add migration runner and deterministic development seed.
3. Implement lifecycle validation and explicit admission authority.
4. Implement command-level idempotency and optimistic concurrency.
5. Register the five MCP tools.
6. Run unit, persistence integration, idempotency, concurrency, and MCP
   transport tests.
7. Record local evidence and mark all ChatGPT-only checks as pending manual
   verification.

## Blocking acceptance criteria

1. Local MCP client discovers and invokes `workspace_ping`.
2. Seeded Job Application survives process/database reopen.
3. `workspace_get_project` returns the same ID and state independently of
   conversation state.
4. Observation persistence does not change Project lifecycle state.
5. Proposal persistence does not change Project lifecycle state.
6. Explicit-user admission atomically changes `APPLIED` to
   `RECRUITER_CONTACT`, increments the version, and creates exactly one derived
   Task.
7. Same idempotency key and payload replay the original result.
8. Same idempotency key and different payload return a conflict.
9. Concurrent or repeated admission produces no duplicate transition or Task.
10. No result claims ChatGPT connectivity or cross-conversation behavior until
    manually verified in ChatGPT.
