# Personal AI Workspace

## Thesis

**Build a persistent work-state layer for ChatGPT that turns conversations and external events into long-running goals, projects, tasks, actions, and outcomes.**

## Core Principle

> **Conversation is an interface, not the system of record.**

## Architecture

- **ChatGPT = primary interaction and reasoning host**, including interactive operations and the intended daily Job Tracker execution.
- **Workspace = persistent state and coordination**, with evidence, lifecycle validation, ownership, versioning, idempotency and authorization.
- **Website = reporting interface over the same database**, with existing explicit manual email checks as a secondary convenience.
- **Connected services = source facts and capabilities**; Gmail remains authoritative for original messages.
- **MCP / Apps SDK = integration surface**; the deployed tool transport is MCP.

First domain: **Job Search**. Cross-conversation continuity is the original verified
proof; reliable daily ingestion is the next operational acceptance gate.
See the [authoritative core workflow](docs/architecture/CORE_JOB_WORKFLOW.md).

## Current state — 2026-09-08

The [release handoff](docs/mvp/RELEASE_HANDOFF_2026-09-08.md) is the current deployment
record. The [documentation index](docs/INDEX.md) separates active contracts,
historical evidence and unimplemented proposals. Versioned milestone records
retain the scope and results of their own dates.

| Area | Documented state | Remaining gate |
| --- | --- | --- |
| Production | `mail-layout-20260908-r2`, migrations 001–011, 29 MCP tools; Lightsail Sydney, Caddy web ingress, private MCP tunnel and OIDC login | No new image inspection in this documentation review |
| Durable operations | Applications, evidence, lifecycle transitions, Tasks, candidates, recommendation runs and scan receipts; shared SQLite database | Availability does not establish daily adoption or complete ingestion |
| Website | [Job Search](https://workspace.ai-radar-lab.com/workspace/job-search/today): inventory, Today, timelines, saved dossiers, recommendation views and collapsed mail-status cards | Existing manual checks cover registered applications, not the full daily policy |
| Mail ingestion | Gmail MCP reads, stable account-qualified source identities, bounded resumable batches and incremental manual checks deployed | Complete manual and actual scheduled scan acceptance pending |
| Daily automation | Latest task evidence records both tasks paused after a reported host write block; fresh live ledger read still shows only one historical PARTIAL manual run and no checkpoints or processing streams | Resolve actual ChatGPT execution blocker, then pass [daily acceptance](docs/mvp/DAILY_WORKFLOW_ACCEPTANCE.md); task switches were not fetched in this review |
| Latest local code | [Diagnostics and relevance filtering](docs/mvp/MAIL_CHECK_DIAGNOSTICS_2026-09-08.md): 40 files / 327 tests, type checks and build reported passing in an independent LF worktree | Not deployed; real-mail accuracy and historical mailbox failure cause remain unverified |
| Backend-owned receipts | [Requirements recorded](docs/architecture/MAIL_SCAN_BACKEND_LEDGER_REQUIREMENTS_2026-09-08.md) | Contract design, implementation, deployment and platform acceptance pending |
| Evaluation | [v0.2 retired; v0.3 adopted but not started](docs/dogfood/M4_REAL_USE_EVALUATION_v0.3.md) | Record a verified integrated baseline after manual and scheduled acceptance |

Production release evidence reports 291 passing tests and preservation of all
28 tables / 239 rows at the layout cutover. These are release-time observations,
not today's live counts or a test run performed by this documentation review.
The local 327-test result belongs to the later, undeployed package.

The last real website check saved four EMAIL records and one NOTE but was PARTIAL;
only one mailbox advanced application-scoped coverage. Those messages were job
recommendations, not confirmed application-state changes. A later authorized Codex
trial saved and read back two observations without a receipt. Neither establishes
complete daily coverage or successful ChatGPT scheduled writes.

**Next engineering gate:** restore the daily flow and independently verify its
receipt, actual source coverage, business writes and website readback. Scope stays
within seven days, normally yesterday/today with a 24-hour overlap. Only the existing
replacement task may eventually run at 08:00 Australia/Sydney after acceptance;
the obsolete task stays paused. See [recovery evidence](docs/mvp/JOB_TRACKER_RECOVERY_2026-09-08.md)
and the [ordered acceptance procedure](docs/mvp/DAILY_WORKFLOW_ACCEPTANCE.md).

## Evaluation and historical milestones

Spike 1B and M1/M2/M3 retain their verified milestone results in the
[historical index](docs/INDEX.md#historical-evidence). M4 Day 0/1 evidence remains
valid for its original operational checks. The frozen 12-tool evaluation no
longer describes the expanded shared production environment: its original
September 10/17 and October 1 decisions are retired, without rewriting thresholds
or claiming a pass or failure. [v0.3](docs/dogfood/M4_REAL_USE_EVALUATION_v0.3.md)
defines a new prospective integrated-workflow evaluation; its clock has not started.

The [intelligence ledger architecture](docs/architecture/JOB_SEARCH_INTELLIGENCE_ARCHITECTURE_v1.md)
and [ADR-012](docs/adr/ADR-012-job-search-intelligence-boundary.md) remain a design
baseline, not a fully implemented analysis system. Deployed candidate/digest
storage does not imply implementation of the full versioned skills and analysis ledger.

## Development and operations

Follow the [Development Continuity and Benefits Standard](docs/DEVELOPMENT_CONTINUITY_STANDARD.md).
New documentation must be entered in [docs/INDEX.md](docs/INDEX.md), including every
dated result or handoff. Historical evidence is retained; superseded rules link
to their replacement. Publishing source is separate from deploying or activating tasks.

## Local setup

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

## Cloud operations

The deployed service runs on Sydney Lightsail. Use the [C1 runtime runbook](docs/cloud/C1_RUNTIME_RUNBOOK.md),
[private MCP transport runbook](docs/cloud/C2_SECURE_MCP_TUNNEL.md), and
[web operations runbook](docs/cloud/S1_WEB_OPERATIONS_RUNBOOK.md), reconciled with
the current release handoff. Backup, rollback and logical-fingerprint procedures
are in the repository; earlier acceptance results remain indexed as history.

## Verification

Node.js 24 or later is required by package.json.

```text
npm run verify
```

This runs server/browser type checks, tests and the production build. Local checks
verify code behavior; real ChatGPT authorization, mailbox processing, independent
readback and actual scheduled execution require their own acceptance evidence.
