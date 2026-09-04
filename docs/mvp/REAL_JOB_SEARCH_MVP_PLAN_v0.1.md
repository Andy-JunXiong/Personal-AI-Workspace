# Real Job Search MVP Plan v0.1

**Status:** APPROVED WITH MODIFICATIONS — M1/M2 COMPLETE; M3 LOCALLY IMPLEMENTED, PLATFORM GATE PENDING

## 1. Product objective and scope rule

The MVP tests whether ChatGPT plus Personal AI Workspace can be the user's
primary stateful job-search assistant across real applications and multiple
days. ChatGPT remains the interaction, reasoning, and cross-app orchestration
host. Workspace remains the durable work-state layer.

Implementation is divided into three hard-gated slices. A later slice must not
start until the prior slice passes its acceptance gate and all frozen Spike 1A
and Spike 1B behavior remains green.

## 2. Approved lifecycle and state boundaries

The only approved Job Application lifecycle states are:

```text
APPLIED
RECRUITER_CONTACT
INTERVIEWING
OFFER
ACCEPTED
REJECTED
WITHDRAWN
```

The approved successful terminal edge is `OFFER -> ACCEPTED`. `OFFER ->
WITHDRAWN` remains valid. `ACCEPTED`, `REJECTED`, and `WITHDRAWN` are terminal
lifecycle outcomes. Admission of any terminal outcome atomically sets
`Project.status = CLOSED` and cancels obsolete open Tasks.

There is no lifecycle state named `CLOSED`. Lifecycle records the business
outcome; `Project.status` records administrative active/closed state. Interview
rounds are metadata and interview preparation is a Task.

Observation, Proposal, Explicit Admission, and Durable State remain separate.
Gmail content and model inference never provide admission authority.

## 3. Exact slice order

### Slice M1 — Real Application Inventory

Implement only:

- `workspace_create_job_application`;
- `workspace_list_job_applications`;
- the existing exact `workspace_find_job_application`;
- narrow `workspace_update_job_application`;
- bounded-by-default `workspace_get_project`.

Creation registers a real Job Application at `APPLIED` and records an admitted
`NONE -> APPLIED` transition attributable to explicit user authority. Updating
may change only company, role, applied date, location, and a sanitized posting
reference. It uses a Project registration `recordVersion`; it never changes
`lifecycleState`, `lifecycleVersion`, or `Project.status`.

`workspace_get_project` returns current Project state, every open Task, the
latest 10 Resources, the latest 10 StateTransitions, and total counts. Outcomes
are omitted until an Outcome persistence model actually exists. No generic
pagination framework is added.

Creation must return `POSSIBLE_DUPLICATE` with zero writes when an exact active
company + role match exists. Ordinary creation authority never overrides this
guard. A deliberate second distinct application requires both structured
`allowDistinctDuplicate = true` and a different sanitized `postingReference`.

### Slice M2 — Task + Today

After M1 approval, implement:

- `workspace_create_task`;
- `workspace_update_task`;
- Task optimistic concurrency and idempotency;
- `dueAt` and `createdBy` exposure;
- deterministic, read-only `workspace_get_today`.

`get_today` may use only stored Task status/priority/due date and stored Project
state/change timestamps. It performs no Gmail scan, Calendar lookup, inferred
urgency, LLM ranking, or background work.

**Implementation result:** the three tools are implemented through dedicated
`TaskService` and `TodayQueryService` modules. Terminal Tasks do not reopen;
Today uses the configured Workspace timezone and an injected clock. The exact
result and ordering contract is frozen in
`REAL_JOB_SEARCH_M2_PLAN_v0.1.md`.

### Slice M3 — Real Lifecycle

After M2 approval, implement only the approved lifecycle and effects:

```text
APPLIED -> RECRUITER_CONTACT | INTERVIEWING | REJECTED | WITHDRAWN
RECRUITER_CONTACT -> INTERVIEWING | REJECTED | WITHDRAWN
INTERVIEWING -> OFFER | REJECTED | WITHDRAWN
OFFER -> ACCEPTED | REJECTED | WITHDRAWN
```

No edge leaves a terminal lifecycle state. No further states or self-transition
workflow are added.

Approved derived effects are limited to:

- `RECRUITER_CONTACT` -> `RESPOND_TO_RECRUITER`;
- `INTERVIEWING` -> `PREPARE_FOR_INTERVIEW`;
- `OFFER` -> `REVIEW_OFFER`;
- terminal admission -> close Project and atomically cancel obsolete open Tasks.

**Implementation result:** the full graph and effects are implemented without
a migration or new MCP tool. Derived lifecycle Tasks are HIGH priority;
`REVIEW_OFFER` is source-owned and remains outside manual Task creation. The
local result is recorded in `REAL_JOB_SEARCH_M3_RESULTS_v0.1.md`.

## 4. Migration plan by slice

### M1 migration

Add `projects.record_version INTEGER NOT NULL DEFAULT 1 CHECK
(record_version >= 1)`. Existing Project rows migrate to version 1. Registration
metadata remains in `metadata_json`; no search index, new entity, or duplicated
lifecycle field is introduced.

### M2 migration

Add Task mutation audit/concurrency fields: `record_version`, `updated_by`, and
`completed_at`. Existing `due_at` and `created_by` columns are reused and exposed.
This is implemented as `003_task_attention.sql`; existing Tasks migrate at
record version 1 with `updated_by = SYSTEM` and `completed_at = NULL`.

### M3 migration

No schema migration is expected: lifecycle strings, Project status, Task kind,
and transition records already support the approved values and atomic effects.
If implementation inspection disproves this, stop and revise the plan before
adding schema.

## 5. Acceptance gates

### M1 gate

**Result:** COMPLETE. Local automated verification passed, the original
duplicate-protection defect was remediated, and the successful fresh-DB
ChatGPT platform rerun supports creation, listing, metadata update, record
versioning, lifecycle isolation, and exact active duplicate protection. See
`REAL_JOB_SEARCH_M1_RESULTS_v0.1.md`.

1. Create persists one real Job Application without fixture APIs.
2. Creation is command-idempotent and records explicit authority for the
   initial admitted transition.
3. Exact active duplicates return `POSSIBLE_DUPLICATE` with zero writes; company
   and role use the frozen exact normalization behavior.
4. Creation authority, model tool choice, and free-form prose cannot bypass the
   duplicate guard.
5. A distinct-duplicate override requires both the explicit structured flag and
   a different sanitized posting reference; retry is idempotent.
6. List is Workspace-scoped, active-only by default, deterministically ordered,
   and bounded without introducing pagination.
7. Exact company + role lookup retains `EXACT`, `NOT_FOUND`, and `AMBIGUOUS`.
8. Update accepts only approved registration metadata, requires
   `expectedRecordVersion`, and is idempotent.
9. A stale update fails without changing registration or lifecycle state.
10. Posting references retain only an HTTP(S) origin/path; credentials, query,
   and fragment are not durable.
11. `get_project` returns at most 10 Resources and 10 transitions plus accurate
   total counts and all open Tasks.
12. Cross-Workspace reads and writes fail.
13. Real runtime DB configuration defaults outside the repository and rejects
    repository/known OneDrive paths.
14. `npm run verify` and `git diff --check` pass.
15. All frozen Spike behavior remains green.

### M2 gate

Task commands must be Workspace-scoped, versioned, idempotent, and auditable.
`get_today` must be deterministic under an injected clock/timezone and return
only state-backed attention reasons. M1 and frozen Spike gates remain green.

**Result:** COMPLETE. Focused automated tests cover Task authority,
isolation, idempotency, optimistic concurrency, completion/terminal semantics,
all Today categories, the seven-day inclusive boundary, deterministic
ordering, Workspace isolation, read-only behavior, and injected-clock timezone
boundaries. The first manual ChatGPT run found a blocking Project-visibility
failure at `workspace_create_task`. The server-side invariant now makes
TaskService use the same authorized Project resolver as
`workspace_get_project`, and real M1-to-Task plus published-MCP regressions
pass. A canonical fresh-external-database ChatGPT retest then passed M2-A daily
attention, M2-B mutation integrity, and M2-C deterministic cross-conversation
readback. See `REAL_JOB_SEARCH_M2_RESULTS_v0.1.md` and
`tests/evaluations/chatgpt-m2.md`.

### M3 gate

Every approved edge and every rejected edge is tested. Proposal does not mutate
state. Admission requires explicit user authority, checks lifecycle version,
and applies lifecycle, derived Task, terminal closure, and Task cancellation in
one transaction. Retry creates no duplicate transition or Task. M1, M2, and
frozen Spike gates remain green.

**Local result:** PASS. Automated coverage proves all 13 approved edges, all 36
rejected state pairs, derived-Task retry safety, terminal effects, rollback,
and the 12-tool MCP transport. The fresh-external-database ChatGPT M3-A/B/C
platform evaluation remains pending; M3 must not be merged or tagged before it
passes.

## 6. Frozen Spike 1A/1B evidence and tests

The result/evaluation documents and verified tags are immutable historical
evidence. Do not rewrite:

- `docs/mvp/INTEGRATION_SPIKE_RESULTS_v0.1.md`;
- `docs/mvp/INTEGRATION_SPIKE_1B_RESULTS_v0.1.md`;
- `tests/evaluations/chatgpt-spike-1a.md`;
- `tests/evaluations/chatgpt-spike-1b.md`.

The following automated semantics remain frozen through all slices:

- observation never mutates Project lifecycle;
- proposal never mutates Project lifecycle;
- runtime admission requires explicit user authority;
- optimistic lifecycle concurrency and command idempotency;
- transition-derived Task uniqueness;
- durable separate-process readback;
- exact/non-fuzzy Workspace-scoped Job Application lookup;
- strict `gmail-job-observation-v0.1` minimization and rejection behavior;
- Spike 1B retry behavior and no duplicate Resource/transition/Task.

Existing tests covering those semantics remain present. The MCP discovery test
may extend its expected tool list slice by slice, but its existing tool schemas,
calls, and behavioral assertions must remain.

## 7. Day-0 real-data storage prerequisite

Code may remain in the Git/OneDrive development directory. A real Workspace
SQLite database may not.

`PAW_DB_PATH` remains the configuration boundary. On Windows the intended path
is:

```text
%LOCALAPPDATA%\PersonalAIWorkspace\data\workspace.db
```

The runtime creates the directory and applies migrations. Before dogfooding:

1. set `PAW_DB_PATH` to the absolute Local App Data path;
2. start Workspace once and confirm `workspace_ping` succeeds;
3. confirm the resolved database path is outside both the repository and every
   configured OneDrive root;
4. keep `.db`, `.db-wal`, and `.db-shm` files untracked;
5. do not reuse the synthetic Spike database.

Backup behavior: stop the Workspace process cleanly, copy the closed
`workspace.db` to a user-controlled encrypted backup location, and restart.
Do not copy a live database while WAL writes are possible. Restore only while
the process is stopped, retaining a copy of the replaced DB.

Reset behavior: stop the process, move the DB to a dated quarantine/backup
name, then start Workspace to create a new migrated DB. Reset is explicit and
recoverable; no startup path automatically deletes data.

## 8. Final MCP tool surface after M3

Read-only tools:

```text
workspace_ping
workspace_get_project
workspace_list_job_applications
workspace_find_job_application
workspace_get_today
```

Mutation tools:

```text
workspace_create_job_application
workspace_update_job_application
workspace_create_task
workspace_update_task
workspace_record_observation
workspace_propose_transition
workspace_admit_transition
```

No generic search, history, connector, workflow, memory, UI, outbound email, or
model tool is added.

## 9. Explicit non-goals

Background Gmail ingestion, polling, webhooks, Calendar/Drive/GitHub
integration, semantic or vector matching, dashboards, mobile apps, production
OAuth redesign, multi-user productization, a second LLM layer, a workflow
engine, generic assistant/memory behavior, automatic outbound email, lifecycle
states beyond the approved seven, and generic pagination/history are out of
scope.
