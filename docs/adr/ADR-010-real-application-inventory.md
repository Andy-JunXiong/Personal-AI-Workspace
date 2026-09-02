# ADR-010 — Real Job Application inventory boundary

**Status:** Accepted for Real Job Search MVP Slice M1

## Context

The verified Spikes used a seeded Job Application. Real dogfooding needs durable
registration, inventory reads, correction of registration facts, and bounded
context without weakening lifecycle admission or Gmail provenance controls.

## Decision

Workspace exposes narrow create, list, exact-find, update, and bounded-get
operations for `project_type = job_application`.

Creation starts at `APPLIED` and records `NONE -> APPLIED` as an admitted
`USER_ASSERTION` attributable to explicit user authority. Creation is
idempotent.

Before creation, Workspace performs the same exact normalized company + role
comparison used by lookup, restricted to `Project.status = ACTIVE`. If a match
exists, the default result is `POSSIBLE_DUPLICATE` and the command performs zero
writes. Creation authority is not duplicate-override authority.

A second distinct active application is permitted only when the tool input
contains both `allowDistinctDuplicate = true` and a sanitized `postingReference`
different from every exact active match. Model choice, repeated creation prose,
and the ordinary explicit creation-authority fields cannot supply this override.

Registration updates may change only company, role, applied date, location, and
a sanitized HTTP(S) posting reference. They use `Project.recordVersion` for
optimistic concurrency and command idempotency. They never mutate
`lifecycleState`, `lifecycleVersion`, or Project status. Unrelated Project
metadata is preserved.

Posting references persist only the URL origin and path. Credentials are
rejected; query strings and fragments are discarded.

`workspace_get_project` returns current state, all open Tasks, the latest 10
Resources, the latest 10 StateTransitions, and total counts. It does not add a
generic history or pagination contract.

Real runtime SQLite state is configured through `PAW_DB_PATH` and must be
outside the repository and configured OneDrive roots. Startup creates
directories and migrates data but never resets or deletes it.

## Consequences

- Real inventory no longer depends on seed fixtures.
- Registration correction and lifecycle concurrency cannot collide because
  their versions are independent.
- Accidental exact active duplicates are blocked before persistence.
- Deliberate distinct applications with the same company and role remain
  representable only through the narrow structured override contract.
- Context remains bounded for normal ChatGPT reads.
- Backup and reset are explicit offline operations.

## Rejected alternatives

- Reusing `lifecycleVersion` for metadata edits.
- Allowing the update command to write lifecycle fields or arbitrary metadata.
- Treating ordinary creation authority or free-form prose as duplicate override.
- Persisting full posting URLs with tracking or candidate query parameters.
- Generic pagination, search, fuzzy matching, or a new JobApplication entity.
- Keeping real SQLite state in the repository or OneDrive directory.
