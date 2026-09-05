# S1-02 — Bounded queries and terminal-task readback

**Date:** 2026-09-05 (Australia/Sydney).

**Status:** Local implementation and synthetic verification passed.

**Authority:** The user requested this next package under the
[approved S1 local scope](S1_LOCAL_SCOPE_DECISION_2026-09-05.md). No production
database, cloud deployment, public endpoint or real job-search record was changed.

## Implemented surface

`JobSearchQueryService` supplies Workspace-scoped application, task, lifecycle
history and evidence reads. Both authenticated browser requests and the new MCP
read use this application layer. Browser requests revalidate the session/link and
construct a fresh immutable identity context before accessing data.

| Read | Implemented behavior |
| --- | --- |
| `GET /api/v1/job-search/today` | Existing deterministic Today result plus `asOf`; the configured runtime timezone is passed through. |
| `GET /api/v1/job-search/applications` | Filtered, sorted pages with task count and exact earliest dated open task. |
| `GET /api/v1/job-search/applications/{id}` | Current application, versions and collection counts without unbounded child records. `totalCounts.history` counts all transition statuses. |
| `GET /api/v1/job-search/applications/{id}/tasks` | Pages of open or selected-status tasks, including DONE/CANCELLED. |
| `GET /api/v1/job-search/applications/{id}/history` | Admitted events by default; explicit proposal/rejected/all filters retain status labels and evidence IDs. |
| `GET /api/v1/job-search/applications/{id}/resources` | Minimized evidence references and observations; stored raw snapshot data is omitted. |
| `GET /api/v1/job-search/tasks/{id}` | Exact task with status, completion time and record version, including on closed applications. |
| MCP `workspace_get_task({taskId})` | Same exact task projection inside `result.task`, annotated read-only. |

The local MCP surface now has **13 tools**. The previous twelve retain their
inputs and outputs, including the legacy 100-application cap and ten-item Project
history. Historical 12-tool acceptance records and the deployed cloud baseline
remain valid for their original revisions; the new tool is not deployed there.

No S1-02 migration or new dependency was needed. Existing application/task
mutation code and browser write restrictions remain in force.

## Query and pagination contract

All collection queries accept `pageSize` (integer 1–100, default 25) and an
optional opaque `cursor`. Unknown keys, repeated parameters, invalid IDs and
invalid enum/numeric values are rejected rather than silently ignored.

| Collection | Additional parameters |
| --- | --- |
| Applications | `status=OPEN` (default, includes ACTIVE/PAUSED), `CLOSED` or `ALL`; optional exact `lifecycle`; `q` for literal company/role substring search; `sort=UPDATED_DESC` (default), `COMPANY_ASC` or `NEXT_DUE_ASC`. |
| Tasks | `status=OPEN` (default), `ALL`, `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE` or `CANCELLED`; order is updated time descending, ID ascending. |
| History | `status=ADMITTED` (default), `PROPOSED`, `REJECTED` or `ALL`; order is admitted time when present, otherwise proposed time, descending, then ID. |
| Resources | Order is observed time descending, then ID. |

Search normalizes both operands with NFKC, whitespace normalization and lowercase;
SQL wildcard characters remain literal. Company sorting uses SQLite NOCASE with
role and ID tie-breakers; it is deterministic, not locale-specific collation.
Next-due sorting places undated/no-task applications last. Undated open tasks
still contribute to the task count but do not receive an inferred deadline.

Each page returns `items`, exact matching `totalCount`, `nextCursor`, `asOf`, and
`coverage` with offset, returned, loaded, hasMore and complete. Loaded is the
cumulative traversal position; complete means no continuation remains. Clients
must retain prior pages or reload from the beginning when starting a new view.

Cursors are HMAC-protected and bound to owner/Workspace, collection, parent,
filters, sorting and page size. They deliberately exclude request ID/channel, so
fresh browser request contexts can continue the same traversal. They expire
after fifteen minutes and become invalid after a server restart. They confer no
object access; authorization runs before query execution.

Within one SQLite read transaction, the service streams the matching projection
to calculate its content fingerprint and exact count, retaining at most one page
of items in JavaScript. A matching-result change invalidates continuation. This
includes membership, ordering, projected task summaries and task status changes;
it is not silently rebased onto a new result set.

HTTP returns 401 for unavailable authentication, identical 404 bodies for missing
and inaccessible objects, 400 for invalid query arguments, and 409 with
`reloadRequired=true` for `INVALID_CURSOR` or `STALE_CURSOR`. Unexpected failures
remain a generic 503. Authenticated responses retain no-store/referrer protections.

## Verification evidence

`npm.cmd run verify` passed: **18 test files / 166 tests**, plus typecheck and
production build. The thirteen new tests extend the preceding 153-test baseline.

- Traversed 107 applications without gaps or duplicates while the unchanged
  legacy list remained capped at 100; tested deterministic ties and page limits.
- Verified normalized literal search, lifecycle/open/closed filters, due ordering,
  task counts and exclusion of completed tasks from due summaries.
- Reused a cursor through a fresh request identity; rejected cross-owner,
  cross-collection, altered-filter/page-size, tampered, expired and stale cursors.
- Read 27 tasks and more than ten history/evidence entries; proposals remained
  distinct from admitted lifecycle state and raw snapshots were absent.
- Reopened an external synthetic database and recovered exact DONE/CANCELLED
  tasks on a closed application, with completion time/version and zero read writes.
- Denied missing, other-owner and non-Job-Application objects at the new query
  boundary. HTTP missing and inaccessible child reads returned the same 404.
- Verified actual authenticated HTTP reads, continuation across requests,
  revocation, argument validation, configured timezone and zero database changes.
- Two independent MCP clients recovered identical terminal tasks on a closed
  application. The published read-only annotation and 13-tool discovery passed.

The first invalid-cursor test exposed an eagerly opened SQLite iterator that
could remain busy when cursor validation failed. Query creation is now deferred
until cursor validation succeeds. A regression verifies subsequent writes still
work after rejected cursors. No application authority or database protection was
weakened to resolve the failure.

## Local query measurement

Reproduce with `npm.cmd exec tsx scripts/benchmark-job-search-queries.ts`.
The script accepts no existing database path, creates a fresh synthetic database
under the system temporary directory and removes only that generated directory.

Fixture: 1,000 applications, 5,000 open tasks, page size 25, one warm-up followed
by twenty measured reads per operation. No read changed database content.

| Query | Median | p95 |
| --- | ---: | ---: |
| First inventory page | 19.66 ms | 20.58 ms |
| Inventory continuation | 20.68 ms | 21.37 ms |
| Filtered inventory search | 13.70 ms | 14.25 ms |
| Application detail/counts | 0.09 ms | 0.14 ms |
| One application's task page | 0.19 ms | 0.29 ms |

These are measurements on this local Windows environment, not cloud, concurrency,
network or iPhone performance claims. Fingerprinting scans the matching result;
search and task-summary computation can scan additional Workspace rows. SQLite
may allocate its own sort/window-query working memory. Output/JavaScript page
storage is bounded, but database cost is not constant per page. The sample does
not justify an extra persisted revision model or migration; larger inventories
and simultaneous backup/web/MCP load still need deployment capacity measurement.

## Remaining work

S1-02 delivers backend reads and local MCP readback. It does not deliver rendered
application pages, task-completion controls/audit, actual Google/iPhone acceptance
or cloud publication. A valid saved object route still has no page until S1-03.
The S1-01 identity/storage caveats continue to apply.

**Next local package:** S1-03 responsive Today, application inventory and detail
pages over these authenticated reads. S1-04 adds browser task completion and its
audit; candidate/recommendation continuity remains S2.
