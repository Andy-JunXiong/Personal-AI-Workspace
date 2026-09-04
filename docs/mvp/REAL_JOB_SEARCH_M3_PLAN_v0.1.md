# Real Job Search MVP Slice M3 Plan v0.1

**Status:** APPROVED BASELINE — LOCAL GATE PASSED; CHATGPT PLATFORM GATE PENDING

## Objective

Complete the approved real Job Application lifecycle without changing the
frozen Spike, M1 inventory, or M2 Task/Today boundaries. M3 extends the
existing proposal and explicit-admission commands; it adds no new MCP tool,
background automation, connector, or model-ranking layer.

## Lifecycle contract

The only allowed edges are:

```text
APPLIED -> RECRUITER_CONTACT | INTERVIEWING | REJECTED | WITHDRAWN
RECRUITER_CONTACT -> INTERVIEWING | REJECTED | WITHDRAWN
INTERVIEWING -> OFFER | REJECTED | WITHDRAWN
OFFER -> ACCEPTED | REJECTED | WITHDRAWN
```

`ACCEPTED`, `REJECTED`, and `WITHDRAWN` are terminal. No self-transition,
transition to `APPLIED`, edge that skips this matrix, or edge leaving a
terminal state is allowed.

## Admission and effects

Proposal remains non-authoritative and never mutates Project lifecycle. An
admission still requires explicit user authority, the proposal's lifecycle
version, Workspace ownership, and attributable evidence when the trigger is
`EXTERNAL_EVIDENCE`.

One admission transaction applies the lifecycle state/version, marks the
transition admitted, applies the one approved derived effect, records command
idempotency, and either commits all changes or rolls them all back.

Derived Tasks are determined only by the admitted destination state:

| Destination | Task kind | Title | Priority |
| --- | --- | --- | --- |
| `RECRUITER_CONTACT` | `RESPOND_TO_RECRUITER` | `Respond to recruiter` | HIGH |
| `INTERVIEWING` | `PREPARE_FOR_INTERVIEW` | `Prepare for interview` | HIGH |
| `OFFER` | `REVIEW_OFFER` | `Review offer` | HIGH |

The deterministic HIGH priority follows the already-frozen recruiter-response
effect. `REVIEW_OFFER` is source-owned: M3 does not add it to the M2 manual
Task-creation allowlist.

Admitting a terminal state sets `Project.status = CLOSED` and atomically marks
every TODO, IN_PROGRESS, or BLOCKED Task on that Project `CANCELLED`. Each
cancelled Task increments `recordVersion`, sets `updatedBy = SYSTEM`, uses the
admission timestamp as `updatedAt`, and leaves `completedAt = null`. Existing
DONE and CANCELLED Tasks are unchanged. Terminal admission creates no derived
Task.

## Persistence and API boundary

No schema migration is required. Existing lifecycle strings, Project status,
Task kind storage, transition linkage, Task audit fields, and transaction
support already represent the M3 contract.

`workspace_propose_transition.toState` expands to the six non-initial target
states. The tool count remains 12. The manual `workspace_create_task` schema
remains frozen and excludes `REVIEW_OFFER`.

## Verification gate

M3 local verification must prove:

1. all 13 allowed edges admit and all 36 other state pairs reject;
2. proposal never changes Project state;
3. every admission requires explicit authority and optimistic concurrency;
4. each non-terminal destination creates exactly its approved derived Task;
5. terminal admission closes the Project and cancels only obsolete open Tasks
   in the same transaction;
6. a forced late transaction failure rolls back lifecycle, transition, and
   Task cancellation together;
7. exact retry and already-admitted retry create no duplicate transition or
   Task and do not increment versions again;
8. MCP discovery exposes the expanded lifecycle target enum without expanding
   the manual Task-kind enum; and
9. `npm run verify` and `git diff --check` pass with all frozen regressions.

Manual ChatGPT verification then follows
`tests/evaluations/chatgpt-m3.md`. M3 is not complete or eligible for a verified
tag until both local and platform gates pass.
