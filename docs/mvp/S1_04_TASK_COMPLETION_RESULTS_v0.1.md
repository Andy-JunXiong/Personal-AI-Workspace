# S1-04 — Browser Task completion results v0.1

**Date:** 2026-09-06 (Australia/Sydney).

**Status:** Local implementation and synthetic verification passed. Public
Google login, HTTPS/Safari, cloud rollout and real-data completion remain
pending separate review.

**Authority:** This package continues the approved
[local S1 implementation scope](S1_LOCAL_SCOPE_DECISION_2026-09-05.md). It did
not access or mutate the real business database or deployed cloud runtime.

## Continuity and benefits

### Upstream requirement

The [P0 technical plan](JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md) and
[interface requirements](JOB_SEARCH_SECONDARY_INTERFACE_REQUIREMENTS_v0.1.md)
require an independently usable Task completion action with optimistic
concurrency, exact retry, actor-attributed audit and cross-entry terminal Task
readback. S1-01 supplied browser identity, S1-02 supplied owned Task reads and
MCP terminal readback, and S1-03 supplied the responsive Task page. The remaining
gap was a trusted browser mutation path; the read-only page could inspect work
but could not finish it.

### Current package

S1-04 adds only individual Task completion, its authority adapter, audit storage,
recovery behavior and UI control. It deliberately does not add general Task
editing, lifecycle mutation, candidate records, public ingress, real Google
acceptance or cloud enablement.

### Downstream enablement

This package makes S1-05 operational acceptance possible: the team can now test
the complete direct-browser action across real Google login, HTTPS Safari/iPhone,
restart/backup/rollback and fresh ChatGPT readback. Those external and real-data
gates remain pending separate authorization.

### Short-term benefits

- A user can complete an owned open Task without starting a ChatGPT conversation.
- Lost responses, duplicate submissions and competing updates now have testable,
  deterministic recovery instead of risking duplicate or silent writes.
- Operators can attribute every new successful Task command to its principal,
  channel, intent and before/after versions.

### Long-term benefits

- The shared command and audit boundary supports future governed Task actions
  without creating a second source of truth beside MCP.
- Stable cross-entry mutation semantics provide a reusable pattern for later
  candidate decisions, application linking and additional domain interfaces.
- Actor and intent evidence creates a durable foundation for production incident
  review, policy enforcement and trustworthy multi-entry continuity.

## Implemented contract

- Added the opt-in `POST /api/v1/job-search/tasks/{id}/complete` route. Browser
  writes remain disabled unless both `PAW_WEB_ENABLED=true` and
  `PAW_WEB_WRITES_ENABLED=true` are configured.
- The adapter derives `EXPLICIT_USER_WEB` authority from the verified session,
  actor and stable intent key. Request bodies cannot select an actor, Workspace,
  channel or development authority.
- Every write rechecks the active identity link, Workspace ownership, exact
  Origin and session-bound CSRF token. The command accepts only a Task ID,
  expected record version and UUID intent key.
- Completion reuses `workspace_update_task`, terminal-state enforcement,
  optimistic concurrency, version increment and `completedAt`. It does not
  change application lifecycle.
- The open-Task page now exposes one explicit completion control. Success is
  shown only after the server acknowledges the command and a fresh page read
  confirms the terminal state. An uncertain network result retains the same
  in-memory intent key for retry.

## Audit and atomicity

Migration `005_task_command_audit.sql` adds actor-attributed Task command audit
with Workspace, principal, Task, operation, channel, intent, authority,
before/after versions, changed fields, outcome and timestamp. New successful
MCP and Web Task commands write audit in the same transaction as Task state and
the idempotency response.

An exact retry returns the stored result and adds no audit row. A changed use of
the same intent key returns `IDEMPOTENCY_CONFLICT`. Existing idempotency records
replay without retrospective audit. A forced audit-insert failure returned 503
and rolled back Task state, audit and idempotency together; retrying the same
intent after storage recovery succeeded.

## Verification

`npm.cmd run verify` passed:

- server and browser TypeScript checks;
- **177 tests in 18 files**;
- production compilation and web-asset copy.

Focused transport coverage passed successful completion, exact duplicate
submission, stale-version and changed-intent conflict, terminal rejection,
missing session, forged/missing Origin and CSRF, invalid bodies, wrong-owner and
missing objects, audit rollback, fresh exact Task readback, and write-off 404.
MCP tests verify one audit row per new command and legacy replay behavior.

Synthetic Chrome device emulation exercised the actual page, script and API.
At 390 x 844, clicking Complete returned a fresh `DONE` page with completion
time and no completion button. At 320 x 780, document width matched the viewport
and the 148 x 44 completion control remained fully inside the Task card. No
horizontal overflow or visual control overlap was observed.

## Remaining S1 release gates

This result completes the local S1-04 package, not the operational release.
S1-05 still requires reviewed public configuration, real Google authentication,
HTTPS Safari/iPhone checks, migration and rollback rehearsal on a database copy,
capacity/restart/backup evidence, cross-entry readback and explicit approval
before any real deployment or browser write is enabled.
