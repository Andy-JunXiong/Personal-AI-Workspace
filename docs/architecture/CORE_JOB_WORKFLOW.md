# Core job workflow — authoritative product boundary

## Solution alignment — 2026-09-11

Jun confirmed the [submission calendar](../mvp/APPLICATION_CALENDAR_2026-09-09.md#september-11-user-clarification-submission-records-only)
contains only application submission records, once per application. A labelled
confirmation-email date is a fallback when the submission date is missing;
ordinary updates, interviews, offers, rejections and synchronization timestamps
never become calendar entries. Ended applications retain their historical
submission. Recent-update ordering in the application list is independent.

The [current solution and roadmap](../strategy/PRODUCT_SOLUTION_ROADMAP.md) preserves
this domain contract. ChatGPT remains the primary interaction host and the website
retains its admitted reporting/editing operations. PAW owns attributable business
records and domain admission; Gmail/Drive remain authoritative for their native
records. User authority, platform invocation permission and domain admission are
separate gates. Skills describe procedures rather than granting any of those gates.

The bounded [single-application preparation context](APPLICATION_PREPARATION_CONTEXT.md)
is now implemented and locally verified through `workspace_get_project`, including
explicitly identified resume versions. It creates no second context store and does
not turn suggested actions into grants. It is deployed with real Nuix working-copy
readback and a qualified preparation example; complete-dossier and refreshed
connector selection checks remain pending. Second-client acceptance is still future work. See the
roadmap for sequence and release/real-data gates.

## Per-job resume copies — deployed, September 11

[Named resume versions](RESUME_VARIANTS.md) extend the accepted base editor with
independent candidate/application working copies. Scoped Web authorization is
retained; creation and editing do not confirm submission or mutate lifecycle/Tasks.
Migration 018 is deployed as `resume-variants-20260911-r2`. Authenticated real-copy
creation, save/reopen and exports passed; see the linked acceptance and PDF
correction record. Bounded read-only preparation context is now deployed with
limited real-use acceptance; its active contract records remaining material/client gaps.

## Platform Watch report decisions — source P0, 2026-09-10

The source now contains a bounded [report-to-decision contract](PLATFORM_WATCH_REPORT_DECISIONS.md)
for the existing OpenAI Platform Watch. ChatGPT still generates and schedules the
report. PAW accepts only an authenticated, explicit Web import, preserves the
report as an immutable source record and records each human finding disposition
with versions and attribution. No recommendation can change code, roadmap, ADRs,
Tasks or lifecycle state by itself. No MCP tools were added.

This P0 does not change the Job Search core flow or the priority of daily
application updates. Its pending reminder appears after those updates on Today.
Production migration 017, backup-copy recovery and old-data preservation passed
in `platform-watch-20260910-r1`. The [release ledger](../mvp/PLATFORM_WATCH_REPORT_DECISION_P0_RESULTS_2026-09-10.md)
separates those results from authenticated real-report and deliberate decision
acceptance. General Web writes remain off; only the scoped Watch controls join
the existing resume/library session-and-CSRF boundary.

## Storage and analysis responsibilities clarified — 2026-09-10

The deployed system stores Workspace records in SQLite on the existing AWS
Lightsail instance, at `/srv/paw/data/workspace.db` (container path
`/app/data/workspace.db`). Local backup files are under `/srv/paw/backups`; this is
not a separate RDS database or evidence of an off-instance backup. Website and MCP
use the same database. The resume table retains structured content, the private
template copy and a version counter. Original messages stay in Gmail; original
Drive files stay in Drive. Ordinary conversation text is not automatically stored:
GPT must invoke the appropriate Workspace write tools to persist its results.

| Path | Analysis/execution responsibility | Model API behavior |
| --- | --- | --- |
| Interactive GPT and hosted Job Tracker via MCP | GPT interprets evidence; Workspace supplies sources, validates operations and persists admitted results | This MCP mail-read path adds no backend model call; scheduled-run acceptance remains separate |
| Website resume save, Preview, Word/PDF export | Workspace service plus Python template processing and LibreOffice PDF rendering | No OpenAI model call |
| Website manual application email check | Gmail search returns matching subjects/snippets; backend `GmailChecks` invokes `OpenAiMailInterpreter` | Calls the OpenAI Responses API for eligible nonempty batches; independent of the external job-matching switch |
| External job matching/draft generation | Optional backend `OpenAiJobFitAnalyzer` | Remains disabled with `PAW_JOB_LIBRARY_EXTERNAL_MATCHING` off |

The earlier conversational statement that the entire Workspace makes no OpenAI
API calls was too broad. The deployed Gmail overlay enables Gmail, and server
wiring creates the manual-check interpreter. Code evidence is in `src/server.ts`,
`src/gmail/checks.ts`, `src/gmail/providers.ts` and `deploy/cloud/compose.gmail.yaml`.
This clarification does not claim actual usage volume or API charges from billing
records, and does not disable the existing feature or change any credentials.

This handoff preserves the accepted resume-first priority: the online base resume
is usable now, and future named per-job variants/JD comparison can reuse its saved
content. Keeping each analysis path explicit avoids confusing backend storage APIs
with model APIs when choosing the next increment.

## Resume editing prioritized by Jun — 2026-09-09

Jun explicitly requests a dedicated nine-region website editor before more external
job updates. Name/contact stay fixed; other content saves to the same Workspace
database, with Word/PDF exports based on the private Drive template. This authorizes
scoped resume edits, not submission or application lifecycle changes. The
[editor contract](RESUME_EDITOR.md) records the AWS deployment on September 10
Sydney time: `resume-editor-20260909-r3`, migration 016, saved baseline version 1,
live save/preview/Word/PDF acceptance and retained business data. Next, use the base
resume for later per-job variants and JD comparisons. Daily task configuration and
external matching OFF remain unchanged; this release does not validate a scheduled run.

## Post-application materials — 2026-09-09

Jun requires a saved job link and JD after each application, a company-named
resume for locating the correct file, and a requirement-to-skill comparison.
Follow the [application dossier workflow](APPLICATION_DOSSIER_WORKFLOW.md).
Missing materials stay visible; filename matches alone do not confirm submission.

Confirmed by Jun on 2026-09-07. This decision supersedes conflicting earlier
proposals to make the website a parallel operational workspace.

## Ongoing-only keyword follow-up clarified by Jun — 2026-09-09

Jun explicitly corrected the website bulk check after it revisited two Amazon
applications already recorded as REJECTED/CLOSED. Rejected and ended applications
retain history but stop receiving follow-up checks. Only ACTIVE applications at
APPLIED, RECRUITER_CONTACT, INTERVIEWING or OFFER are follow-up targets; PAUSED,
REJECTED, WITHDRAWN, ACCEPTED and CLOSED records are excluded. Reuse saved rejection
evidence instead of rediscovering it from mail.

For website checks, search company/role keywords through Gmail and read only the
matching Subject and short Gmail snippet; do not retrieve every full body or
require complete-body acquisition to search for updates. Keyword overlap alone
does not prove an application change. Insufficient snippet evidence remains
uncertain, and the website still does not change lifecycle or tasks. New backend
JOB_METADATA runs derive company/exact-sender follow-up criteria only from ongoing
applications, while retaining generic subject keywords for new-application discovery.
Existing run snapshots and historical receipts remain unchanged. The saved hosted
daily task and its separate source-review protocol have not been edited by this
website correction. See the [implementation ledger](MAIL_SCAN_BACKEND_LEDGER.md#ongoing-only-keyword-follow-up--2026-09-09).

## Drive resume association approved by Jun — 2026-09-09

Use the user's uploaded Google Drive resumes to supplement existing application
dossiers. Save file identity, link and observed revision, with explicit separation
between candidate discovery and confirmed actual submission. Reuse prior user
confirmation. Filename/company/role matches alone do not prove submission or the
historical version; never create an application from Drive discovery. The
[resume association contract](APPLICATION_RESUME_ASSOCIATIONS.md) defines the
interactive workflow and release evidence. The saved daily mail task is unchanged;
unattended Drive discovery is not part of its current acceptance.

## Daily mail scope clarified by Jun — 2026-09-09

Jun explicitly replaced whole-mailbox seven-day ingestion with subject/company/
sender job search. Metadata means the actual Subject, exact From address, company
and corresponding existing application. Search both mailboxes normally over the
latest 24 hours; interrupted recovery may extend to at most 72 hours. Reuse prior
application and acknowledged-message records. Retain subject keyword discovery
for new applications as well as company/exact-sender follow-up. Fetch full bodies
only for metadata matches; GPT still interprets actual evidence and owns business
decisions. Nonmatching query scope is excluded, not full-body reviewed. Completion
means the fixed matching-job-mail scope, not all mailbox mail. Old receipts and
unrelated pending-body errors remain history and do not force further acquisition.

This uses native Gmail search and metadata reads through the existing Workspace
connection; it adds no scheduler, model API or parallel system of record. The
release evidence is maintained in the [mail ledger](MAIL_SCAN_BACKEND_LEDGER.md#job-metadata-search---2026-09-09).
After the revised manual/website acceptance, Jun authorized the next step on
September 9: the retained daily task is updated and enabled for 08:00
Australia/Sydney; the obsolete task remains paused. See the
[activation record](MAIL_SCAN_BACKEND_LEDGER.md#daily-task-activation---2026-09-09).
Actual scheduled acceptance remains pending. Earlier pause arrangements and
whole-mailbox lookback rules below are historical.

## Application confirmation clarified by Jun — 2026-09-09

Daily automatic registration of a new application requires an explicit
employer/platform email confirming application submission or receipt. A recruiter
reply, eligibility requirement or request to send a CV alone is pre-application
contact. Without an existing application match, a fully reviewed such message
is outside applied-application tracking and may be acknowledged IRRELEVANT;
this does not label it spam or modify Gmail. Do not create an application, task,
or application evidence from that contact alone, or repeatedly ask Jun whether
a recruiter reply means he applied. Existing applications retain their saved
history; later follow-up does not require finding the original confirmation
again within the current daily window. Deduplicate individual reviewed messages,
never suppress a later distinct confirmation from the same sender or thread.

This resolves the first filtered run's two Senior Agent AI Engineer replies:
Jun explicitly states he did not apply. Their next eligible current-run reads
can be completed as outside scope under the existing acknowledgement contract.
The closed PARTIAL receipt is retained; no new backend outcome is claimed here.
The maintained manual and future daily prompts carry this clarification, enabling
the remaining matching-mail work to continue without inventing applications or
introducing another record type. Scheduled-task configuration remains unchanged.

## Product clarification — 2026-09-08

The following historical product sections retain their original context; the
September 9 daily scope and confirmation rule above take precedence.

Jun reaffirmed that the website primarily displays stored results, with an
occasional explicit manual email check between daily GPT runs. The website's
database reads do not depend on or wake the daily ChatGPT task. Both ingestion
entry points persist to the same database; no second website synchronization
ledger is needed. Share source identity, evidence validation and deduplication
while retaining explicit scope and authority for each entry point.

The existing manual check saves evidence for already registered applications;
it is not yet equivalent to the complete daily policy. The
[September 8 flow review](JOB_TRACKER_FLOW_REVIEW_2026-09-08.md) records these
implementation gaps and proposed increments. It does not select a replacement
scheduler or expand website write authority. Current deployment and platform
status are in the [current release](MAIL_SCAN_BACKEND_LEDGER.md#production-cutover-2026-09-09) and
[recovery record](../mvp/JOB_TRACKER_RECOVERY_2026-09-08.md). The current
`mail-body-20260909-r4` release includes versioned body parts, persistent same-run
read coverage, specific HTML diagnostics, MIME alternatives and shared mail identity, durable
application-scoped checks, diagnostics/filtering and opt-in backend receipts.
Both daily tasks remain paused, confirmed by the user before September 9 cutover,
pending complete manual and scheduled acceptance; a September 9 BACKEND run
was independently verified PARTIAL after a batch-response timeout;
the September 7 execution evidence below is historical.

Current recovery and live ledger evidence are consolidated in [daily workflow acceptance](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md). The frozen M4 evaluation is retired; [v0.3](../dogfood/M4_REAL_USE_EVALUATION_v0.3.md) evaluates this integrated boundary prospectively after acceptance.

## Core flow

The [September 8 backend receipt requirements](MAIL_SCAN_BACKEND_LEDGER_REQUIREMENTS_2026-09-08.md)
record a target responsibility change: GPT retains evidence interpretation and
authorized business operations; the backend maintains run identity, processing
progress and receipt aggregation in the [deployed opt-in mode](MAIL_SCAN_BACKEND_LEDGER.md).
It preserves this core flow and selects no API executor or replacement scheduler.
Migration 013 and the 30-tool server contract (including bodyContinuation) are
deployed and release-verified.
Actual hosted manual/scheduled acceptance remains pending; existing saved task
prompts still use compatible LEGACY commands until explicitly updated after discovery.

Two Gmail accounts -> daily ChatGPT Update Job Tracker -> structured observations,
applications, supported state changes and action tasks -> Workspace cloud database
-> website reports, statistics, application inventory, timelines and dossier views.

Interactive ChatGPT also reads and writes the same Workspace through its tools:
the user performs substantive operations there, including registration, corrections,
task handling and saving existing JD/resume/skill-match content. The scheduled task
performs only the operations explicitly authorized by its saved policy; the model
must still respect evidence, identity, deduplication and lifecycle constraints.

Workspace is the single durable system of record for job-tracking business data.
This does not mean copying entire mailboxes or every attachment: Gmail remains
the original source. Workspace holds relevant structured facts, source references,
state/task records, saved job documents/analysis and their provenance. Google Sheet
is legacy reconciliation input, not a second ongoing writable ledger. Chat memory
must not be the sole durable home for required business records or run coverage.

## Daily scan scope (latest user correction)

Jun limits this daily task to a maximum seven-day lookback. Normally scan new
mail since the latest processing frontier with a 24-hour overlap, covering
yesterday/today. Do not restore the older 30-day bootstrap just because its
receipt was PARTIAL. Source-processing resumption is bounded to this short
window. Older unprocessed work is excluded explicitly, never labeled scanned.
[Implementation and current release gate](../mvp/MAIL_SCAN_RESUME_2026-09-07.md).

## Website role

The website is a frontend of that same cloud database, not a separate database,
new source of truth, or general editing console. Prioritize persistent overview,
counts, comparisons, filtering, sorting, timelines, evidence and saved reports:
things a transient conversation does not present as conveniently.

Keep operations minimal. Navigation, filters and refreshing stored results are
normal. Existing explicitly requested manual Gmail checks and authentication
controls are secondary conveniences, not the core daily ingestion path. Do not
expand website CRUD, resume/profile editing or independent AI analysis without
a new explicit product decision. Do not remove previously authorized controls
or connections merely by interpreting "minimal" as "zero".

## Continuity and benefits

- Upstream: existing daily dual-mailbox task, Workspace MCP services and reporting
  frontend. The user clarified their intended relationship after the profile
  editor increment drifted toward website operations.
- Current correction: record this core decision; remove the new unpublished
  profile editor and its POST endpoint; retain latest-application ordering,
  GPT-written dossier display and profile history.
- Downstream: verify one actual scheduled run against persisted records, then
  build reporting and source-content completeness on the same ledger.
- Short-term benefit: avoid repeated entry, competing workflows and unnecessary
  website controls. Current manual connector-to-database path is verified.
- Long-term benefit: durable job history and analysis survive conversations,
  supporting consistent reporting and contextual assistance across sessions.

## Latest execution evidence and next integration

On 2026-09-07 the user supplied the result of a one-off scheduled task at
20:15:34 Australia/Sydney: workspace_ping succeeded, database available,
workspace d3c0a312-9c12-4b73-a598-eebf1b1de974. This verifies scheduled MCP
connectivity only. It did not read Gmail, write business data, or save receipts.
The user also saved the full receipt prompt and refreshed the plugin to 24 tools.
In the tested developer-MCP chat, built-in Gmail failed with
FORBIDDEN: This conversation is restricted to developer MCPs.
The next integration therefore routes Gmail reads through Workspace MCP using
the website OAuth connections; GPT still performs classification and authorized
writes. See [deployment and remaining gates](../mvp/GMAIL_MCP_READER_2026-09-07.md).
The Gmail MCP reader is now deployed as gmail-mcp-20260907204200. Actual running
MCP verified both account profiles, a bounded list and one sample message per
mailbox; 27 tools available and all 19 business tables unchanged. Full manual and
scheduled scans remain pending, with zero receipts at release verification.
The user subsequently refreshed the plugin to 27 tools and supplied a manual
scan receipt, d483b9a3-e355-4367-8436-15b3943fd8a6 (20:48:54-20:58:01 Sydney),
with PARTIAL for both mailboxes. Mailbox 2 listed 136 IDs; not all bodies were
processed. Receipt persistence/readback and existing Synogize deduplication were
reported successful; zero new business records were written. This does not
verify complete coverage or new-write behavior in that run. The user then
narrowed lookback to seven days. At the end of September 7, migration 010 and
29-tool bounded resumption were locally verified (269 tests) but not deployed
or activated in the daily task. The September 8 deployment supersedes that
historical release status; scheduled acceptance is still pending.

The historical ledger below must not be interpreted as full scan acceptance.

## Verification ledger

| Claim | Evidence | Verdict |
| --- | --- | --- |
| Both Gmail accounts can be queried | Real bounded Synogize searches in the preceding integration test | Verified for that manual test, not all scheduled runs |
| GPT tools save structured data in the cloud | Synogize project 71a54b6c-84b1-4a0c-a88d-fe03b0342a56 and two canonical gmail-job-observation-v0.1 EMAIL resources; freshly read back during this verification | Verified |
| Website and MCP share the database | src/server.ts passes the same opened database into WorkspaceService and createWebAuthApp; web queries use that database. User confirmed the Synogize page after manual write | Verified in code and prior user acceptance |
| New profile display is read-only | Transport test renders GPT-written profile snapshots and history, rejects removed POST endpoint, confirms no DB changes | Local gate and cloud rendering verified; deployed |
| Daily task has Workspace write instructions | User pasted old Sheet-only prompt and reports saving supplied replacement | User-confirmed configuration, not independently fetched |
| Unattended scheduler can execute the complete new policy | No scheduled run ID/output with independent readback available in this session | Pending, do not claim complete |
| All required source reports are already stored | Earlier audit found no attached JD/fit reports; original GPT content location unresolved | Pending |
| Scan receipts persist in Workspace | Dedicated ledger deployed; user supplied PARTIAL receipt saved and read back by exact run ID | Partial receipt verified by user; successful global coverage and recurring acceptance pending |

No production writes or schedule changes were made during this verification.
The core architecture is confirmed; full operational acceptance is not yet proved.

## Development gate

Before any subsequent feature, read this decision, the latest user instructions,
PROJECT_KICKOFF status and the relevant original implementation/run records.
Check actual code and runtime evidence where they differ. State upstream/current/
downstream and short-/long-term benefits before editing. Distinguish planned,
implemented locally, deployed, manually tested and scheduled-run verified.
Every proposed feature must explain how it serves this core flow rather than
introducing a competing one.


## Proactive preparation authorized by Jun - 2026-09-09

The latest instruction replaces a single generic-resume baseline with an aggregate
interview/experience library. The user explicitly selected in-Workspace matching,
save/ignore, resume preparation, and external-site submission. Scoped library and
candidate preparation writes are now authorized; general application/task mutations
retain their existing authority rules. Alert discovery remains separate from actual
application evidence and daily mail follow-up. See [the library workflow](JOB_LIBRARY_WORKFLOW.md)
for source provenance, score limitations, access boundaries and release evidence.
