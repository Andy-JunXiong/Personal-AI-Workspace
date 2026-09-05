# Personal AI Workspace

> Working name.

## Thesis

**Build a persistent work-state layer for ChatGPT that turns conversations and external events into long-running goals, projects, tasks, actions, and outcomes.**

## Core Principle

> **Conversation is an interface, not the system of record.**

## Architecture

- **ChatGPT = primary interaction + reasoning host**
- **Workspace = persistent state + coordination**
- **Domain interfaces = proposed secondary structured views and governed operations**
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

### Proposed domain secondary interfaces

ChatGPT remains the primary conversation and reasoning entry. Domain interfaces
will provide structured inspection and operations over the same authoritative
Workspace state. The repository assessment, target architecture, Job Search UI
MVP, future-domain boundaries, risks, and gated delivery sequence are in
[`docs/architecture/DOMAIN_SECONDARY_INTERFACES_PROPOSAL_v0.1.md`](docs/architecture/DOMAIN_SECONDARY_INTERFACES_PROPOSAL_v0.1.md).

The refined [Job Search interface requirements](docs/mvp/JOB_SEARCH_SECONDARY_INTERFACE_REQUIREMENTS_v0.1.md)
define the complete recommendation-to-application-to-task journey, independent
mobile entry, state/freshness rules, sixteen requirements, twelve acceptance
scenarios and a concrete development checklist. A read-only interface is an
intermediate release; completing the first increment also requires durable
candidate decisions and cross-entry task readback.

The [P0 technical plan](docs/mvp/JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md)
specifies a proposed Google login association with the existing Workspace,
separate browser HTTPS ingress, an S1 application/task operating release and
an S2 recommendation-continuity release. It includes the terminal-task MCP read
gap, audit and retry boundaries, rollback, and stage-specific acceptance.
The user subsequently approved a
[local S1 scope exception](docs/mvp/S1_LOCAL_SCOPE_DECISION_2026-09-05.md).
[S1-01 identity linking and login](docs/mvp/S1_01_IDENTITY_RESULTS_v0.1.md) are
implemented locally and passed 153 tests, typechecking and build. Real Google
login, public authentication acceptance and cloud release remain pending.
[S1-02 bounded reads and terminal-task readback](docs/mvp/S1_02_QUERY_RESULTS_v0.1.md)
are also implemented locally (166-test milestone). The subsequent
[S1-03 responsive pages](docs/mvp/S1_03_WEB_RESULTS_v0.1.md) pass 171 tests,
server/browser typechecking, build and synthetic Chrome checks at desktop,
390px and 320px viewports. Local MCP discovery has 13 tools, with the original
twelve contracts preserved. Task completion/audit is the next local package.
The [2026-09-05 handoff](docs/mvp/S1_HANDOFF_2026-09-05.md) records today's stopping
point and the concrete S1-04 resume steps. Publishing this source checkpoint to
GitHub does not deploy the new web interface.

Start with an authenticated Job Search inventory, Today, and application detail
including completed Tasks. Reuse application services and preserve authority,
versioning, idempotency, and ownership checks. Browser login and HTTPS ingress
are separate work from the verified private MCP cloud connection. Property,
Travel, and Shopping remain future candidates, not implementation scope.

The external ChatGPT daily job digest currently reads application state for
filtering; its recommendations are not durable Workspace records. The proposal
therefore includes a separately gated candidate/history integration with short
advisory fit reasons, without requiring full resume or skill analysis.

Local S1-01 adds an optional loopback authentication listener, immutable request
identity, identity-link migration and an operator command. It defaults off and
exposes no business-write or MCP route. S1-02 adds authenticated web read APIs and
the private `workspace_get_task` MCP read. S1-03 adds read-only Today, inventory,
application/task detail, evidence/history and context-copy pages. Browser
completion, candidate storage and digest recording are not implemented yet.
For a synthetic local UI preview, run `npm.cmd exec tsx tests/manual/web-preview.ts`;
this test-only fixture accepts no real database or account and is excluded from
the production build.
The original 12-tool cloud deployment and real-data M4 evaluation remain frozen;
local synthetic S1 work proceeds under the recorded exception.

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
The C1 runtime and operations procedure is in
[`docs/cloud/C1_RUNTIME_RUNBOOK.md`](docs/cloud/C1_RUNTIME_RUNBOOK.md).
The C2 private ChatGPT transport procedure is in
[`docs/cloud/C2_SECURE_MCP_TUNNEL.md`](docs/cloud/C2_SECURE_MCP_TUNNEL.md).
C1/C2 were deployed and accepted on Sydney Lightsail on 2026-09-05 using a
fresh non-production database. Backup/restore, image rollback, private connector
readback, authentication rejection, and whole-instance reboot recovery passed;
see the [runtime results](docs/cloud/C1_C2_RUNTIME_RESULTS_v0.1.md).
C3 subsequently migrated the real M4 database and passed complete read-only
comparison plus an independent new ChatGPT conversation. The current connector
reads the original real Workspace on the cloud; the local original remains
stopped and retained for rollback. See [C3 runtime results](docs/cloud/C3_RUNTIME_RESULTS_v0.1.md).
The gated, recoverable migration procedure is documented in
[`docs/cloud/C3_REAL_DATABASE_MIGRATION.md`](docs/cloud/C3_REAL_DATABASE_MIGRATION.md).
The post-migration ChatGPT and Windows-PC-OFF acceptance procedure is in
[`docs/cloud/C4_C5_ACCEPTANCE_RUNBOOK.md`](docs/cloud/C4_C5_ACCEPTANCE_RUNBOOK.md).
C4 controlled-write persistence and C5 Windows-PC-OFF iPhone acceptance passed.
The user confirmed two independent mobile conversations, and cloud readback
verified the completed C5 test Task and preserved original Task; see
[C4/C5 runtime results](docs/cloud/C4_C5_RUNTIME_RESULTS_v0.1.md).

### Verification

```text
npm run verify
```

Local tests prove domain, persistence, privacy enforcement, idempotency, and MCP
protocol behavior. Separate manual ChatGPT/Gmail evidence proves cross-app tool
orchestration, explicit approval behavior, and cross-conversation continuity.
