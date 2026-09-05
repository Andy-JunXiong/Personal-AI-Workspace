# C3 Real Database Migration

**Status:** C3 REAL DATABASE MIGRATION AND INDEPENDENT READBACK PASSED — 2026-09-05

See [C3 runtime results](C3_RUNTIME_RESULTS_v0.1.md) for the current acceptance
status and retained rollback artifacts. C4/C5 remain separate acceptance gates.

C3 replaces the accepted empty cloud database with a verified copy of the real
M4 database. It does not change Job Search behavior, MCP tools, identity policy,
or the local source file.

## Fixed source and target

- Default authoritative source:
  `%LOCALAPPDATA%\PersonalAIWorkspace\data\workspace.db`
- Cloud staging directory: `/srv/paw/import`
- Active application path: `/app/data/workspace.db`
- Persistent host path: `/srv/paw/data/workspace.db`

Do not use a database from the repository, OneDrive, a test run, or an M2/M3
evaluation filename. If `PAW_DB_PATH` was explicitly overridden for the real M4
runtime, pass that exact path to the preparation script.

## Gate 1: prepare an immutable Windows-side copy

1. Close every local Workspace terminal/process and stop its local tunnel.
2. From the accepted repository commit, build and prepare the source:

```powershell
npm run build
.\deploy\cloud\prepare-c3-source.ps1 -WorkspaceStopped
```

The script refuses SQLite sidecars, tests exclusive file access, runs
`PRAGMA integrity_check` plus migration verification on both the source and its
copy, and emits a timestamped DB, JSON manifest, and SHA-256. The original is
not changed or deleted. Retain it as the rollback artifact through C4/C5.

If the real runtime used an override:

```powershell
.\deploy\cloud\prepare-c3-source.ps1 `
  -DatabasePath $env:PAW_DB_PATH `
  -WorkspaceStopped
```

Keep the copy on an encrypted user-controlled device/location. It contains real
job-search data and must not be committed to Git or pasted into chat.

## Gate 2: transfer without exposing the database

Use the already accepted Lightsail browser-SSH administration session. Upload
only the timestamped `.db` file, then move it into the persistent staging
directory as the `ubuntu` deployment user:

```bash
mkdir -p /srv/paw/import
chmod 700 /srv/paw/import
mv -- ~/paw-c3-source-YYYYMMDDTHHMMSSZ.db /srv/paw/import/
chmod 600 /srv/paw/import/paw-c3-source-YYYYMMDDTHHMMSSZ.db
sha256sum /srv/paw/import/paw-c3-source-YYYYMMDDTHHMMSSZ.db
```

The reported hash must exactly match the local manifest. Do not upload the JSON
manifest if it contains locally sensitive metadata. Do not use GitHub as the
transfer path.

## Gate 3: verified and recoverable cutover

Before importing, read the source's single Principal-to-Workspace mapping
without printing its subject into logs. Preserve the source `issuer` and
`subject` in `/etc/paw/paw.env`; the C1/C2 empty-cloud identity can differ.
The application initializes an identity at startup, so importing the file with
the old cloud principal configuration can create a second, empty Workspace.
This configuration alignment preserves the existing identity policy and source
rows. It does not change the restricted tunnel credential or its permissions.

Pause the tunnel and backup timer during cutover. Retain a mode-0600 backup of
the previous application environment file alongside the database rollback
artifacts. If import or readback fails, restore both the prior environment and
prior database, recreate the container with that environment, and verify health
before restarting the tunnel. Resume the timer after a successful manual backup.

Update `/opt/paw` to the accepted commit containing the C3 scripts. From that
checkout, run:

```bash
./deploy/cloud/import-database.sh \
  /srv/paw/import/paw-c3-source-YYYYMMDDTHHMMSSZ.db \
  <exact-64-character-sha256>
```

The import script:

1. requires the separate `/srv/paw` mount;
2. accepts only a timestamped regular file directly under `/srv/paw/import`;
3. verifies SHA-256 and database integrity before stopping PAW;
4. creates a consistent backup of the currently active cloud DB;
5. quarantines the old DB and SQLite sidecars;
6. installs a copy, leaving the staged source untouched;
7. starts the same accepted image and checks health; and
8. restores the previous cloud DB automatically if startup or health fails.

## Gate 4: read-only acceptance before any mutation

Keep the Windows Workspace stopped. Through the connected ChatGPT app, perform
only these reads and record the exact results:

1. `workspace_ping` — Workspace ID must equal the source identity and must no
   longer be the known empty-cloud ID unless that is also the proven source ID.
2. `workspace_list_job_applications(includeClosed=true)` — compare total count.
3. `workspace_list_job_applications()` — compare active count and deterministic
   order.
4. Compare lifecycle-state aggregates from the returned projects.
5. `workspace_get_today` — compare Sydney date/timezone, attention count/order,
   upcoming count/order, and applications-without-open-task count/order.
6. Select one known project ID and call `workspace_get_project`; compare the
   exact project, tasks, provenance/evidence, and lifecycle version.
7. Repeat `workspace_ping` and the exact project read from a new conversation.

Any mismatch is a C3 failure. Do not write. Stop PAW and restore the quarantined
pre-import database or the named consistent backup using the existing restore
procedure, then investigate from retained copies.

After all comparisons pass, record C3 runtime evidence in a separate results
file. C4 may then run one explicitly authorized, controlled mutation. C5 still
requires the Windows PC to be fully powered off.

## Data retention after acceptance

Retain the local original, local timestamped copy, cloud staged source, and
pre-import cloud quarantine through C5. After acceptance, remove redundant
copies only through an explicit data-retention decision; none of these scripts
deletes them automatically.
