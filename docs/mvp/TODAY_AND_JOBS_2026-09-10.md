# Today updates and readable candidate lists — 2026-09-10

Status: deployed as `today-jobs-20260910-r1` at 2026-09-10 11:39:47 Australia/Sydney.
Authenticated Today, Jobs and candidate-detail acceptance passed on real data.
The production acceptance below supersedes the earlier SSH-blocked attempt.

## Detail-page correction and preview cleanup

Jun's follow-up identified the remaining unstyled candidate detail page and
requested removal of local example data. The detail page now places readable
saved JD content beside a padded information/actions panel; editing saved JD and
linking an existing application are folded. Repeated role/title, oversized unknown
status labels and import boilerplate are removed from the primary detail layout.
Link selection starts empty to avoid implicitly selecting the first application.
This completes the candidate-list-to-detail journey within the existing contracts.

The original synthetic preview was stopped, destroying its in-memory database
(28 example applications and four candidates). A short isolated visual check was
also stopped and cleaned up immediately. The fixture launcher now requires an
explicit `--synthetic` flag. Real local `PersonalAIWorkspace/data/workspace.db`
was retained; its SHA-256 was identical before and after cleanup. Other historical
databases were not deleted based on filenames. No live example server is retained.

This follow-up passed both type checks, 47 existing transport/library tests and
the build. Desktop browser inspection verified readable JD, separate actions,
folded association and no horizontal overflow. No new production deployment was
attempted. The five-file upload archive described below predates this correction
and must be regenerated from the final six runtime files before any deployment.
The previous 395-test result applies to the earlier package; the follow-up used
the bounded relevant checks above instead of repeating unrelated release work.

## Continuity and benefits

- **Upstream:** Jun's September 10 screenshots identified missing prominent daily
  updates, operational Job Alert text occupying Jobs, and unstyled candidate rows.
  This follows the [core workflow](../architecture/CORE_JOB_WORKFLOW.md#website-role),
  [meaningful application timeline](APPLICATION_PROGRESS_TIMELINE_2026-09-09.md)
  and [candidate library](../architecture/JOB_LIBRARY_WORKFLOW.md).
- **Current package:** a read-only Today projection of saved application progress
  and new candidate counts, folded operational tools, and responsive candidate
  rows. Existing import controls move to Today; their write contracts are retained.
  No migration, business-data edit, model-provider change or scan-policy change.
- **Downstream:** opening Today now reveals the saved morning Nine rejection and
  links to its application. Public authenticated verification passed. The next
  product increment can reuse the retained base resume for per-job variants;
  daily scheduled acceptance remains a separate gate.
- **Short-term benefits:** synthetic browser checks verify visible update prompts,
  intact long titles, compact JD labels and usable desktop/390px candidate actions.
  Read-only regression checks verify ownership isolation and unchanged database
  contents. Production screenshots additionally verified the real daily update,
  10 candidate rows and missing-JD detail; all live database contents were retained.
- **Long-term benefits:** the reporting frontend reuses the existing meaningful-mail
  classifier and admitted lifecycle records, keeping operational receipts distinct
  from progress and candidate discovery distinct from actual submission.

## Delivered behavior

Today begins with application changes recorded on the Workspace's local date,
including terminal states such as rejection and meaningful recruiter messages
that have not caused an admitted transition. Evidence already represented by an
admitted transition that day is shown only through that transition. Historical
email arrival dates do not replace recording dates; timestamps explicitly say
“记录”. This is a daily summary, not a persisted unread/inbox mechanism.

Counts cover all applications updated that day. At most 20 application groups are
displayed, with a total and a link to all applications. New candidates recorded
today have a separate count and a Jobs link. Existing Task attention rules and the
existing MCP Today response remain unchanged. The previous five-change history
section is replaced by the prominent daily summary on the website.

Mail scan receipts and Job Alert import are under the closed-by-default
“邮件检查与职位导入” section. Jobs starts with filters and candidates; imports remain
accessible from Today. With model matching disabled, the default order is recent
updates. Candidate rows show company, one role heading, location, JD availability,
decision and source/detail links. Identical role/title and known import boilerplate
are hidden only in the list; saved source notes remain intact. Stored JDs are
recognized independently of optional model matching.

## Verification

- Both TypeScript checks, all **395 tests in 51 files**, and the production build
  passed in an isolated LF-normalized copy of the final source.
- Six added regressions cover Sydney midnight and both DST boundaries, future
  exclusion, rejection visibility, evidence-only requests, evidence deduplication,
  workspace isolation, no read writes, counts above five and the 20-group cap,
  candidate prompts, preserved notes and JD availability.
- Initial raw Windows verification exposed existing CRLF-sensitive Skill checks,
  a Python subprocess issue and a test worker exit. Using the established
  LF-normalized release-verification approach, an absolute Python interpreter and
  two workers resolved those environment issues; protected Skill sources were not
  edited. The Python export suite's five checks also passed directly.
- Chrome desktop and synthetic 390px previews were visually inspected for Today
  and Jobs. Four long-title candidates, saved/missing JD labels, status chips and
  action links render together. Desktop has no horizontal overflow. Today shows
  a rejection and four new candidate jobs above Task attention. The folded tools
  expand to the existing receipt cards and import button.
- `git diff --check` passed. Real Gmail, candidate decisions, resume content and
  application states were not mutated for these checks.

## Earlier release preparation and blocked attempt

Prepared release: `today-jobs-20260910-r1`. Five runtime files are overlaid on the
accepted resume-editor r3 source; the expected manifest covers 149 runtime files.
The local upload archive SHA-256 is
`3cf8b6e3b75cacd8509fb6c4c68e40b0f4b5a0cda8798ae109612b231ac9b86a`.
Private temporary release files and credentials are outside Git.

The prepared procedure verifies the baseline and resulting manifests, builds a
separate image, backs up the live database, rehearses candidate/previous-image
startup against backup copies, compares full logical fingerprints across cutover,
and restores the previous image on cutover failure.

On September 10 the existing Lightsail instance was running, but SSH timed out.
An exact temporary current-client /32 rule was tried and then removed in cleanup;
the original SSH CIDR and `lightsail-connect` alias were verified restored. AWS
Systems Manager had no registered instance. The attempt stopped before upload,
cloud build or cutover: no production release, backup rehearsal or authenticated
new-UI acceptance is claimed. Restore an existing management connection, then run
the prepared procedure and verify Today/Jobs in the authenticated public browser.

## Production deployment and real-data acceptance

Jun explicitly selected completing this UI release and real-data acceptance before
starting resume variants. Existing authenticated Lightsail browser SSH provided
the management connection; this successful attempt made no firewall changes.

- Final source contains six runtime changes, including the detail-page follow-up.
  The 149-file manifest was verified against the copied r3 baseline and final
  source. Source directory: `/opt/paw-today-jobs-20260910-r1`.
- Final verification: both type checks passed; the full suite produced 391 passes
  and four Skill packaging failures caused by the isolated checkout's source
  snapshot. After making the final source available as a commit in that temporary
  checkout, the affected packaging file passed all seven tests. The unchanged
  passing results were reused: all 395 tests have passing evidence. Build passed.
  Temporary validation commit: `beb48c096dbf46236cc175da4c111d16927eb941`;
  this is not a commit or push in the user's repository.
- Runtime overlay SHA-256:
  `dc269423c81b49fbef084bffc7083d720db999c5496c3de0fba4e0f542526dc1`.
  Built image ID:
  `sha256:2ae864fb57400c8dc6f78a8750a82b6776ba5934b47a0f13799b635aff58578e`.
- Backup `workspace-20260910T013921Z.db` passed integrity verification at migration
  016. Both candidate and prior images passed isolated startup/recovery against
  backup copies, with 43 tables and 1,753 rows unchanged.
- Cutover passed at `2026-09-10T01:39:47Z`; container healthy, database available.
  Full live logical fingerprint was identical before and after:
  `a9cbfb10e91387fbc8016202d427aa9f3fe742a9c330b5d3199ee306e7214f7d`.
  Durable build/cutover logs and the final manifest are under
  `/srv/paw/deployments/today-jobs-20260910-r1-*`.
- All five public release checks passed: signed-out access, private-route isolation,
  general write boundary, OAuth start and unsafe return rejection.
- Authenticated Chrome accepted Today showing exactly one updated application:
  Nine, Associate Software Engineer and AI Agent Orchestrator, APPLIED to REJECTED,
  recorded at 08:51 Sydney. The update links to the real application.
- Jobs retained all 10 actual candidates, defaulted to recent updates, removed the
  operational import panel and rendered titles once with compact JD labels.
  Public Sector People's real detail rendered the JD form beside source and action
  controls, with no horizontal overflow or example records. All real candidates
  currently lack stored JDs, so saved-JD rendering retains earlier local evidence.
- Today's folded tools opened to the original complete morning receipt, historical
  partial web check and Job Alert import controls. No scan/import/save/decision was
  triggered for acceptance. The existing resume page still showed version 1.
- Temporary private S3 source-transfer object was removed by exact version ID;
  readback found no versions or delete markers. No synthetic server remains running.
  Real local and cloud data were retained; no migration or model setting changed.

This closes the UI deployment and real-data gate. It does not establish the result
of a future unattended scan or repair the pre-existing incomplete Job Alert/JD
coverage. Source changes remain in the local working tree; no GitHub push occurred.
