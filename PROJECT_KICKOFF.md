# Project Kickoff — Personal AI Workspace v0.1

## Current status — 2026-09-09

### Final session closeout - source library and candidate storage

The current release is `library-20260909-r4`, source `b8da4bb`, superseding
current-release labels in the earlier same-day entries below. See the
[active workflow and restart checklist](docs/architecture/JOB_LIBRARY_WORKFLOW.md#session-closeout-and-restart-point---2026-09-09)
for the next session and [README](README.md) for the reconciled runtime inventory.

Verified results: 85 private library records, ten SEEK alert candidates with
original references, zero full candidate JDs and zero fit records. The 24 existing
applications remain preserved. External model processing was declined and remains
disabled; no library matching call ran. Alert coverage is incomplete, including an
empty HTTP 204 response from the second mailbox. Native LinkedIn/SEEK sign-in is
not implemented. All 384 implementation tests and release/readback checks passed.

The user stopped work for today. This closeout updates documentation and publishes
to main only. Next preparation work is full JD collection and attributable
experience consolidation; keep external matching disabled. Actual September 10
scheduled application-mail acceptance remains a separate operational gate.
Publication will be checked against remote main after this documentation commit.

### Earlier same-day evidence

Latest correction: Jun requires ongoing-only follow-up and keyword-based mail
checks. The two Amazon applications were already REJECTED/CLOSED; bulk target
selection was wrong. The [correction ledger](docs/architecture/MAIL_SCAN_BACKEND_LEDGER.md#ongoing-only-keyword-follow-up--2026-09-09)
records ongoing target selection, metadata-only website reads and the separate
release gate. This supersedes earlier instructions to include rejected records
in manual checks, while retaining all historical evidence.

The correction is deployed as `ongoing-20260909-r1`, source commit `f85b9e6`
pushed/read back. 369 tests, build, backup/recovery, web checks and live data
preservation passed. Production selects 12 ongoing targets and excludes 12 ended
applications. A representative live keyword probe passed in both mailboxes with
zero full-body requests; it was read-only and did not save a new batch receipt.
See the ledger for exact scope and fingerprints. The r3 account below is history.

### Deployed development follow-up

[Resume event-conflict correction](docs/architecture/APPLICATION_RESUME_ASSOCIATIONS.md#local-event-conflict-correction--2026-09-09)
now rejects changed observations reusing an existing event ID, avoiding silently
skipped confirmation/correction writes. Exact retries preserve the historical
result and current association. Local type checks, 368 tests in 44 files and
build passed, including a repaired date-sensitive mail fixture. The user subsequently
authorized publication and deployment, then JD/resume comparison and interview
preparation. Release `resume-20260909-r3` passed production checks at 16:12 Sydney;
38 tables / 1,423 rows and the logical fingerprint were preserved at cutover.
Commit `1451def` was pushed and independently verified on GitHub main after the
user's explicit publication confirmation. A separate candidate-based
preparation report was then saved and read back for one existing application;
submission confirmation remains pending. Application state, tasks and resume
associations were preserved. See the [release evidence](docs/architecture/APPLICATION_RESUME_ASSOCIATIONS.md#production-event-conflict-correction--2026-09-09).
First scheduled mail acceptance and actual submitted-version evidence remain
the next operational gates; the earlier r2 handoff below is retained as history.

### End-of-day handoff

Jun requested documentation reconciliation and commit/push to GitHub main at
the end of today's work. This publication packages the deployed body continuation,
filtered mail search and resume association changes with their release evidence;
it is separate from deployment and scheduled acceptance. Publication is verified
by comparing local HEAD with remote main after push, rather than recording an
unverified success in this commit's own text.

Next session, inspect the retained daily task's first actual September 10 08:00
Australia/Sydney execution and its matching Workspace receipt. Preserve the normal
24-hour / maximum 72-hour recovery policy and the obsolete task's paused state.
Resume candidates remain unconfirmed: collect actual file/version evidence before
using them as submitted materials for JD comparison or interview preparation.
Unattended Drive discovery and M4 v0.3 remain future work. Today’s closing work
does not start another scan, change a task or alter application state.

The latest user-approved increment is [Google Drive resume association](docs/architecture/APPLICATION_RESUME_ASSOCIATIONS.md).
`resume-20260909-r2` is deployed with 367 passing tests, retained migration 014,
verified backup/recovery and unchanged pre/post-cutover database fingerprints.
Sixteen candidate files/revisions across nine existing applications were saved
and read back through MCP; the RSM website displays both links and version details.
No actual submitted version was invented, and no application/lifecycle/task was
created from filename matching. GPT can save attributable file/version confirmation
and reuse it. Daily mail settings remain as below; unattended Drive discovery has
not been integrated. Next product use is confirming actual materials and grounding
JD/resume comparison or interview preparation in those sources.

The preceding increment is subject/company/exact-sender job-mail search,
normal 24-hour scope and maximum 72-hour recovery. Metadata screening precedes full
matching-body reads. All 363 tests passed for `job-mail-20260909-r1` / migration 014,
retained by the latest release. Live additive preservation, 30-tool discovery and website checks passed. See the
[current release evidence](docs/architecture/MAIL_SCAN_BACKEND_LEDGER.md#job-metadata-search---2026-09-09).
Run 6933e727-e6c8-4f48-9fdd-5913724a7e60 is independently verified
COMPLETE/CLOSED for both JOB_METADATA matching scopes, with empty queues and
zero unresolved actions. The authenticated website matches its scope/status/counts;
the next query reused the learned SEEK sender. Filtered manual coverage/readback
is passed. The retained task now has the verified revised policy and is enabled
for daily 08:00 Australia/Sydney, next planned September 10; the obsolete task
remains paused. The next gate is its first real scheduled receipt. No new live
business creation scenario occurred in the final manual run.

### Previous whole-mailbox release and acceptance

The [body-part reading release](docs/architecture/MAIL_SCAN_BACKEND_LEDGER.md#body-part-reading-and-html-diagnostics---2026-09-09)
is deployed as `mail-body-20260909-r4`, migration 013 and 30 tools. All 357 tests,
type checks/build, production-copy migration/restart/rollback and actual live
additive verification passed. Cutover at 10:41:03 Sydney preserved existing data,
adding only an empty body-progress table and one migration-history row (35 tables /
697 rows at cutover). Exact-source reads verified 24,000+3,337-character parts and
10,453-character recovered HTML. The backend gates writes/ack on contiguous reads
of the same source version in the same run; GPT still reviews and classifies.

Six BACKEND attempts have closed PARTIAL; the sixth mailbox-2 receipt is COMPLETE.
Fifty-two acknowledgements were verified through run five; run six reports ten more.
The fifth verified hosted continuation/ack for a 25,323-character source and acked
the HTML target; the original 27,337-character target remains queued.
Both tasks remain paused. The [complete manual policy](docs/mvp/UPDATE_JOB_TRACKER_BACKEND_MANUAL_ACCEPTANCE.txt)
requires actual bodyContinuation schema discovery, all-part review and current-run
ack. This Codex context still exposes old schemas; further hosted processing uses
the updated ChatGPT connection. Full manual/scheduled acceptance and M4 v0.3 remain
pending. No commit/push is claimed for this release's working-tree source changes.

## Previous handoff — 2026-09-08

End-of-day handoff: implementation work is complete for the
[backend receipt package](docs/architecture/MAIL_SCAN_BACKEND_LEDGER.md).
The user requested documentation reconciliation and publication to GitHub main;
this session stops at source publication. The final local run passed 41 test
files / 340 tests, type checks, build, additive migration and previous-code
compatibility verification. No production deployment or task enablement was performed.
Resume with a deployment-copy backup/migration check and release preparation,
then refreshed tool discovery and separate ChatGPT manual/scheduled acceptance.
The host-write refusal remains unresolved; M4 v0.3 has not started.

Topic A/B governance decision: [Platform Watch](docs/strategy/OPENAI_PLATFORM_WATCH.md#2026-09-08-current-boundary-review)
now maintains the current domain-state boundary, ownership checks and scoped
verification/closure. Historical observations remain intact. This bounded
correction changes no runtime or schedule; the next engineering gate remains
real daily workflow acceptance, not another strategy or framework project.


Current navigation: [README](README.md) and [documentation index](docs/INDEX.md).
The user-approved review follow-up retires the original frozen M4 contracts;
[v0.3](docs/dogfood/M4_REAL_USE_EVALUATION_v0.3.md) is adopted but NOT STARTED.
Old M4 Day 7/14/28 dates and ACTIVE/freeze statements below are historical only.
Original evidence and thresholds are retained without retrospective rescoring.
The next engineering gate is [daily workflow acceptance](docs/mvp/DAILY_WORKFLOW_ACCEPTANCE.md),
including actual ChatGPT host recovery, bounded manual processing and a real
scheduled run. A fresh September 8 19:48 Sydney read found the service available
but only one historical PARTIAL receipt, no checkpoints and no processing streams.
Task switches and production image were not re-inspected during this review.

The user requested [backend-managed scan receipt requirements](docs/architecture/MAIL_SCAN_BACKEND_LEDGER_REQUIREMENTS_2026-09-08.md):
retain GPT interpretation and the shared database, move mechanical run tracking
and result aggregation to explicitly authorized backend operations. The
[opt-in implementation](docs/architecture/MAIL_SCAN_BACKEND_LEDGER.md) now passes
local type checks, build, 41 files / 340 tests, additive migration and previous-code
compatibility checks. Deployment and separate ChatGPT manual/scheduled acceptance
remain pending; no task prompt or switch was changed. Two real evidence writes were verified in
Codex without receipts; that bounded trial did not restore daily processing.

Latest production is `mail-layout-20260908-r2`: [mail status layout](docs/mvp/MAIL_STATUS_LAYOUT_2026-09-08.md)
replaces the expanded log panel with two collapsible status cards. Migration 011,
mail processing behavior and the paused ChatGPT tasks are unchanged.

The next [manual-check diagnostics and relevance filtering package](docs/mvp/MAIL_CHECK_DIAGNOSTICS_2026-09-08.md)
is implemented and locally verified (40 files / 327 tests, type checks and build
in an independent LF worktree). It records future failure reasons and excludes
advertisement categories from new evidence. Deployment and real-mail evaluation
are pending; it does not resolve the paused daily task's platform block.

Production recovery and paused-task status are recorded in [README](README.md)
and the [September 8 recovery log](docs/mvp/JOB_TRACKER_RECOVERY_2026-09-08.md).
The [mail ingestion alignment](docs/mvp/MAIL_INGESTION_ALIGNMENT_2026-09-08.md)
first shipped as `mail-ingestion-20260908-r1` and is included in the current release,
with migration 011, 291 passing tests,
a successful build, database-copy rollback rehearsal and live data-preservation verification.
It preserves the shared database and reporting-first
website, adds stable source identity and bounded manual checks, and does not
resolve the platform write block. The [release handoff](docs/mvp/RELEASE_HANDOFF_2026-09-08.md)
records final verification and remaining work. The September 7 status below is historical.

## Historical status ? 2026-09-07

**Core workflow:** [GPT operates; Workspace persists; website reports](docs/architecture/CORE_JOB_WORKFLOW.md). The daily GPT task reads both Gmail accounts through Workspace MCP, classifies evidence and performs authorized updates. The website reads the same cloud database and primarily shows statistics, history and saved reports.

**Scan scope:** at most the last seven days; normal daily checks focus on yesterday/today. Resume pending work within that window. Do not restore the superseded 30-day bootstrap or label excluded older mail as successfully scanned.

| Layer | Verified state | Remaining gate |
| --- | --- | --- |
| Production | `gmail-mcp-20260907204200`, migrations 001-009, 27 tools; both Gmail identities and bounded live list/read verified; 24 applications preserved at deployment | Deploy the bounded resumption package |
| ChatGPT integration | User refreshed plugin discovery; both mailboxes AVAILABLE through Workspace; one-off scheduled `workspace_ping` succeeded | Refresh to 29 tools after deployment and verify the recurring task context |
| Manual scan | User supplied PARTIAL receipt `d483b9a3-e355-4367-8436-15b3943fd8a6`, saved/read back, zero new business records, existing Synogize evidence deduplicated | Complete bounded source coverage; PARTIAL is not a no-update finding |
| Local implementation | Seven-day resumable batches, migration 010, 29 tools, read-only progress display; 33 test files / 269 tests, typecheck and build passed | Not yet deployed or proven in a real scheduled scan |

Next: deploy [bounded daily resumption](docs/mvp/MAIL_SCAN_RESUME_2026-09-07.md), refresh plugin discovery, activate the updated policy, verify a manual run and then a real recurring scan/write/receipt run. Keep the existing daily schedule and Gmail consent. Publishing code to GitHub is not a cloud deployment or a task configuration change.

The [complete recurring policy](docs/mvp/UPDATE_JOB_TRACKER_WORKSPACE_PROMPT.txt) and [self-contained manual acceptance prompt](docs/mvp/UPDATE_JOB_TRACKER_MANUAL_ACCEPTANCE.txt) require the new batch tools. Activate them only after deployment and plugin refresh. The latest seven-day revision has not been confirmed saved in ChatGPT.

## Delivery records

- [Gmail MCP reader](docs/mvp/GMAIL_MCP_READER_2026-09-07.md): currently deployed; reuses website OAuth and avoids the built-in Gmail/developer-MCP restriction.
- [Scan receipts](docs/mvp/MAIL_SCAN_RECEIPTS_2026-09-07.md): deployed with migration 009; durable readback is user-verified for the PARTIAL manual run.
- [Application timeline and dates](docs/mvp/APPLICATION_DETAIL_2026-09-07.md), [recent sorting and read-only dossiers](docs/mvp/APPLICATION_PROFILE_EDIT_2026-09-07.md): deployed; confirmed historical JD/skill-match content backfill remains pending.
- [Website batch checks](docs/mvp/GMAIL_BATCH_2026-09-07.md) and [direct Gmail integration](docs/mvp/GMAIL_DIRECT_API_2026-09-07.md): deployed secondary conveniences; GPT remains the primary operations interface.
- [Original task reconciliation](docs/mvp/UPDATE_JOB_TRACKER_HANDOFF_2026-09-07.md): retains historical Sheet-only instructions and the later Workspace authorization.
- [Workspace Agent setup](docs/mvp/GMAIL_WORKSPACE_AGENT_SETUP.md): historical alternative, not a prerequisite for the selected workflow.

Earlier milestone sections below are historical records, not overrides of this current status.

## Historical milestones

**CHATGPT-NATIVE SPIKE 1A = COMPLETE**

**SPIKE 1B = COMPLETE — FUNCTIONAL AND PRIVACY GATES SUPPORTED**

**REAL JOB SEARCH MVP SLICE M1 = COMPLETE — CHATGPT PLATFORM SUPPORTED**

**REAL JOB SEARCH MVP SLICE M2 = COMPLETE — CHATGPT PLATFORM SUPPORTED**

**REAL JOB SEARCH MVP SLICE M3 = COMPLETE — CHATGPT PLATFORM SUPPORTED**

**Historical M4 milestone: Day 1 complete; frozen evaluation retired on 2026-09-08.**

**CLOUD C1/C2/C3/C4/C5 = ACCEPTED — REAL DATABASE ON CLOUD; PC-OFF MOBILE TEST PASSED**

**SECONDARY JOB SEARCH ENTRY S1-01 THROUGH S1-05B.2 = LOCALLY VERIFIED — 192 TESTS; S1-05B.3 WINDOWS-PC-OFF IPHONE SAFARI READ = PASSED**

**RECOMMENDATION CONTINUITY S2-01 = LOCALLY VERIFIED — 208 TESTS; CANDIDATE STORAGE AND MANUAL DECISIONS**

**RECOMMENDATION CONTINUITY S2-02 = LOCALLY VERIFIED — 215 TESTS; CANDIDATE WEB VIEWS AND APPLICATION LINKING**

**RECOMMENDATION CONTINUITY S2-03 = LOCALLY VERIFIED — 222 TESTS; DIGEST RUN RECORDING AND COVERAGE**

**S2 CLOUD RELEASE = DEPLOYED 433ab3c — 237 LOCAL TESTS; GMAIL CHECK RESULT DISPLAY LIVE; AUTOMATIC AGENT TRIGGER UNCONFIGURED**

The 2026-09-05 handoff led to the completed local
[S1-04 Task completion package](docs/mvp/S1_04_TASK_COMPLETION_RESULTS_v0.1.md).
The subsequent [S1-05A local operations contract](docs/mvp/S1_05A_LOCAL_OPERATIONS_RESULTS_v0.1.md)
adds staged deployment and rollback controls. The new web surface has not been
deployed or enabled against real data.
[S1-05A.1 GPT-to-Web handoff](docs/mvp/S1_05A1_GPT_WEB_LINK_RESULTS_v0.1.md)
now adds opt-in exact links without changing the 13-tool discovery surface.
[S1-05B.0 HTTPS checker](docs/mvp/S1_05B0_HTTPS_RELEASE_CHECK_RESULTS_v0.1.md)
automates the public signed-out security gate without contacting a real endpoint.
[S1-05B.1 external binding preflight](docs/mvp/S1_05B1_EXTERNAL_BINDING_PREFLIGHT_RESULTS_v0.1.md)
now fails closed on inconsistent VM-side hostname, OAuth, Tunnel, secret or
release-mode configuration before publication.
[S1-05B.2 AI Radar domain ingress](docs/mvp/S1_05B2_AI_RADAR_DOMAIN_INGRESS_RESULTS_v0.1.md)
selects `workspace.ai-radar-lab.com` and adds the hardened Route 53/Caddy
provider without changing the AI Radar application or existing hostnames.

The subsequent
[S2-01 candidate storage and decisions](docs/mvp/S2_01_CANDIDATE_RESULTS_v0.1.md)
is the first recommendation-continuity increment. It adds durable candidate
save/dismiss/restore decisions with actor-attributed audit, idempotent recording
by posting identity or canonical URL, four new MCP tools (17 total), and bounded
candidate reads. It raises the local gate to 208 tests.
[S2-02 candidate Web views and application linking](docs/mvp/S2_02_CANDIDATE_VIEWS_AND_LINKING_RESULTS_v0.1.md)
then closes the P3 slice: a browser Jobs list and candidate detail with
save/dismiss/restore controls, actor-attributed application linking, and the
`workspace_link_job_candidate` MCP tool (18 total). It raises the local gate to
215 tests.
[S2-03 digest run recording and coverage](docs/mvp/S2_03_DIGEST_RUN_RECORDING_RESULTS_v0.1.md)
completes recommendation continuity with the run/item ledger, a narrowly scoped
idempotent recording command, truthful coverage/delivery tracking, per-run fit
snapshots, and three new MCP tools (21 total). It raises the local gate to 222
tests. The full P6 acceptance run (A01–A12) is the remaining S2 gate; its
execution procedure is recorded in
[P6 Acceptance Plan](docs/mvp/P6_ACCEPTANCE_PLAN_v0.1.md).

Cloud acceptance on 2026-09-05 verified Sydney Lightsail persistence,
backup/restore, controlled image rollback, restricted private tunnel access,
and automatic recovery after an actual instance reboot. See the
[C1/C2 runtime results](docs/cloud/C1_C2_RUNTIME_RESULTS_v0.1.md).
The existing connector now reads the original real M4 Workspace on the cloud.
[C3 migration](docs/cloud/C3_RUNTIME_RESULTS_v0.1.md) preserved all source rows
and passed independent new-conversation readback. The local original remains
stopped and retained for rollback. [C4 controlled-write acceptance](docs/cloud/C4_C5_RUNTIME_RESULTS_v0.1.md)
also passed, including independent conversation readback and authorized test-Task
completion. C5 passed with user-confirmed Windows-off testing in two independent
iPhone conversations and subsequent read-only cloud verification of the completed
test Task and unchanged original Task. The C4/C5 results distinguish the C4
aggregate checkpoint from the later C5-specific evidence.

## Thesis

> Build a persistent work-state layer for ChatGPT that turns conversations and external events into long-running goals, projects, tasks, actions, and outcomes.

## Architecture Position

```text
ChatGPT = Interface + General Reasoning + Orchestration
Workspace = Persistent Work State + Coordination
Connected Services = Source Facts + Capabilities
MCP / Apps SDK = Bridge
```

## Current Architecture Decision

**MVP is ChatGPT-native and continuity-first.**

The Workspace will not initially rebuild Gmail/Drive/Calendar connectors. The first proof uses ChatGPT's available connected-app surface plus the custom Workspace app where supported.

## Phase Gates

- [x] Project thesis
- [x] Problem / non-goals
- [x] System boundary
- [x] Architecture Review v0.1
- [x] Logical Architecture v0.1
- [x] State/Event Flow v0.1
- [x] State Model v0.1 proposed
- [x] State Model review
- [x] ChatGPT Integration Spike — local and manual ChatGPT-native Spike 1A verified
- [x] Spike 1B architecture review and smallest-scope design
- [x] Spike 1B implementation
- [x] Spike 1B functional ChatGPT cross-app E2E
- [x] Spike 1B fresh-DB privacy/data-minimization rerun
- [x] Spike 1B final verification
- [x] Real Job Search MVP implementation plan approved with M1/M2/M3 gates
- [x] MVP build — Slice M1 Real Application Inventory verified locally and through ChatGPT
- [x] M1 duplicate-protection defect remediated and fresh-DB platform retest supported
- [x] MVP build — Slice M2 Task + Today implemented and verified locally
- [x] M2 create-Task visibility invariant hardened with regression coverage
- [x] M2 fresh-DB ChatGPT platform retest
- [x] MVP build — Slice M3 Real Lifecycle implemented and verified locally
- [x] M3 fresh-DB ChatGPT platform retest
- [x] E2E evidence
- [x] M4 real-data Dogfood Day-0 gate
- [x] M4 prospective real-use metrics locked before Day 2
- [x] Post-M4 Job Search Intelligence v1 architecture baseline documented
- [ ] M4 seven-day real-data trial
- [ ] M4 Day-14 adoption gate
- [ ] M4 Day-28 utility gate

## Historical next-step record (superseded by Current status)

**Latest acceptance checkpoint — 2026-09-07:** P6 fixtures now exist; 140
applications = 23 real + 117 synthetic. A07/A08/A11 passed; A02/A04/A05/A09
are partial. Await the user's 106-application/11-evidence browser paging
result, then coordinate bounded browser completion and Windows-off iPhone
checks. Writes/bootstrap remain false. The
[scenario ledger](docs/mvp/P6_SCENARIO_EXECUTION_2026-09-07.md) supersedes
the earlier pre-fixture notes below. Task-A09 is now DONE; A03/A06/A10 retain
their independent fixtures.

**Latest UI checkpoint — 2026-09-07:** user feedback requested rejected
applications in the default overview and larger fonts. The
[overview/readability correction](docs/mvp/WEB_OVERVIEW_READABILITY_2026-09-07.md)
is deployed as `0a9dd15`; live checks show all 24 records, including 12 closed,
and updated CSS. Browser writes/bootstrap remain false. Continue P6 after
the outstanding user visual/Jobs checks; no P6 cloud fixtures exist yet.

**Latest runtime checkpoint — 2026-09-07:** S2 `da0a879` is deployed in read
mode after passing migration, repeat startup and previous-image rehearsal.
Old data/contracts are unchanged; MCP discovery is 21. Obtain the user's
authenticated Today/Applications/Jobs smoke result, then proceed with the
already-authorized P6 fixtures and A01–A12. No P6 cloud fixture has been created.
See [P6 runtime evidence](docs/mvp/P6_RUNTIME_RESULTS_2026-09-07.md).

**Execution checkpoint — 2026-09-07:** user authorized migration rehearsal,
release commit, cloud deployment and P6 acceptance. The
[S2 migration rehearsal](docs/cloud/S2_MIGRATION_REHEARSAL_2026-09-07.md)
is implemented, with 233 tests passing. Execute the isolated cloud-image
rehearsal, deploy the exact rehearsed image, then Phase 0B and A01–A12.

**Latest checkpoint — 2026-09-07:** the
[P6 preparation review](docs/mvp/P6_PREPARATION_RESULTS_2026-09-07.md)
verified the bounded A04 seed, strict argument validation, default 106-row
replay, and unmapped-principal rejection. All 227 tests pass. Next implement
the migration-aware isolated-copy rehearsal identified in Phase 0A of the
[P6 plan](docs/mvp/P6_ACCEPTANCE_PLAN_v0.1.md), then perform separately
authorized S2 deployment and regression smoke before A01–A12. Cloud/device
acceptance has not started. Earlier chronological next-step notes below are
preserved as history.

Development communication and result documents must follow the repository's
[Development Continuity and Benefits Standard](docs/DEVELOPMENT_CONTINUITY_STANDARD.md).
Each package must state what requirement it inherits, why the capability belongs
in the current increment, what exact next step it enables, and its short- and
long-term benefits. This is part of the package definition of done.

The latest design deliverable is the
[Job Search P0 technical plan](docs/mvp/JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md),
which refines the
[interface requirements and P0–P6 checklist](docs/mvp/JOB_SEARCH_SECONDARY_INTERFACE_REQUIREMENTS_v0.1.md)
into an S1 application/task release and S2 recommendation continuity. It proposes
login identity linking, browser ingress, exact terminal-task MCP readback, audit,
rollback and acceptance. The user subsequently approved
[local S1 implementation and synthetic testing](docs/mvp/S1_LOCAL_SCOPE_DECISION_2026-09-05.md).
[S1-01 identity/login](docs/mvp/S1_01_IDENTITY_RESULTS_v0.1.md) passed local
verification (17 files / 153 tests, typecheck and build).
[S1-02 bounded queries and terminal-task readback](docs/mvp/S1_02_QUERY_RESULTS_v0.1.md)
subsequently passed 18 files / 166 tests, typecheck and build, with 13 local MCP
tools and unchanged original contracts.
[S1-03 responsive read-only pages](docs/mvp/S1_03_WEB_RESULTS_v0.1.md) now pass
171 tests, typecheck/build and desktop/390px/320px synthetic browser checks.
[S1-04 browser Task completion](docs/mvp/S1_04_TASK_COMPLETION_RESULTS_v0.1.md)
passes 177 tests, typecheck/build and 390px/320px synthetic browser checks,
including authority, audit, idempotency, conflict and recovery verification.
[S1-05A operations](docs/mvp/S1_05A_LOCAL_OPERATIONS_RESULTS_v0.1.md) passes the
182-test repository gate plus shell syntax and deployment-contract checks. It
adds MCP-only/read/write modes, loopback port and secret boundaries, a separate
Web tunnel service, local health checks and rollback guards.
[S1-05A.1](docs/mvp/S1_05A1_GPT_WEB_LINK_RESULTS_v0.1.md) subsequently raises
the repository gate to 20 files / 185 tests and defines the exact point at which
the user must be asked to perform the bounded iPhone human test.
[S1-05B.0](docs/mvp/S1_05B0_HTTPS_RELEASE_CHECK_RESULTS_v0.1.md) raises the
local gate to 21 files / 189 tests and supplies the external HTTPS preflight
command that must pass before that notification.
[S1-05B.1](docs/mvp/S1_05B1_EXTERNAL_BINDING_PREFLIGHT_RESULTS_v0.1.md) raises
the gate to 190 tests and adds the VM-side pre-publication check. Real execution
is next and requires restored AWS access plus approved Cloudflare and Google
values; browser writes remain disabled.
Commit `8f21071` is published on `origin/main`. The connected Cloudflare account
has no Zone or Tunnel; that discovery triggered the subsequent domain-reuse
decision. A Google OAuth client remains an external prerequisite.
[S1-05B.2](docs/mvp/S1_05B2_AI_RADAR_DOMAIN_INGRESS_RESULTS_v0.1.md) resolves the
domain decision by reusing `workspace.ai-radar-lab.com`. The local gate is now
192 tests. AWS access, static IPv4/Route 53/443 binding, Caddy validation and the
Google OAuth client remain external prerequisites; browser writes remain off.
S1-05B public login, recovery/capacity, Safari/iPhone and cloud publication
acceptance passed on 2026-09-06, including the Windows-PC-OFF iPhone Safari
direct-Web read ([S1-05B.3](docs/mvp/S1_05B3_IPHONE_SAFARI_ACCEPTANCE_RESULTS_v0.1.md)).
An iPhone *completion* remains a separate, separately authorized step, recorded
in the [S1-05B.4 plan](docs/mvp/S1_05B4_IPHONE_COMPLETION_PLAN_v0.1.md).
Existing cloud acceptance is complete and does not
substitute for M4 Day 2 actual job-search use and user-observed effort/actionability.

**Spike 1B and Real Job Search MVP Slices M1/M2/M3 remain frozen at their
verified milestone tags. M4 Day 1 imported the explicitly authorized real
inventory with minimized Gmail provenance and passed aggregate verification.
The independent new-conversation readback also passed with zero mutation.
Continue daily Today check-ins through Day 7 without expanding the frozen
product scope. From Day 2, record the prospectively locked capture, friction,
recovery, Today-actionability, and correction metrics. Evaluate the operational
gate on 2026-09-10, adoption on 2026-09-17, and utility on 2026-10-01.**

## Architecture Baseline — 2026-09-04 (post-M4 Job Search Intelligence v1)

- Defined separate, versioned objects for postings, resume relationships,
  canonical skills, requirements, capability evidence, analysis runs, match
  assessments, and reviewable change sets.
- Confirmed the authority matrix: providers own native facts, Workspace owns
  cross-system work state and intelligence history, and Google Sheets is a
  review/reporting projection.
- Specified the `SCAN -> OBSERVE -> EXTRACT -> RESOLVE -> PROPOSE -> REVIEW ->
  APPLY -> VERIFY` pipeline with confidence, risk, idempotency, concurrency,
  and explicit-authority boundaries.
- Defined explainable interval scoring, confidence-aware aggregate skill views,
  read-only watch rules, immutable input manifests, successor assessments, and
  field-level provenance.
- Sequenced six post-M4 delivery slices. No runtime code, schema, tool,
  connector, scheduler, or automatic write was added; the M4 feature freeze
  and decision dates remain unchanged.

## Session Closeout — 2026-09-04 (M4 v0.2 metric lock)

- The original seven-day M4 operating plan and Day 1 result remain unchanged;
  Day 1 is not retrospectively included in the new utility thresholds.
- Five prospective metrics are now defined: capture compliance, capture
  friction, structured recovery value, Today actionability, and correction or
  reconciliation cost.
- A sanitized ledger records every eligible event, including bypassed events,
  so the capture-compliance denominator cannot omit failures.
- The fixed local-date decisions are Day 7 on 2026-09-10, Day 14 on
  2026-09-17, and Day 28 on 2026-10-01. Insufficient evidence at Day 28 does
  not extend the evaluation.
- The feature freeze remains in force. Only real-use blockers, correctness
  defects, and security or privacy defects may be fixed before the final
  decision.

## Session Closeout — 2026-09-04 (M4 Day 1)

- With explicit user authority, the first real-data batch created 22 Job
  Application Projects and 22 minimized Gmail evidence Resources through the
  frozen MCP surface.
- Final Day 1 aggregate state is 10 APPLIED, 1 INTERVIEWING, and 12
  CLOSED/REJECTED. The
  INTERVIEWING admission created the expected single HIGH interview-preparation
  Task; all terminal admissions created no Task.
- All 36 transitions were admitted with explicit user authority. Thirteen
  runtime lifecycle transitions reference their Gmail evidence Resources.
- The 72 mutation commands produced 72 idempotency records with no rejected
  command or duplicate. Today reported one attention Task and ten active
  applications without an open Task.
- Direct read-only inspection matched MCP readback. All 23 Resources used
  distinct stable message IDs, and no persisted Resource contained a full
  email address.
- The server was stopped, SQLite integrity returned `ok`, the WAL checkpoint
  was not busy, and the external stderr log was empty.
- Before the later same-day delta, a completely new ChatGPT conversation
  performed only the approved read-only calls and independently returned 10
  active / 22 total applications, the then-current lifecycle distribution, and
  Today counts of 1 attention, 9 applications without an open Task, and 0
  upcoming Tasks.
- Its immediate post-readback database audit remained at 22 Projects, 22
  Resources, 35 admitted transitions, 13 evidence links, one open Task, and 70
  idempotency records, confirming zero mutation at that snapshot.
- A later read-only Gmail delta scan found one new same-day Application event.
  Explicit user authority created one ACTIVE/APPLIED Project and one minimized
  Gmail Resource. An idempotent reporting retry returned the same records with
  no duplicate; final counts are 23 Projects, 23 Resources, 36 admitted
  transitions, one open Task, and 72 idempotency records.
- The one-time tunnel credential was deleted from temporary storage and
  revoked. The tunnel and server were stopped, port 3000 closed, SQLite
  integrity remained `ok`, the WAL checkpoint was not busy, and both external
  stderr logs were empty.
- Day 1, including its cross-session durability gate, is complete. Day 2 must
  remain pending until a later local calendar date.

## Session Closeout — 2026-09-04 (M4 Day-0 initialization)

- The approved seven-day M4 operating scope, privacy rules, success gate, and
  stop conditions are recorded in `docs/dogfood/M4_DOGFOOD_PLAN_v0.1.md`.
- The production-like database was created at the Local App Data boundary,
  outside both the repository and OneDrive. No previous database existed and
  the synthetic seed command was not run.
- All three committed migrations applied. One development Principal and one
  Workspace were initialized; Projects, Resources, transitions, Tasks, and
  idempotency records all remained empty.
- HTTP health, MCP discovery, and `workspace_ping` passed against the frozen
  12-tool surface. The Workspace ID is
  `d3c0a312-9c12-4b73-a598-eebf1b1de974`.
- The initialization server was stopped, port 3000 closed, SQLite integrity
  returned `ok`, the WAL was checkpointed, and the external stderr log was
  empty.
- Day 1 has not started and no real job-search content has been written.

## Session Closeout — 2026-09-04 (M3 platform verification)

- The canonical fresh-external-database M3-A/B/C run passed through the
  refreshed 12-tool ChatGPT development connection.
- M3-A verified non-mutating proposals and exactly one approved HIGH derived
  Task for recruiter contact, interview, and offer admissions.
- M3-B verified terminal ACCEPTED closure, atomic cancellation of all four
  open Tasks, idempotent replay, closed-list behavior, and rejection of a
  terminal outgoing edge.
- M3-C verified REJECTED and WITHDRAWN closure plus durable no-write readback
  of all three terminal Projects from a separate ChatGPT conversation.
- Direct read-only SQLite inspection matched ChatGPT: ACCEPTED v5, REJECTED
  v2, and WITHDRAWN v2 were CLOSED with zero open Tasks. Sanitized server and
  tunnel stderr logs were empty.
- The active-only exact lookup returned `NOT_FOUND` for terminal Projects as
  frozen by M1; the independent readback resolved them through the
  closed-inclusive list, with no contract change.
- Full verification remained at 12 test files and 129 tests, plus typecheck,
  production build, and `git diff --check`.
- The one-time Runtime API key was revoked and temporary runtime processes
  were stopped. The external database and sanitized logs remain preserved as
  evidence.

## Session Closeout — 2026-09-04 (M3 local implementation)

- The exact approved seven-state, 13-edge lifecycle is implemented; all 36
  rejected state pairs remain non-mutating proposals.
- Admissions derive the approved HIGH Tasks for recruiter contact, interview,
  and offer states. `REVIEW_OFFER` remains source-owned and cannot be created
  through the frozen M2 manual Task surface.
- Terminal admission atomically closes the Project and cancels obsolete open
  Tasks with SYSTEM audit attribution while preserving terminal Tasks.
- No migration or MCP tool was added; the existing proposal schema now exposes
  the full approved destinations.
- Automated, transport, rollback, concurrency, and retry coverage passes
  locally. The fresh-database ChatGPT M3-A/B/C platform gate remains pending.

## Session Closeout — 2026-09-04 (M2 platform verification)

- A fresh external SQLite database and the refreshed 12-tool ChatGPT
  development connection were used for the canonical retest.
- M2-A passed deterministic Today classification and ordering for overdue,
  due-today, high-priority, blocked, upcoming, application-gap, and recent
  lifecycle-change fixtures.
- M2-B passed optimistic concurrency, completion, `completedAt`, open-Task
  filtering, and terminal-state rejection checks.
- M2-C passed durable separate-conversation readback and three-call
  deterministic equality with no writes.
- Direct read-only database inspection matched the ChatGPT results. The
  original failed-run evidence remains preserved as defect history.
- `npm run verify` passed before the platform run and again after the evidence
  update with 11 test files and 74 tests, plus typecheck and production build;
  `git diff --check` also passed.
- The temporary server and tunnels were stopped, repository-local scratch logs
  were removed, and the one-time platform Runtime API key was revoked. The
  external test database and sanitized logs remain preserved as evidence.
- M3 was not started in this session.

## Session Closeout — 2026-09-02 (M2 defect remediation)

- Closeout verification was refreshed at 23:47 AEST against commit `f55e493`;
  the repository remained clean and aligned with `origin/main` before this
  documentation-only closeout update.
- The M2 platform run stopped at the first manual Task creation after reporting
  a durable ACTIVE/APPLIED Job Application.
- The historical raw MCP payload was unavailable. Recoverable evidence showed
  a runtime/database continuity discrepancy, so reconstructed fields are
  explicitly labeled rather than presented as raw evidence.
- TaskService now uses WorkspaceService's canonical authorized Project resolver;
  the dedicated TaskService boundary and Workspace isolation remain intact.
- The real M1 creation -> Task creation -> persisted reopen path and the
  published MCP transport path are covered by regressions.
- `npm run verify` passes with 11 test files and 74 tests; production build and
  `git diff --check` also pass.
- The M2 platform gate remains failed. Preserve the failed-run evidence and use
  a fresh external database for the next manual retest. M3 and M2 tagging remain
  blocked.
