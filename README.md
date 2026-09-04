# Personal AI Workspace

> Working name.

## Thesis

**Build a persistent work-state layer for ChatGPT that turns conversations and external events into long-running goals, projects, tasks, actions, and outcomes.**

## Core Principle

> **Conversation is an interface, not the system of record.**

## Architecture

- **ChatGPT = primary interaction + reasoning host**
- **Workspace = persistent state + coordination**
- **Connected services = source facts + capabilities**
- **MCP / Apps SDK = integration surface**

## MVP

First domain: **Job Search**

First proof: **cross-conversation continuity**.

A recruiter message is interpreted in one ChatGPT conversation, the Job Application state is persisted in the Workspace, and a later conversation can continue from the same durable state without reconstructing prior chats.

## Spike status

Spike 1A is complete and frozen. The repository also implements the approved
local Spike 1B delta:

- a Streamable HTTP MCP endpoint at `/mcp`,
- one configured development Principal and Workspace,
- one seeded Job Application,
- separate observation, proposal, and explicit-user admission commands,
- SQLite persistence, optimistic concurrency, and command idempotency,
- one read-only exact Job Application lookup scoped to the current Workspace.

Spike 1B is complete at `spike-1b-cross-app-verified-v0.1`. Automated/local and
manual ChatGPT/Gmail verification passed, including exact work-object
resolution, minimized evidence handoff, explicit admission, retry safety,
privacy/data minimization, and separate-conversation durable readback. Gmail
remains a ChatGPT-connected source app and is not integrated into Workspace.
UI, external connectors, background automation, and model API calls remain out
of scope.

The approved Spike 1B plan is in
[`docs/mvp/INTEGRATION_SPIKE_1B_PLAN_v0.1.md`](docs/mvp/INTEGRATION_SPIKE_1B_PLAN_v0.1.md).
Final evidence is in
[`docs/mvp/INTEGRATION_SPIKE_1B_RESULTS_v0.1.md`](docs/mvp/INTEGRATION_SPIKE_1B_RESULTS_v0.1.md).

The approved Real Job Search MVP baseline and M1 -> M2 -> M3 gates are in
[`docs/mvp/REAL_JOB_SEARCH_MVP_PLAN_v0.1.md`](docs/mvp/REAL_JOB_SEARCH_MVP_PLAN_v0.1.md).
Slice M1 is complete and verified locally and through the ChatGPT platform. Its
final evidence is in
[`docs/mvp/REAL_JOB_SEARCH_M1_RESULTS_v0.1.md`](docs/mvp/REAL_JOB_SEARCH_M1_RESULTS_v0.1.md).
The verified milestone is frozen at
`m1-real-application-inventory-verified-v0.1`.
It replaces fixture-only inventory with user-authorized creation,
Workspace-scoped listing, narrow versioned registration updates, exact lookup,
and bounded Project readback. Slice M2 is complete locally and through the
ChatGPT platform. Its first platform run found a blocking create-Task
Project-visibility defect; the server-side visibility invariant was hardened,
regression coverage was added, and the canonical fresh-database M2-A/B/C
retest passed. The verified milestone is frozen at
`m2-task-today-verified-v0.1`. M3 is not implemented.
Exact active creation duplicates return `POSSIBLE_DUPLICATE` with zero writes;
ordinary creation authority is not a duplicate override. A deliberate distinct
duplicate requires `allowDistinctDuplicate=true` and a different sanitized
posting reference.

M2 adds explicitly authorized, idempotent, versioned single-Task creation and
updates plus a deterministic read-only `workspace_get_today`. Workspace—not a
model—classifies overdue, due-today, high/critical undated, blocked, and
upcoming work using `PAW_TIME_ZONE` (default `Australia/Sydney`) and server
time. It also returns active applications without an open Task and at most five
recent admitted lifecycle changes. `DONE` and `CANCELLED` Tasks are terminal.
See the frozen M2 contract in
[`docs/mvp/REAL_JOB_SEARCH_M2_PLAN_v0.1.md`](docs/mvp/REAL_JOB_SEARCH_M2_PLAN_v0.1.md)
and ADR-011 in
[`docs/adr/ADR-011-task-attention-today-view.md`](docs/adr/ADR-011-task-attention-today-view.md).
Local M2 results, the blocking defect investigation, and platform retest status
are recorded in
[`docs/mvp/REAL_JOB_SEARCH_M2_RESULTS_v0.1.md`](docs/mvp/REAL_JOB_SEARCH_M2_RESULTS_v0.1.md).

### Local setup

For real-data dogfooding on Windows, keep the SQLite database outside both the
repository and OneDrive. `PAW_DB_PATH` is the configuration boundary:

```powershell
npm install
$dataRoot = Join-Path $env:LOCALAPPDATA "PersonalAIWorkspace\data"
New-Item -ItemType Directory -Force -Path $dataRoot
$env:PAW_DB_PATH = Join-Path $dataRoot "workspace.db"
$env:PAW_TIME_ZONE = "Australia/Sydney"
npm run dev
```

The runtime rejects database paths inside the repository or a configured
OneDrive root. Use `/healthz` for a basic health check and `/mcp` with MCP
Inspector or a ChatGPT development connection. `npm run seed` remains only for
the frozen synthetic Spike fixture; real inventory should use
`workspace_create_job_application`.

Before backing up or restoring, stop the Workspace process. Back up the closed
`workspace.db` to a user-controlled encrypted location. To reset, stop the
process and move the DB to a dated quarantine filename before restarting; the
runtime will create and migrate a fresh DB. Startup never deletes existing data.

### Verification

```text
npm run verify
```

Local tests prove domain, persistence, privacy enforcement, idempotency, and MCP
protocol behavior. Separate manual ChatGPT/Gmail evidence proves cross-app tool
orchestration, explicit approval behavior, and cross-conversation continuity.
