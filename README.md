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
`m2-task-today-verified-v0.1`. Slice M3 is complete locally and through the
fresh-database ChatGPT platform gate and is frozen at
`m3-real-lifecycle-verified-v0.1`.
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

M3 implements the complete approved lifecycle graph, transition-derived Tasks,
and atomic terminal Project closure plus cancellation of obsolete open Tasks.
It adds no migration or MCP tool. The scoped implementation contract and
verified local/platform results are in
[`docs/mvp/REAL_JOB_SEARCH_M3_PLAN_v0.1.md`](docs/mvp/REAL_JOB_SEARCH_M3_PLAN_v0.1.md)
and
[`docs/mvp/REAL_JOB_SEARCH_M3_RESULTS_v0.1.md`](docs/mvp/REAL_JOB_SEARCH_M3_RESULTS_v0.1.md).
The supported manual platform evidence is
[`tests/evaluations/chatgpt-m3.md`](tests/evaluations/chatgpt-m3.md).

### Proposed Job Search Intelligence architecture

The post-M4 design baseline now covers versioned job descriptions and resume
relationships, an evidence-backed skill taxonomy and matching ledger, a
review-first ingestion pipeline, Google Sheets as a projection, and complete
analysis provenance. It is documented in
[`docs/architecture/JOB_SEARCH_INTELLIGENCE_ARCHITECTURE_v1.md`](docs/architecture/JOB_SEARCH_INTELLIGENCE_ARCHITECTURE_v1.md)
and
[`docs/adr/ADR-012-job-search-intelligence-boundary.md`](docs/adr/ADR-012-job-search-intelligence-boundary.md).

This is an architecture baseline, not an active runtime feature. The M4
feature freeze remains in force: no connector, scheduler, migration, new MCP
tool, model call, or automatic admission has been added.

### M4 real-data Dogfood

M4 is a seven-day operating evaluation of the frozen MVP, not a feature slice.
Its scope, privacy boundary, Day-0 gate, daily protocol, exit criteria, and stop
conditions are in
[`docs/dogfood/M4_DOGFOOD_PLAN_v0.1.md`](docs/dogfood/M4_DOGFOOD_PLAN_v0.1.md).
Sanitized initialization evidence is recorded in
[`docs/dogfood/M4_DAY0_RESULTS_v0.1.md`](docs/dogfood/M4_DAY0_RESULTS_v0.1.md).
The seven-day aggregate log template is
[`docs/dogfood/M4_DAILY_LOG_v0.1.md`](docs/dogfood/M4_DAILY_LOG_v0.1.md).
The prospectively locked adoption and utility metrics, definitions, and Day
7/14/28 decisions are in
[`docs/dogfood/M4_REAL_USE_EVALUATION_v0.2.md`](docs/dogfood/M4_REAL_USE_EVALUATION_v0.2.md).
Day 0 passed with a fresh, unseeded external Workspace and the frozen 12-tool
surface. Day 1 then imported the explicitly authorized inventory with minimized
Gmail provenance and passed aggregate verification. Before Day 2, the
prospective utility metrics were locked without changing or retrospectively
rescoring the original seven-day gate. The frozen evaluation is active on the
M4 branch.

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

### Cloud always-on deployment

Cloud deployment is being developed separately from the frozen M4 product
evaluation. The C0 architecture and readiness decision is recorded in
[`docs/cloud/C0_READINESS_REVIEW.md`](docs/cloud/C0_READINESS_REVIEW.md).
The repository-side C1 runtime and operations procedure is in
[`docs/cloud/C1_RUNTIME_RUNBOOK.md`](docs/cloud/C1_RUNTIME_RUNBOOK.md).
No AWS runtime or real-data migration should be inferred from these documents;
those require separate runtime evidence in the later cloud stages.

### Verification

```text
npm run verify
```

Local tests prove domain, persistence, privacy enforcement, idempotency, and MCP
protocol behavior. Separate manual ChatGPT/Gmail evidence proves cross-app tool
orchestration, explicit approval behavior, and cross-conversation continuity.
