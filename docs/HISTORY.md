# Project history

This file preserves the detailed dated release and milestone narrative moved from
[README](../README.md) at main commit `2a9e169`. The original snapshot below is unchanged
except for relative Markdown link paths adjusted after relocation into `docs/`;
new closeout entries appear before it.
Current product positioning and the next active boundary remain in README; the
[documentation index](INDEX.md) identifies authoritative current contracts and
historical evidence.

## September 12 session closeout

### Continuity and benefits

Jun requested ending today's work, updating the relevant documentation, and
committing and pushing to GitHub main. This closeout records the completed
GitHub/skill-library work and the next acceptance steps. It changes documentation
only; it does not rerun business commands or modify the enabled schedule.

GitHub checks now sit above the stable skill library and original sources.
Incremental maintenance preserves existing evidence, while JD analysis reuses the
catalog instead of repeatedly reading every resume and checking every repository.
Empty or accidental catalog replacement is rejected. Detailed contracts and
release evidence remain in the [skill-library ledger](architecture/SKILL_LIBRARY.md#incremental-updates-and-daily-github-checks--september-12-follow-up).

### Final production state

- Release `skill-updates-20260912-r1`, runtime commit `3f263e0`; release/task
  acceptance documentation was pushed as `f1a0947` before this closeout.
- Final runtime verification passed 518 tests, both type checks and build.
  Production-copy recovery preserved 50 tables / 2,297 rows; public checks,
  authenticated page inspection and compact/full manifest equality passed.
- Live catalog is **v3/CURRENT, 32 entries/six projects**. Five registered
  GitHub repositories returned fresh UNCHANGED receipts in website, ordinary
  ChatGPT and saved-task Run-now trials. No catalog rewrite was needed.
- ChatGPT task **PAW GitHub 项目每日更新**, ID
  `6aa548a566188191a4415bcfcc39558d`, is enabled daily at
  **07:45 Australia/Sydney**. Saved-task Run now completed in a displayed
  50 seconds; independent PAW readback verified the five checks.
- Google candidate remains **v2/DISMISSED**. A new skill-library-based screening
  and matching report has not yet been accepted through a real saved/read-back run.

### Next session

1. Verify the existing task's first **clock-triggered September 13, 07:45 Sydney**
   run against fresh PAW receipts and timestamps. Manual Run now is already tested
   and does not substitute for this evidence; do not create a duplicate task.
2. Reuse the CURRENT catalog for the real Google JD assessment, using SKILLS for
   analysis and a fresh MANIFEST before each dependent write. Read back saved
   screening and matching results. Keep the five-year SWE requirement UNKNOWN,
   non-FILTER, and preserve candidate v2/DISMISSED and application state.
3. When a repository actually changes, verify selected-file evidence and MERGE of
   affected skills through to CURRENT. Do not rebuild the entire library. Real
   UPDATED/FAILED branches and semantic changes remain unobserved; local tests
   cover their mechanics. The explicit 8+/10+ commercial SWE FILTER-to-KEEP case
   remains separate acceptance work.

R2 complete-dossier, Job Tracker clock-trigger/receipt correlation and Watch
human-quality gates remain independent. Narrow-device rendering is not verified.

### Verification and publication scope

This documentation closeout uses diff and reference checks and reuses the passing
runtime evidence above. No runtime, dependency or configuration changes invalidate
those checks, so the test suite is not repeated. Existing unrelated skill-file
edits are excluded from this documentation commit.

## September 11 session closeout

### Continuity and benefits

Jun requested ending today's work, updating the relevant documentation, and
committing and pushing to GitHub main. This closeout publishes the completed
candidate-grade implementation and production acceptance with a single current
handoff. It enables the next session to begin with real-grade and connector
acceptance, without repeating the release. The immediate benefit is a recorded
deployment baseline and explicit remaining gates; the longer-term benefit is
traceable job-selection evidence across conversations, whose actual usefulness
still requires real assessment use. This documentation closeout adds no runtime,
business-data, scheduler, model-provider or deployment change.

### Final production state

- Current release: `candidate-grades-20260911-r1`, deployed September 11 at
  20:32 Sydney from runtime source `6fef9b7710fa4c3be6122d094d0af5afe74fc503`.
  See the [production and authenticated-page ledger](architecture/CANDIDATE_MATCH_GRADES.md#september-11-production-release).
- Migration 019 and 31 MCP tools are deployed. Consistent backups, isolated
  candidate/repeat/old-image recovery checks, preservation of the 46 prior business
  tables, five public checks and actual MCP reads passed.
- After the user restored website sign-in, the real Jobs list and two candidate
  details passed: 10 candidates, saved-JD “待评估” and missing-JD “JD 待补充” states
  agree with MCP. No production grade was created for testing.
- [Per-job resume copies](architecture/RESUME_VARIANTS.md) and the
  [single-application preparation context](architecture/APPLICATION_PREPARATION_CONTEXT.md)
  remain deployed. The application-page correction keeps resume preparation in
  Jobs. Base resume version 8 was retained in the release readback.
- Backend external matching remains off. Candidate decisions, applications,
  Tasks, submitted-material confirmations and scheduled-task configuration were
  not changed by this release or closeout.

### Next session

1. Refresh the ChatGPT Workspace connector and verify discovery/use of the new
   candidate-assessment command. Running-server tool discovery is already passed;
   refreshed hosted-client acceptance is still separate.
2. With a real complete JD and explicitly selected current resume/experience
   sources, complete a grounded assessment save and cross-conversation readback.
   Verify real evidence/history, correction and staleness behavior without
   treating synthetic tests as production-use acceptance.
3. Retain the separate R2 complete-dossier and explicit resume-selection gates.
   Actual unattended Job Tracker receipt/write/readback and Watch report quality
   and deliberate human decisions remain independent operational acceptance work.

### Verification and publication scope

The same runtime source already passed 444 tests, both type checks and build;
desktop/390px synthetic evidence and the production gates above remain valid.
This closeout checks documentation diffs, references and Git main synchronization;
it does not repeat the runtime suite or deployment. Existing GitHub push CI remains
enabled; its result must be reported separately from local and production evidence.
The four pre-existing Skill paths marked modified by Git have filtered content
hashes equal to HEAD and no textual diff; this closeout does not rewrite them.

## R2 local package — 2026-09-11

The [single-application preparation context](architecture/APPLICATION_PREPARATION_CONTEXT.md)
extends `workspace_get_project` without adding a tool or migration. It reports
material gaps and history limits, lists application-linked working resumes, includes
one unambiguous copy or requires an exact selection, and keeps mutable working
content separate from Drive-backed submission evidence. Both TypeScript checks and
38 focused local tests passed. GitHub Node 24 `Verify` run 61 then passed both type
checks, all 423 tests in 55 files, the production build and pinned Skill packaging
against exact runtime source `2b15664`. Deployment and real-application acceptance
remain pending.

## Current state — 2026-09-10

Current development priority: [nine-region resume editor](architecture/RESUME_EDITOR.md),
following Jun's instruction to finish the reusable resume before further external
job updates. The editor is deployed to AWS as `resume-editor-20260909-r3`, with
migration 016 and the base resume saved as version 1. Real save, PDF preview and
Word/PDF downloads passed; both cloud PDF pages were inspected, including spacing
and education-date fixes. [Open Resume](https://workspace.ai-radar-lab.com/workspace/job-search/resume).

Previous release: [proactive job discovery and interview library](architecture/JOB_LIBRARY_WORKFLOW.md),
`library-20260909-r4`, source `b8da4bb`. The website supports scoped library edits,
candidate decisions and JD storage. External-model matching and draft generation
are disabled by default, following the user's storage-only choice. All 384 tests,
type checks, build, backup recovery, data preservation and public route checks passed.
Private readback verified 85 library records and 10 SEEK alert candidates; all ten
still need full JDs. No model comparisons ran. Alert coverage remains incomplete:
one mailbox reached the query bound and the other returned an empty HTTP 204 response.
Native LinkedIn/SEEK login and unattended alert scheduling are
not provided; discovery uses connected Gmail alerts. General browser writes stay off.

Previous release: [post-application dossier workflow](architecture/APPLICATION_DOSSIER_WORKFLOW.md),
`dossier-20260909-r1`. Each application shows a four-item materials checklist:
posting URL, JD, confirmed submitted resume version and structured skills comparison.
Comparison rows include gap/evidence notes; exact project readback preserves access
to the latest profile beyond recent resources. 375 tests and live rendering of
24 applications passed; source `1f43448` is published. Historical backfill still
requires actual source materials.

Retained page cleanup: `jobdetail-20260909-r1` removes the entire Gmail latest-progress
card from individual application details. All 374 tests and production rendering
checks on 24 applications passed; source `7bd8316` is published. See the
[follow-up release record](mvp/APPLICATION_PROGRESS_TIMELINE_2026-09-09.md#follow-up-remove-gmail-panel-from-application-details).

Retained correction: [application progress timeline](mvp/APPLICATION_PROGRESS_TIMELINE_2026-09-09.md),
`progress-20260909-r1`. Timelines show submission, actual progress and relevant
mail milestones; check receipts, vacancy marketing and task administration are
excluded. New mail retains its application category. All 374 tests and read-only
production checks across 24 applications passed; existing evidence is preserved.

Retained website capability: [application calendar and ongoing default](mvp/APPLICATION_CALENDAR_2026-09-09.md),
`calendar-20260909-r1`. My Applications defaults to ongoing; the previous/current
month calendar shows daily submission counts and links, including closed history.
371 tests, desktop/mobile browser checks, production backup/recovery, unchanged
database fingerprints and read-only live rendering passed. Source `256bdf9` is published.

Follow-up correction: [ongoing-only keyword checks](architecture/MAIL_SCAN_BACKEND_LEDGER.md#ongoing-only-keyword-follow-up--2026-09-09)
exclude rejected/ended applications and replace full-body website reads with
keyword-search metadata and snippets. Deployed as `ongoing-20260909-r1`: 369 tests,
backup/recovery, data preservation and website checks passed. Live targets are
12 ongoing applications; 12 ended applications are excluded. A representative
dual-mailbox keyword probe completed with zero full-body requests. A fresh full
website batch receipt and the first scheduled run remain separate acceptance.

Deployed follow-up: [resume event-conflict correction](architecture/APPLICATION_RESUME_ASSOCIATIONS.md#production-event-conflict-correction--2026-09-09)
rejects changed content under a reused resume event ID, preserving safe retries
and explicit confirmation failures. Type checks, 368 tests and build passed;
production backup, recovery rehearsal, data preservation and web checks passed.
Source commit `1451def` was pushed and independently verified on GitHub main.
The next operational gate remains the first
actual September 10 scheduled execution described below.

The earlier `dossier-20260909-r1` release retained
[Drive resume association](architecture/APPLICATION_RESUME_ASSOCIATIONS.md),
migration 014 and the mail-search workflow below.
375 tests passed. Production backup/recovery, source checks, health and data
preservation passed. Sixteen candidate file/revision associations across nine
existing applications were saved through MCP and read back; RSM's website matches.
Candidates are explicitly separate from actual submitted-file/version confirmation.
Interactive GPT can reuse these links; the daily task has not been extended to Drive.

Jun approved subject/company/exact-sender job-mail search: normally 24 hours,
recovery at most 72 hours, metadata screening before matching-body reads.
The [new search release](architecture/MAIL_SCAN_BACKEND_LEDGER.md#job-metadata-search---2026-09-09)
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
| Production | `resume-editor-20260909-r3`, migrations 001-016; backup/recovery, health, data preservation and live resume preview/export verified; source tracked by a 149-file manifest | Ten candidate JDs still missing; alert coverage incomplete; external matching disabled; named resume variants remain a future increment |
| Durable operations | Applications, attributable observations, lifecycle transitions, Tasks, candidates, recommendation runs and scan receipts share one Workspace database | Sustained daily use remains to be evaluated |
| Website | [Job Search](https://workspace.ai-radar-lab.com/workspace/job-search/today): Today, inventory, timelines, JD/skill reports and resume file/version links | Historical JD and skill reports still need source-grounded backfill |
| Mail search | Both mailboxes; subject keywords, stored companies and linked exact senders; normal 24-hour / maximum 72-hour recovery; matching-body review and deduplication | New applications require explicit submission-confirmation evidence; filtered completion does not cover every email |
| Manual acceptance | Run `6933e727-e6c8-4f48-9fdd-5913724a7e60` COMPLETE/CLOSED; both matching scopes complete, empty queues, website matches | First actual scheduled execution is a separate gate |
| Daily automation | Retained task enabled with verified policy for daily 08:00 Australia/Sydney; obsolete task paused | Verify the first scheduled receipt, next planned September 10; do not substitute a manual run |
| Resume association | Sixteen Drive candidate files/revisions linked to nine existing applications and read back | Actual submitted-file/version confirmation remains pending; daily unattended Drive discovery is not integrated |
| Evaluation | [M4 v0.3](dogfood/M4_REAL_USE_EVALUATION_v0.3.md) adopted, not started | Establish the integrated baseline after scheduled acceptance |

**Session closed for September 9.** Next session, follow the
[library restart checklist](architecture/JOB_LIBRARY_WORKFLOW.md#session-closeout-and-restart-point---2026-09-09):
collect full candidate JDs, resolve alert coverage gaps and consolidate attributable
experience sources. External matching remains disabled by user choice. Separately
check the retained task's actual scheduled result against its Workspace receipt;
see [daily acceptance](mvp/DAILY_WORKFLOW_ACCEPTANCE.md). Today's closeout is
documentation and GitHub publication only.

### Historical whole-mailbox recovery

The earlier exhaustive seven-day approach and its PARTIAL runs are retained in
[the mail ledger](architecture/MAIL_SCAN_BACKEND_LEDGER.md).
The `mail-body-20260909-r4` release verified multipart body recovery and additive
migration 013; those capabilities remain deployed. Jun subsequently replaced
whole-mailbox acquisition with filtered job-mail search. Old unrelated pending
sources and old two-task pause instructions are historical, not today's backlog
or task policy. Release-specific counts and test totals retain their original scope.
The [documentation index](INDEX.md) distinguishes those records from current
contracts and unimplemented proposals.

## Evaluation and historical milestones

Spike 1B and M1/M2/M3 retain their verified milestone results in the
[historical index](INDEX.md#historical-evidence). M4 Day 0/1 evidence remains
valid for its original operational checks. The frozen 12-tool evaluation no
longer describes the expanded shared production environment: its original
September 10/17 and October 1 decisions are retired, without rewriting thresholds
or claiming a pass or failure. [v0.3](dogfood/M4_REAL_USE_EVALUATION_v0.3.md)
defines a new prospective integrated-workflow evaluation; its clock has not started.

The [intelligence ledger architecture](architecture/JOB_SEARCH_INTELLIGENCE_ARCHITECTURE_v1.md)
and [ADR-012](adr/ADR-012-job-search-intelligence-boundary.md) remain a design
baseline, not a fully implemented analysis system. Deployed candidate/digest
storage does not imply implementation of the full versioned skills and analysis ledger.

## Development and operations

Follow the [Development Continuity and Benefits Standard](DEVELOPMENT_CONTINUITY_STANDARD.md).
New documentation must be entered in [docs/INDEX.md](INDEX.md), including every
dated result or handoff. Historical evidence is retained; superseded rules link
to their replacement. Publishing source is separate from deploying or activating tasks.
