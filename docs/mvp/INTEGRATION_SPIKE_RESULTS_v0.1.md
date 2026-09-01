# Integration Spike 1A Results v0.1

**Date:** 2026-09-02

**Status:** COMPLETE — LOCAL AND CHATGPT-NATIVE VERIFICATION PASSED

**Milestone:** `spike-1a-chatgpt-native-verified-v0.1`

## Scope completed

Spike 1A proves the continuity thesis with:

- a stateless Streamable HTTP MCP endpoint at `/mcp`,
- SQLite persistence and numbered migration,
- one configured development Principal mapped to one Workspace,
- one seeded Job Application at `APPLIED`, version 1,
- observation recording without lifecycle mutation,
- separate transition proposal and explicit-user admission,
- blocking `APPLIED -> RECRUITER_CONTACT` lifecycle behavior,
- command idempotency, deterministic duplicate protection, optimistic
  concurrency, and derived-task uniqueness,
- a ChatGPT Custom App connected through Secure MCP Tunnel,
- durable reads from two separate ChatGPT conversations.

Spike 1B and all external connectors remain unimplemented and have not begun.

## Evidence boundary

### Automated and local evidence

Repository verification command:

```text
npm run verify
```

Verified locally:

- TypeScript typecheck and production build,
- 4 Vitest files and 16 unit/integration tests,
- persisted Project after database close/reopen,
- observation/state and proposal/admission separation,
- explicit-user admission authorization,
- atomic state/version/transition/task mutation,
- optimistic-concurrency rejection,
- same-key/same-payload replay,
- same-key/different-payload conflict,
- deterministic Resource and transition duplicate protection,
- derived-task uniqueness,
- real local Streamable HTTP discovery and invocation of all five MCP tools,
- `/healthz` returning HTTP 200 with the database available.

This automated evidence does not, by itself, prove ChatGPT behavior.

### Manual ChatGPT platform evidence

The operator completed the Platform Gate using ChatGPT Developer Mode, a
Custom App, and Secure MCP Tunnel. The manual run proved:

| Gate | Capability | Result |
| --- | --- | --- |
| P1 | Custom App connection through Secure MCP Tunnel | SUPPORTED |
| P2 | `workspace_ping` | SUPPORTED |
| P3 | Durable Project read | SUPPORTED |
| P4 | Same Project read from a separate ChatGPT conversation | SUPPORTED |
| P5 | Observation persisted without lifecycle mutation | SUPPORTED |
| P6 | Transition proposed without lifecycle mutation | SUPPORTED |
| P7 | Explicit-user admission and atomic lifecycle mutation | SUPPORTED |
| P8 | Retry/idempotency with no duplicate transition or task | SUPPORTED |

The detailed manual procedure and result record are in
`tests/evaluations/chatgpt-platform-gate-v0.1.md`.

## Observed lifecycle result

Manual P7 execution observed:

- lifecycle transition `APPLIED -> RECRUITER_CONTACT`,
- lifecycle version `1 -> 2`,
- transition status `ADMITTED`,
- `admitted_by = USER`,
- `admission_authority_type = EXPLICIT_USER_DEV`,
- exactly one high-priority `RESPOND_TO_RECRUITER` derived Task.

This demonstrates that proposal validation remained separate from admission
authorization and that the model did not supply admission authority by
inference alone.

## Observed retry result

Manual P8 execution observed:

- `alreadyAdmitted = true` on the repeated admission path,
- lifecycle remained `RECRUITER_CONTACT`,
- lifecycle version remained `2`,
- no duplicate transition,
- no duplicate Task,
- the existing Respond to recruiter Task remained the sole derived Task.

The manual evidence proves safe retry behavior through ChatGPT. The automated
suite separately proves exact command-key replay and different-payload
conflict semantics.

## Secure MCP Tunnel result

Secure MCP Tunnel is validated as development infrastructure for the private
Spike 1A MCP server. It successfully enabled Custom App discovery and tool
invocation without requiring a public inbound MCP endpoint.

No runtime API key, control-plane credential, Tunnel secret, or other secret is
stored in this repository. Tunnel configuration remains development-only and
outside the domain system.

## Architecture decisions demonstrated

1. Conversation is an interface, not the system of record.
2. The Workspace owns durable state across separate ChatGPT conversations.
3. The MCP layer delegates to deterministic Workspace services and does not
   call an LLM API.
4. Observation and lifecycle mutation are separate operations.
5. Proposal validation does not grant admission authority.
6. Runtime admission requires explicit user authority and records
   `EXPLICIT_USER_DEV`.
7. State/version, admitted transition, and derived Task update atomically.
8. Idempotency and deterministic uniqueness prevent duplicate transitions and
   derived Tasks without fuzzy or model-based duplicate detection.
9. Identity remains the approved single configured development Principal and
   Workspace; authentication administration is outside Spike 1A.

## Known limitations and deferred scope

- Secure MCP Tunnel is validated for development testing, not public plugin
  submission or production deployment.
- Identity is a single configured development Principal and Workspace; login,
  RBAC, public OAuth, and user management are not implemented.
- Persistence is local SQLite and has not been evaluated for multi-instance or
  production operations.
- The manual evidence and any screenshots remain operator-controlled; secrets
  and runtime credentials are intentionally absent from Git.
- Spike 1B Connected App/Workspace handoff remains deferred.
- Gmail, Drive, Calendar, other connectors, UI, LLM API, scheduler, event bus,
  and background automation remain out of scope and unimplemented.

## Overall verdict

Spike 1A is complete. Automated/local evidence proves the deterministic domain,
persistence, protocol, concurrency, and idempotency behavior. Manual ChatGPT
platform evidence proves Custom App connectivity, Secure MCP Tunnel transport,
cross-conversation continuity, non-mutating observation/proposal behavior,
explicit-user admission, and safe retry behavior.

Do not begin Spike 1B without a separate scope decision.
