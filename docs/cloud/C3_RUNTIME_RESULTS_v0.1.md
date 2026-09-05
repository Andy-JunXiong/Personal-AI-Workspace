# C3 real database migration runtime results

**Date:** 2026-09-05 (Australia/Sydney)

**Status:** C3 PASSED — INCLUDING INDEPENDENT CHATGPT CONVERSATION

The user authorized proceeding with real-data migration and cloud acceptance
after C1/C2 passed. No product code, schema, lifecycle, or tool contract changed.

## Source and target

- Authoritative source: `%LOCALAPPDATA%\PersonalAIWorkspace\data\workspace.db`.
- Accepted operations checkout: `c27d39e`; application image remains the
  C1/C2-accepted `paw:4ab6daed2158`.
- The local Workspace and tunnel were stopped; no local application listener or
  database sidecar was present. The source was exclusively readable.
- The preparation script verified the source and timestamped copy, including
  SQLite integrity `ok` and all three migrations. Source and transferred copy
  were 286,720 bytes and had matching SHA-256 checksums.
- The source database was not modified. A post-cutover source hash still matched
  the immutable migration copy.

## Transfer and cutover

The timestamped copy was transferred directly to the authenticated AWS browser
SSH session using a non-echoing stdin receiver. It was compressed for transfer;
the receiver decoded it, checked the expected SHA-256, and created the staged
database with mode `0600`. Neither database content nor credentials entered Git.
The local temporary transfer copy was removed after loading; the retained
migration source stays outside OneDrive.

The staged database's complete row digest and read-only application results
matched the Windows copy before cutover. The tunnel and backup timer were paused.
The source's single Principal mapping was preserved in the application environment
before the import, with the previous environment retained at
`/etc/paw/paw.env.pre-c3`. The import script backed up and quarantined the old empty
cloud database, installed the verified source, and restarted the accepted image.

The active database and staged source produced identical complete readback JSON.
Only then were the tunnel and backup timer resumed. A manual invocation of the
installed backup service succeeded against the real cloud database.

## Read-only evidence

| Check | Result |
| --- | --- |
| Workspace identity | Original local identity preserved |
| Principals / Workspaces | 1 / 1 |
| Applications | 23 total; 11 active |
| Lifecycle distribution | 10 APPLIED, 1 INTERVIEWING, 12 REJECTED |
| Resources / admitted transitions | 23 / 36 |
| Transition-evidence links / idempotency records | 13 / 72 |
| Open Tasks | 1 |
| Today | 2026-09-05, Australia/Sydney; 1 attention, 0 upcoming, 10 applications without an open Task |
| Source vs cloud rows | Full canonical row digest equal across all nine tables |
| Connected app vs source | All five complete result hashes equal |

The five connected-app reads were `workspace_ping`, application lists with and
without closed records, `workspace_get_today`, and `workspace_get_project` for
the known application with an open Task. Hashes cover the complete returned
objects, including deterministic ordering, lifecycle versions, open Tasks, and
bounded provenance. Private payloads were not copied into this document.

## Retained evidence and rollback

- Local migration copy, checksum manifest, source readback, and connector hashes:
  `%LOCALAPPDATA%\PersonalAIWorkspace\migration`.
- Cloud immutable source: `/srv/paw/import/paw-c3-source-20260905T060558Z.db`.
- Cloud readbacks and import log: `/srv/paw/deployments/c3-*`.
- Pre-import cloud DB: timestamped `c3-*` quarantine under
  `/srv/paw/restore-quarantine`, plus the consistent pre-import backup.
- Prior application environment: `/etc/paw/paw.env.pre-c3`.

The local original remains stopped and is retained for rollback. After cloud
writes begin, it is a historical rollback artifact, not a second active database.
No retained source, staging copy, or quarantine was deleted.

## Remaining acceptance

An independent new ChatGPT Work conversation completed all five requested
read-only calls, using Personal AI Workspace as its source. It returned the
original Workspace identity, 23 total/11 active applications, the same lifecycle
distribution and Today counts, and the selected Project at lifecycle version 2
with its original TODO Task at record version 1. A subsequent direct database
readback remained identical to the pre-import source, confirming zero mutation.

C3 is complete. [C4 controlled write/readback](C4_C5_RUNTIME_RESULTS_v0.1.md)
subsequently passed after the user selected a clearly labelled low-priority
acceptance Task on an existing application, followed by completion. C5
fully-powered-off Windows/iPhone acceptance subsequently passed with explicit
user confirmation and independent cloud Task verification recorded in the same
results document. Scripted deployment
checks do not count as M4 real-use capture events or proof that Today led to a
real job-search action.
