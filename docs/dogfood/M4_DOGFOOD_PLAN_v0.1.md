# M4 Real-Data Dogfood Plan v0.1

**Status:** ACTIVE — DAY 1 STARTED; 1 OF 7 DAILY CHECK-INS COMPLETE

## Objective

Prove that the verified Personal AI Workspace MVP is useful and reliable for
one person's real job-search work over seven consecutive local calendar days.
M4 gathers operating evidence; it does not expand the product architecture.

The trial starts at Day 1 only after the user explicitly authorizes the first
real Job Application write. Creating the empty production-like Workspace on
Day 0 does not start the seven-day clock.

## Scope

M4 uses only the frozen 12-tool surface to:

- register and maintain the user's current real Job Applications;
- create and update explicitly requested Tasks;
- propose lifecycle changes separately from user-authorized admission;
- use the deterministic Today view during daily check-ins; and
- verify durable readback across separate ChatGPT conversations and process
  restarts.

The trial should include all applications the user chooses to manage. A useful
evaluation target is at least five active applications, seven daily Today
check-ins, and at least one lifecycle admission or explicit confirmation that
no lifecycle event occurred during the trial.

## Frozen boundaries

M4 adds no Gmail or Calendar ingestion, polling, notification, reminder,
background job, automatic transition admission, model ranking, fuzzy matching,
new MCP tool, schema migration, multi-user behavior, or UI. External content
remains untrusted evidence and never supplies admission authority.

The application source of truth is the SQLite database configured by
`PAW_DB_PATH`. Chat history is not a source of truth.

## Data and privacy rules

- The real database stays outside the repository and every OneDrive root at
  `%LOCALAPPDATA%\PersonalAIWorkspace\data\workspace.db`.
- Real company names, roles, posting references, Tasks, and observations are
  never copied into Git-tracked documents, fixtures, screenshots, or logs.
- Repository evidence records only aggregate counts, identifiers when needed
  for system verification, and sanitized friction descriptions.
- `npm run seed` is prohibited for the real Workspace.
- Backups are taken only while the server is stopped and go to a
  user-controlled encrypted location. Restore and reset are explicit,
  recoverable operations; startup never deletes data.

## Day-0 gate

Day 0 passes only when:

1. the resolved database path is outside the repository and OneDrive;
2. a new database is created without synthetic seed data;
3. all committed migrations are applied;
4. the development identity maps to exactly one Workspace;
5. `/healthz`, MCP discovery, and `workspace_ping` succeed;
6. discovery exposes exactly the frozen 12 tools;
7. the real Workspace contains zero Projects, Tasks, Resources, and runtime
   lifecycle transitions before the first authorized write; and
8. the initialization process is stopped cleanly after verification.

The recorded result belongs in `M4_DAY0_RESULTS_v0.1.md` and must not contain
credentials or real job-search content.

## Seven-day operating protocol

For each local day from Day 1 through Day 7:

1. Start the server against the same absolute `PAW_DB_PATH` and
   `PAW_TIME_ZONE=Australia/Sydney`.
2. Ask for the deterministic Today view before deciding what to work on.
3. Apply only explicit user-authorized writes. Read back every effective
   mutation immediately.
4. Record sanitized aggregate evidence: active/closed application counts,
   open Task count, Today attention count, mutations attempted, mutations
   rejected, and any friction category.
5. Stop the server before any backup or maintenance operation.

Suggested friction categories are `DISCOVERY`, `DATA_ENTRY`, `TODAY_QUALITY`,
`LIFECYCLE`, `TASK_FLOW`, `CONTINUITY`, `TRUST`, and `OPERATIONS`. Notes must
describe behavior without copying real application content. Record each day in
`M4_DAILY_LOG_v0.1.md`.

## Exit gate

M4 is supported only if all of the following hold:

- seven daily check-ins use the same durable Workspace;
- a separate conversation can recover current work without reconstructing
  prior chat;
- no accepted write is lost and no mutation occurs without explicit user
  authority;
- retries do not create duplicate Projects, Tasks, or transitions;
- Today remains deterministic and every surfaced item is explainable from
  stored state;
- lifecycle terminal effects remain correct if exercised;
- no real data enters the repository or logs; and
- the final review identifies the top observed friction and makes an explicit
  `CONTINUE`, `REVISE`, or `STOP` decision before any post-M4 feature work.

## Stop conditions

Stop the trial and preserve the database before further writes if there is
data loss, cross-Workspace leakage, an unauthorized mutation, an unexplained
duplicate, a lifecycle/version inconsistency, repository/OneDrive database
placement, or credential exposure.

## Day-0 operating commands

Run from the repository root in PowerShell:

```powershell
$dataRoot = Join-Path $env:LOCALAPPDATA "PersonalAIWorkspace\data"
New-Item -ItemType Directory -Force -Path $dataRoot
$env:PAW_DB_PATH = Join-Path $dataRoot "workspace.db"
$env:PAW_TIME_ZONE = "Australia/Sydney"
npm.cmd run build
npm.cmd start
```

Use `/healthz` for basic liveness and `/mcp` for discovery and
`workspace_ping`. Do not run the synthetic seed command.
