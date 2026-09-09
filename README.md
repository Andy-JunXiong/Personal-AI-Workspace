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

## Current state — 2026-09-09

Latest page cleanup: `jobdetail-20260909-r1` removes the entire Gmail latest-progress
card from individual application details. All 374 tests and production rendering
checks on 24 applications passed; source `7bd8316` is published. See the
[follow-up release record](docs/mvp/APPLICATION_PROGRESS_TIMELINE_2026-09-09.md#follow-up-remove-gmail-panel-from-application-details).

Retained correction: [application progress timeline](docs/mvp/APPLICATION_PROGRESS_TIMELINE_2026-09-09.md),
`progress-20260909-r1`. Timelines show submission, actual progress and relevant
mail milestones; check receipts, vacancy marketing and task administration are
excluded. New mail retains its application category. All 374 tests and read-only
production checks across 24 applications passed; existing evidence is preserved.

Retained website capability: [application calendar and ongoing default](docs/mvp/APPLICATION_CALENDAR_2026-09-09.md),
`calendar-20260909-r1`. My Applications defaults to ongoing; the previous/current
month calendar shows daily submission counts and links, including closed history.
371 tests, desktop/mobile browser checks, production backup/recovery, unchanged
database fingerprints and read-only live rendering passed. Source `256bdf9` is published.

Follow-up correction: [ongoing-only keyword checks](docs/architecture/MAIL_SCAN_BACKEND_LEDGER.md#ongoing-only-keyword-follow-up--2026-09-09)
exclude rejected/ended applications and replace full-body website reads with
keyword-search metadata and snippets. Deployed as `ongoing-20260909-r1`: 369 tests,
backup/recovery, data preservation and website checks passed. Live targets are
12 ongoing applications; 12 ended applications are excluded. A representative
dual-mailbox keyword probe completed with zero full-body requests. A fresh full
website batch receipt and the first scheduled run remain separate acceptance.

Deployed follow-up: [resume event-conflict correction](docs/architecture/APPLICATION_RESUME_ASSOCIATIONS.md#production-event-conflict-correction--2026-09-09)
rejects changed content under a reused resume event ID, preserving safe retries
and explicit confirmation failures. Type checks, 368 tests and build passed;
production backup, recovery rehearsal, data preservation and web checks passed.
Source commit `1451def` was pushed and independently verified on GitHub main.
The next operational gate remains the first
actual September 10 scheduled execution described below.

The latest release is `jobdetail-20260909-r1`, retaining
[Drive resume association](docs/architecture/APPLICATION_RESUME_ASSOCIATIONS.md),
migration 014 and the mail-search workflow below.
374 tests passed. Production backup/recovery, source checks, health and data
preservation passed. Sixteen candidate file/revision associations across nine
existing applications were saved through MCP and read back; RSM's website matches.
Candidates are explicitly separate from actual submitted-file/version confirmation.
Interactive GPT can reuse these links; the daily task has not been extended to Drive.

Jun approved subject/company/exact-sender job-mail search: normally 24 hours,
recovery at most 72 hours, metadata screening before matching-body reads.
The [new search release](docs/architecture/MAIL_SCAN_BACKEND_LEDGER.md#job-metadata-search---2026-09-09)
passed 363 tests in `job-mail-20260909-r1`, migration 014, retained by the latest release.
Production migration, 30-tool discovery and website checks passed. Its explicit search scope
supersedes the old exhaustive seven-day acceptance gate. The retained Job Tracker
is now enabled with the revised policy; the obsolete task remains paused.
The third hosted JOB_METADATA run is verified COMPLETE/CLOSED for both matching
scopes, with zero pending/blocked sources and unresolved actions. The website
matches the stored receipt, and the next query reused the learned SEEK sender.
The filtered manual coverage/readback gate is passed. The saved daily policy
was verified and activated for 08:00 Australia/Sydney; next planned run is
September 10. Actual scheduled acceptance remains pending.

## Delivered capabilities and remaining gates

| Area | Delivered and verified | Remaining gate |
| --- | --- | --- |
| Production | `jobdetail-20260909-r1`, migrations 001–014, 30 MCP tools; 374 tests, build, backup/recovery, health and pre/post-cutover data preservation passed; source commit `7bd8316` published | Fresh full website keyword-check batch and first actual scheduled execution remain separate gates |
| Durable operations | Applications, attributable observations, lifecycle transitions, Tasks, candidates, recommendation runs and scan receipts share one Workspace database | Sustained daily use remains to be evaluated |
| Website | [Job Search](https://workspace.ai-radar-lab.com/workspace/job-search/today): Today, inventory, timelines, JD/skill reports and resume file/version links | Historical JD and skill reports still need source-grounded backfill |
| Mail search | Both mailboxes; subject keywords, stored companies and linked exact senders; normal 24-hour / maximum 72-hour recovery; matching-body review and deduplication | New applications require explicit submission-confirmation evidence; filtered completion does not cover every email |
| Manual acceptance | Run `6933e727-e6c8-4f48-9fdd-5913724a7e60` COMPLETE/CLOSED; both matching scopes complete, empty queues, website matches | First actual scheduled execution is a separate gate |
| Daily automation | Retained task enabled with verified policy for daily 08:00 Australia/Sydney; obsolete task paused | Verify the first scheduled receipt, next planned September 10; do not substitute a manual run |
| Resume association | Sixteen Drive candidate files/revisions linked to nine existing applications and read back | Actual submitted-file/version confirmation remains pending; daily unattended Drive discovery is not integrated |
| Evaluation | [M4 v0.3](docs/dogfood/M4_REAL_USE_EVALUATION_v0.3.md) adopted, not started | Establish the integrated baseline after scheduled acceptance |

**Next session:** check the retained task's actual scheduled result against its
Workspace run, matching scope, source progress and website. Then use confirmed
application materials for JD/resume comparison and interview preparation.
See [daily acceptance](docs/mvp/DAILY_WORKFLOW_ACCEPTANCE.md) and the
[resume workflow](docs/architecture/APPLICATION_RESUME_ASSOCIATIONS.md).

### Historical whole-mailbox recovery

The earlier exhaustive seven-day approach and its PARTIAL runs are retained in
[the mail ledger](docs/architecture/MAIL_SCAN_BACKEND_LEDGER.md).
The `mail-body-20260909-r4` release verified multipart body recovery and additive
migration 013; those capabilities remain deployed. Jun subsequently replaced
whole-mailbox acquisition with filtered job-mail search. Old unrelated pending
sources and old two-task pause instructions are historical, not today's backlog
or task policy. Release-specific counts and test totals retain their original scope.
The [documentation index](docs/INDEX.md) distinguishes those records from current
contracts and unimplemented proposals.

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
