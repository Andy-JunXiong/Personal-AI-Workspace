# Core job workflow — authoritative product boundary

Confirmed by Jun on 2026-09-07. This decision supersedes conflicting earlier
proposals to make the website a parallel operational workspace.

## Product clarification — 2026-09-08

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
status are in the [release handoff](../mvp/RELEASE_HANDOFF_2026-09-08.md) and
[recovery record](../mvp/JOB_TRACKER_RECOVERY_2026-09-08.md). The current
`mail-layout-20260908-r2` release includes shared mail identity, durable
application-scoped manual checks and collapsed status cards; both daily tasks
remain paused pending platform recovery and scheduled acceptance;
the September 7 execution evidence below is historical.

## Core flow

The [September 8 backend receipt requirements](MAIL_SCAN_BACKEND_LEDGER_REQUIREMENTS_2026-09-08.md)
record a target responsibility change: GPT retains evidence interpretation and
authorized business operations; the backend would maintain run identity,
processing progress and receipt aggregation. It preserves this core flow and
does not select an API executor or replacement scheduler. Implementation and
platform acceptance remain pending; existing tools retain their current contracts.

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
