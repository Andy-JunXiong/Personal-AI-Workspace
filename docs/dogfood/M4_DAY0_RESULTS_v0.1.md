# M4 Day-0 Initialization Results v0.1

**Status:** PASS — EMPTY REAL WORKSPACE READY

This file records only sanitized initialization evidence. It must not contain
credentials or real job-search content.

## Result summary

| Gate | Result |
| --- | --- |
| External database boundary | PASS |
| Fresh unseeded database | PASS |
| Migrations applied | PASS |
| Single Workspace identity | PASS |
| HTTP health | PASS |
| MCP discovery and ping | PASS |
| Frozen 12-tool surface | PASS |
| Empty real-data baseline | PASS |
| Clean process shutdown | PASS |

## Evidence

Day-0 initialization ran on 2026-09-04 with
`PAW_TIME_ZONE=Australia/Sydney`. The resolved database path is:

```text
C:\Users\maki8\AppData\Local\PersonalAIWorkspace\data\workspace.db
```

The path is outside both the Git/OneDrive repository and the configured
OneDrive root. It was absent before initialization, so no existing database
was overwritten or reset. The synthetic seed command was not run.

Startup created Workspace `d3c0a312-9c12-4b73-a598-eebf1b1de974` and applied
exactly the committed migrations:

```text
001_integration_spike.sql
002_real_job_application_inventory.sql
003_task_attention.sql
```

`GET /healthz` returned HTTP 200 with database availability. MCP discovery and
`workspace_ping` succeeded and reported service `personal-ai-workspace`
version `0.1.0`, the same Workspace ID, and database availability.

Discovery returned exactly these 12 tools:

```text
workspace_ping
workspace_get_project
workspace_create_job_application
workspace_list_job_applications
workspace_update_job_application
workspace_find_job_application
workspace_record_observation
workspace_propose_transition
workspace_admit_transition
workspace_create_task
workspace_update_task
workspace_get_today
```

Direct database inspection recorded this empty baseline:

| Table | Rows |
| --- | ---: |
| `principals` | 1 |
| `workspaces` | 1 |
| `projects` | 0 |
| `resources` | 0 |
| `state_transitions` | 0 |
| `transition_evidence` | 0 |
| `tasks` | 0 |
| `idempotency_records` | 0 |

The initialization server was stopped, port 3000 was closed, SQLite
`integrity_check` returned `ok`, and the WAL checkpoint completed with no busy
reader. Only the consolidated `workspace.db` remained. The external stderr log
was empty; sanitized Day-0 logs remain outside the repository under
`%LOCALAPPDATA%\PersonalAIWorkspace\logs`.

## Decision

Day 0 is supported. The database remains closed and empty until the user
explicitly authorizes the first real Job Application write. That write starts
Day 1 of the seven-day trial.
