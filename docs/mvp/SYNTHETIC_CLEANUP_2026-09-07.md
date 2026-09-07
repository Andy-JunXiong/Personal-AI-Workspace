# Production synthetic fixture cleanup — 2026-09-07

## Continuity and benefits

After the [results-focused UI update](WEB_RESULTS_FOCUS_2026-09-07.md), the user
asked to remove the test records crowding the production application overview.
This request supersedes the earlier P6 instruction to retain the S1 fixture in
the live database. The bounded operation archives all current data and removes
only identified S1/P6 fixtures and their dependent records, restoring the real
application overview. It changes no application code, schema or real record.

Verified immediate benefit: 23 real applications and 3 real tasks remain, with
all untargeted rows unchanged. The next journey is real-result review and GPT
writeback verification. Remaining synthetic P6 gates require isolated fixtures;
retired production IDs must not be reused or silently re-seeded. The long-term
operating direction is isolated acceptance data so daily views remain usable.

## Scope and verification

- Backup `workspace-20260907T045811Z.db`: integrity OK.
- Protected archive outside rolling-backup retention:
  `/srv/paw/deployments/synthetic-archive-20260907.db` (root, mode 600).
- Exact S1 ID plus company/posting reference; exact ten P6 labels and 106 A04
  company/posting pairs, with role/location validation. Expected counts fail closed.
- Rehearsed rollback and commit modes on backup copies in network-isolated
  containers before the live transaction.
- Removed: 117 projects, 7 tasks, 5 candidates, 4 recommendation runs, 2 run
  items, 12 resources, 118 transitions, 1 evidence link, 10 task audit rows,
  2 candidate decisions, 1 candidate link, 152 fixture idempotency responses.
  Their historical evidence remains in the protected full archive.
- Transaction compared every retained row in every table before commit:
  SHA-256 `45751bc85adda293343471a8c53938b3e1c71024689586fb2aa7d91e5708aced`.
- Live result: 23 applications (10 APPLIED, 1 INTERVIEWING, 12 REJECTED), 3 tasks.
  SQLite integrity and foreign keys passed. Read-only deployed Web renderer
  shows total 23 with no fixture labels; public HTTPS ingress is healthy.
- Receipt: `/srv/paw/deployments/synthetic-cleanup-20260907.json`.
- Original SSH firewall restored, temporary keys and rehearsal copy removed.

## Acceptance continuity

Historical P6 passes remain evidence from their original execution. Pending
browser/device/cross-conversation scenarios are not passed by this cleanup.
The prior S1 and P6 fixture IDs now refer only to archived evidence. Do not run
the production seed scripts again to continue acceptance; use an isolated
environment and new test identities/data instead.
