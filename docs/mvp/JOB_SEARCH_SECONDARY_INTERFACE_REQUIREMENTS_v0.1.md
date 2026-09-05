# Job Search Secondary Interface — Product Requirements v0.1

**Status:** Refined requirements; local S1-01 through S1-03 verified;
public/device and full-product acceptance remain pending.

**Date:** 2026-09-05.

**Confirmed work scope:** The user initially selected requirements and a
development checklist, then requested P0 technical planning. The
[P0 technical plan](JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md) defines identity
linking, browser ingress and two-stage delivery. The user subsequently approved
[local S1 implementation and synthetic testing](S1_LOCAL_SCOPE_DECISION_2026-09-05.md).
[S1-01 identity results](S1_01_IDENTITY_RESULTS_v0.1.md) record the first local
package; public setup and cloud release remain separately reviewed.
[S1-02 query results](S1_02_QUERY_RESULTS_v0.1.md) record authenticated bounded
reads and the local terminal-task MCP tool.
[S1-03 page results](S1_03_WEB_RESULTS_v0.1.md) record responsive read-only views
and local synthetic browser checks. Public/mobile acceptance remains pending;
these results do not complete the first product increment.

**Basis:** The user's Multi-Domain Secondary Interface Requirements and the
subsequent product analysis. This document makes the first Job Search experience
testable. It complements the [architecture proposal](../architecture/DOMAIN_SECONDARY_INTERFACES_PROPOSAL_v0.1.md),
which remains the source for technical boundaries. Neither document is evidence
that a new interface or candidate integration is running.

## 1. User outcome and scope

The user can receive a short job recommendation, retain an interesting job,
record an actual application, inspect its next action, complete work, and resume
from the same state in another conversation or on iPhone with Windows off.

ChatGPT is the preferred entry for reasoning. The user can also open a saved
Workspace link directly and carry out supported actions without starting a chat.
Both entries use the same authoritative business records.

The complete first product increment covers candidate continuity and application
operations. An early read-only interface is an intermediate release and must not
be described as completing the recommendation-to-application experience.

### In scope

- Candidate recommendations with a short advisory fit reason and source link.
- Durable candidate save/dismiss decisions and recommendation history.
- Recording an actual application and linking it to an existing candidate.
- Application inventory, detail, tasks, lifecycle evidence and bounded history.
- Today, upcoming work and separate applications-without-open-task signals.
- Individual supported task actions and consistent readback across entries.
- Direct object links, mobile layouts, freshness and recoverable failures.

### Deferred

Full resume/JD scoring, skill taxonomies, automatic applications, bulk changes,
calendar booking, autonomous lifecycle admission, other domains, a new backend
scheduler, a generic workflow engine, and an embedded conversational assistant.
The richer [Job Search Intelligence plan](../architecture/JOB_SEARCH_INTELLIGENCE_ARCHITECTURE_v1.md)
is not a prerequisite for short directional recommendations.

## 2. End-to-end user journeys

### J1 — Find and retain a job

The daily digest contains company, role, location, a short reason it may fit,
relevant uncertainty and a usable source link. The user can open the listing,
save the candidate, or dismiss it. Saving means interest, not an application.
The next conversation can retrieve that decision by stable candidate identity.

Keep the existing preference of 09:00 Australia/Sydney through ChatGPT
notifications, including local daylight-saving changes. Scheduling remains
external to Workspace; the new recording integration owns candidate continuity.
Do not promise notification delivery when only a run or delivery attempt is known.

### J2 — Record an actual application

The user explicitly records that they applied, through ChatGPT or a supported
form. The existing application-registration command creates an application or
returns possible duplicates for resolution. Link the selected candidate only
after a successful authorized creation or explicit selection of an existing
application. Merely clicking a posting's external Apply link is not evidence
that an application was submitted.

Preserve the candidate and recommendation history after linking. A failed link
can be retried without creating another application. A client must never invent
an application ID or resolve an ambiguous match without the user's decision.

### J3 — Inspect and act

Open an application directly or filter the inventory. Inspect its current state,
next task, due time and supporting evidence. Complete a task through an explicit
action. Once the server acknowledges success, show the completed task and its
completion time; it remains available after a reload and in another entry.

### J4 — Continue reasoning

Open a specific application from ChatGPT. From its detail view, copy a short
context reference and continue in ChatGPT, which reads fresh Workspace state.
The initial handoff may require the user to paste and submit the reference;
automatic injection into an arbitrary conversation is not an MVP promise.

## 3. Requirements

| ID | Required behavior |
| --- | --- |
| R01 — Independent entries | A saved object link works without a preceding ChatGPT interaction. Login returns to that object, subject to ownership checks. |
| R02 — Identity | Verified browser access maps to the existing Principal and Workspace. Another account or a guessed object ID provides no data access. |
| R03 — Information status | Distinguish source observations, model suggestions and admitted business state. Observing or proposing an interview does not itself change lifecycle. |
| R04 — Freshness | Show last successful read time and relevant source observation time. Refresh on return to the foreground; preserve local drafts and surface newer server versions. |
| R05 — Inventory | Search/filter/sort applications and candidates in separately labeled views. Application rows show company, role, lifecycle, next due task and open-task count. Show result totals and loaded coverage. |
| R06 — Detail | Show actual admitted lifecycle events, evidence links and open/completed/cancelled tasks. Preserve skipped lifecycle stages and label partial history accurately. |
| R07 — Today | Keep deterministic attention and upcoming work, with their reasons. Display applications without open tasks as a separate review group, not an inferred deadline. Count each task once within a group even with several reasons. |
| R08 — Task actions | Reuse supported task creation/update commands. DONE and CANCELLED remain terminal; resumed work requires a new task. No completion success before server acknowledgment. |
| R09 — Candidate decisions | Save/dismiss decisions survive reload and new conversations. They are independent of provider availability and application lifecycle. An explicit restore action may reverse a dismissal; recommendations cannot reverse it. |
| R10 — Recommendation provenance | Retain stable posting identity, source URL, observation time and run/item references. A fit reason is advisory and exposes missing evidence without a fabricated precision score. |
| R11 — Registration/linking | Preserve existing duplicate detection and authority rules. Link only a confirmed actual application; same-operation retries must not create duplicate applications or links. |
| R12 — Concurrency | Retain expected record/lifecycle versions and one idempotency key per user intent. Reject stale changed writes; refresh and let the user decide. Do not silently overwrite or replay a changed intent. |
| R13 — Failure behavior | Keep drafts on failed saves. A lost response is an uncertain outcome: reread or retry the same intent key before declaring failure or creating a new command. |
| R14 — Mobile/accessibility | Core flows work on iPhone in portrait orientation, with labeled controls, visible focus and readable status text. No core action requires hover, dragging or a wide desktop table. |
| R15 — Continuity | A supported mutation made through one entry is visible after a fresh read through the other. Completed records remain directly retrievable. |
| R16 — Runtime scope | Windows-off use is required. A read-only UI, a successful cloud MCP test and the existing external digest do not separately prove the entire new experience. |

The initial UI does not require a background live-update channel. Foreground
refresh, explicit refresh and server-enforced version checks provide the initial
freshness behavior. On an unavailable network, label previously loaded content
as stale, retain drafts only for the current session and disable submission
until online. No offline mutation queue or durable browser business database.

## 4. Minimal information architecture

```text
Job Search
  Today
    Needs attention / Upcoming / Applications without open tasks
  Jobs
    To consider / Saved / Dismissed / Linked to an application
  Applications
    Filterable inventory, including closed applications
  Detail
    Job source and short fit reason, or application state and next action
    Tasks / Evidence / Available history
```

These are views of one Job Search area, not separate applications. Candidates
and applications may share visual components while retaining distinct records
and actions. A candidate detail links to its application once one exists.

On iPhone, prioritize role/company, status, next action and due time. Place
evidence and history below or behind labeled detail controls. Desktop may show
more columns. Use text alongside status colors. Empty states distinguish no
records from no filter matches, insufficient access and failed retrieval.

## 5. State, authority and recommendation continuity

### Record ownership

| Concern | Owner / rule |
| --- | --- |
| Original posting/email | External provider; Workspace retains minimized references and relevant observations. |
| Candidate decision | Workspace; explicit user save, dismiss or restore action. |
| Short fit suggestion | Advisory output with provenance; never authority to apply or advance lifecycle. |
| Actual application and task state | Existing Workspace application commands and domain rules. |
| Digest schedule and notification execution | Existing external ChatGPT workflow. |
| Recommendation/run history after integration | Workspace ledger written through a scoped recording command and read back. |
| UI drafts and filters | Transient presentation state; no competing source of business truth. |

The candidate schema must separate the user's decision (unreviewed, saved,
dismissed) from source availability (available, unavailable, unknown) and any
application link. An expired source must not erase a saved decision. Store
recommendation occurrences separately from the latest fit suggestion so a new
run does not overwrite previous delivery context.

Use provider posting identity or a provider-aware canonical URL for exact
deduplication. Do not strip URL parts that encode the posting ID. Company/role
similarity alone is not a safe merge key. Preserve ambiguous matches for review.
Already dismissed or linked candidates are excluded from ordinary new-job
recommendations until an explicit decision changes eligibility. Saved candidates
remain accessible without being repeatedly presented as newly discovered.

A recording command may append observed candidates and run items under a
separately defined narrow automation policy. It cannot change user decisions,
create an application, or admit lifecycle changes. That policy must be defined
before giving the existing read-only digest write capability. Track source
coverage and failures so an empty result is not falsely called a successful
search with no matching jobs. Retention for run history must be defined before
the first scheduled writer is enabled.

## 6. Acceptance scenarios

All scenarios below are **NOT RUN for the new interface**. Existing cloud/MCP
evidence may inform setup but does not count as passing these UI scenarios.
Use synthetic job data in checked-in fixtures and sanitize manual evidence.

| Test | Given / action | Required result | Requirements |
| --- | --- | --- | --- |
| A01 | Open a saved application link while signed out, then log in | Same authorized application opens; another account cannot read it. | R01, R02 |
| A02 | Record an interview observation and proposal without admission | Evidence/proposal appears with its label; canonical lifecycle is unchanged. | R03 |
| A03 | Modify a task through ChatGPT while its detail view is open; return to the UI | Refresh displays new state; an older draft cannot overwrite it silently. | R04, R12, R15 |
| A04 | Load over 100 applications and more than ten history entries | Paging/coverage is truthful and records remain reachable without duplicates. | R05, R06 |
| A05 | Display an undated high-priority task, a blocked overdue task and an application with no open task | Existing deterministic reasons remain correct; gap is separate; overlapping reasons do not inflate task count. | R07 |
| A06 | Complete a task and open a fresh conversation | Exact task read returns DONE, completion time and current version; UI history still contains it after reload. | R06, R08, R15 |
| A07 | Save one candidate and dismiss another; run recommendations again | Decisions persist; dismissed/saved jobs are not mislabeled as new; neither creates an application. | R09, R10 |
| A08 | Record an actual application for a candidate that may match existing inventory | Existing duplicate resolution applies; successful linking preserves history and retry does not duplicate the application. | R11 |
| A09 | Double-submit a task command or lose its response | Same intent is executed once; retry/readback resolves uncertainty; errors retain user input. | R08, R12, R13 |
| A10 | Use iPhone portrait while Windows stays completely off | Direct open, filtering, save/dismiss, task completion and fresh readback work; core actions require no horizontal table scrolling. | R14, R16 |
| A11 | A source fails or delivery has no acknowledgment | Coverage is partial/failed and delivery unknown as appropriate; no false “no jobs” or “delivered” claim. | R10, R13 |
| A12 | ChatGPT opens an object and the UI returns its context reference | Correct object resolves and fresh state is retrieved; copyable fallback works without host SDK globals. | R01, R15 |

After functional acceptance, dogfood with real use: record whether the user can
find next actions, inspect several applications and recover completed work with
less repeated context reconstruction. Track observed outcomes and friction;
set any new evaluation thresholds before collecting that evaluation's data.
Do not retrospectively modify the current M4 metrics.

## 7. Development checklist and release order

The [P0 technical plan](JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md) refines delivery
into S1 (existing application/task operations) and S2 (recommendation continuity).
For S1, sequence P0 → P1 → P2 → the task-completion subset of P4, including its
audit and exact terminal-task MCP readback. P3 is not a dependency of that subset.
The table retains package IDs; its row order is not a requirement to deliver
candidate storage before task completion. S2 completes P3/P5 and the full P6
acceptance gate. Broader P4 browser editing remains later work. A read-only S1a
preview is intermediate; S1 is usable but does not complete the full increment.

The [M4 boundary](../dogfood/M4_REAL_USE_EVALUATION_v0.2.md) retains its deployed
runtime freeze through the 2026-10-01 decision, with the explicitly approved
local S1 exception linked above. Public access still requires acceptance of the
concrete authentication design under [ADR-007](../adr/ADR-007-identity-auth-boundary.md)
and separate cloud publication review.

| Order | Concrete implementation package | Dependencies / exit evidence |
| --- | --- | --- |
| P0 | Confirm runtime scope; finalize single-user identity linking, HTTPS ingress, costs and rollback | Scope decision and concrete auth design before public exposure; existing data identity preserved. |
| P1 | Add authorized bounded read queries, terminal-task lookup and stable object routes | Existing service/MCP regression checks; A01, A04 and read portions of A06/A12. |
| P2 | Build responsive Today, application inventory and detail over those reads | A03 refresh behavior, A05, mobile read flow; label this an intermediate read-only release. |
| P3 | Define candidate/link/run contracts and migration; implement manual save/dismiss/restore and application linking with actor-attributed audit | Schema rollback plan, decision authority, privacy and idempotency checks; A07/A08 with synthetic data. |
| P4 | Add supported individual task commands and actor-attributed audit for new UI writes | Preserve existing terminal and derived-task rules; A06/A09; stale writes cannot silently apply. |
| P5 | Give the external digest only its scoped recording capability; add candidate views and run coverage | Retention/policy contract defined, record/readback proven; A07/A11; no new backend scheduler. |
| P6 | Verify the complete mobile and cross-conversation journey and dogfood it | All A01–A12 passed with evidence; only then call the first product increment complete. |

Application registration/linking in P3 does not require a new lifecycle editor.
Subsequent lifecycle operations can continue through existing ChatGPT tools;
a full visual admission interface is a later slice. No new domain is included.

Implementation should concentrate changes in application queries/commands,
transport identity/adapters, the Job Search web views and scoped persistence
migrations. Reuse existing [task tests](../../tests/integration/task-service.test.ts),
[inventory tests](../../tests/integration/real-job-application-inventory.test.ts),
[lifecycle tests](../../tests/integration/real-lifecycle-m3.test.ts) and
[MCP transport tests](../../tests/integration/mcp-transport.test.ts) when those
behaviors change; add focused tests for new query, identity and candidate contracts.

## 8. Relationship to the original requirements

This document preserves the original primary/secondary interface split, shared
authority, domain-specific semantics and defer-other-domains rule. It clarifies
that direct UI entry is allowed, source/inference/state are distinct, freshness
must be visible, Today gap signals are not deadlines, and mobile has its own
presentation needs. Candidate continuity is the explicit addition derived from
the user's daily recommendation request, rather than a feature attributed to
the original application's examples.

Future domains may require limited shared-core refactoring. The requirement is
to preserve existing domain behavior and ownership boundaries, not to guarantee
that the initial core will never change.
