# Named per-job resume versions

Status: deployed September 11, 2026 as `resume-variants-20260911-r2`, migration 018.
Authenticated real-copy creation, save/reopen, preview and downloads passed.
A footer-only PDF tail page was corrected during visual acceptance; the final
real base export contains two pages with unchanged body text.

## Continuity and benefits

The user selected per-job resume versions as the next development priority after
accepting the [base editor, ordering and gutter navigation](RESUME_EDITOR.md).
This package adds named editable copies linked to existing candidates or applications,
using the same editor and rendering pipeline. Production backup, recovery rehearsal,
migration and authenticated real-copy operations now have evidence below. The next
development package is R2's bounded read-only application preparation context.
Independent content is covered by integration tests; real creation and exports
retain the base content and ordering. Longer term, stable copy identifiers enable
job-specific preparation and a later explicit submitted-snapshot workflow.

This is domain-specific persistent state under the existing
[core workflow](CORE_JOB_WORKFLOW.md) and
[resume-association boundary](APPLICATION_RESUME_ASSOCIATIONS.md). The existing
Watch comparisons remain advisory: platform document collaboration does not by
itself establish a PAW application association or submission evidence. This package
extends existing storage rather than adding an AI editing host. Revisit editor
ownership if platform collaboration demonstrably preserves these identifiers,
content, export fidelity and explicit admission boundaries. No model call, new MCP
tool or platform integration is added here.

## User flow

- In Resume, choose the base or a named version using the current-resume selector.
- Expand the create-version control, choose an existing candidate/application and name it.
  Candidate and application details also link directly to this preselected flow.
- Creation copies the **saved base** and its section/item order. Unsaved edits must
  be saved first. Each copy can then be edited, saved, previewed and exported.
- The selected copy shows its company/role, base source version and target link.
  Downloads use the copy name and its own version number.
- Preview stays at the right of the save/export toolbar; navigation stays in the
  gutter next to the editor. Narrow screens stack the heading and template link.

A named version is a mutable working copy, **not revision-history storage**. Each
save advances its concurrency counter. Editing the base or one copy cannot update
another. Names are unique per workspace (SQLite NOCASE), trimmed, 1-120 characters;
up to 200 copies. Rename, deletion, copy-from-copy, historical rollback and automated
JD tailoring are outside this increment. Name/contact remain fixed template fields.

Linking a working copy to a candidate/application does not record actual submission,
change lifecycle/Tasks, or replace existing Drive resume associations. A later
submitted-snapshot feature must capture the specific content and explicit evidence.

## Persistence and HTTP contract

Migration `018_resume_variants.sql` adds only `resume_variants` and its index. It
stores workspace, target ID, company/role snapshot, base source version, structured
content, own record version, creator/updater and timestamps. The existing private
base template is reused; initialization is already immutable. No private template
or generated file is committed to Git.

All routes use the existing authenticated workspace membership. Scoped mutations,
preview and export require the existing session, same-origin and CSRF authorization;
general Web writes remain disabled. UUID validation and workspace filtering apply
to every variant/target lookup. Conversion rechecks authorization and the selected
version after the asynchronous renderer returns.

| Route suffix under `/api/v1/job-search/resume` | Behavior |
| --- | --- |
| `/variants` GET | List this workspace's named versions |
| `/variants` POST | Create with name, targetType (`CANDIDATE`/`APPLICATION`), targetId, expectedBaseVersion and intentKey |
| `/variants/:id` GET / POST | Read / save selected copy; save uses existing content + expectedVersion contract |
| `/variants/:id/preview` POST | Render selected unsaved content without saving |
| `/variants/:id/export` POST | Export selected saved version as DOCX/PDF |

Creation and its idempotency receipt commit atomically. Exact intent/payload replay
returns the original result, including after subsequent edits. Changed payload
with the same key is rejected. Stale base creation and stale saves/exports fail
without changing content. Existing base routes retain their behavior.

Web routes are `/workspace/job-search/resume` and
`/workspace/job-search/resume/variants/:id`; base-page `candidateId` or `projectId`
query parameters preselect the create target. Authentication preserves variant
paths; target preselection may need to be repeated after a fresh login.

## Verification and release gate

The migration triggered one full-suite attempt (418 tests). Two old migration
expectations needed updating; ten Skill checks initially failed due to local CRLF
bytes, and three packaging cases were interrupted by a native Node copy crash.
The four unchanged Skill files were restored to exact committed bytes, without
changing their content. Packaging fixtures now copy bytes explicitly because a
standalone `cpSync` probe reproduced the same OneDrive process exit; canonical-byte
and commit checks are retained.

Passing full-run evidence is reused for unchanged code. Focused follow-ups passed
migration/backup, Watch preservation, Skill contracts and all seven packaging
checks. Final resume service/editor checks passed (6 tests), and the full Web
transport file passed in the broad run, including variant authorization, CSRF,
independent save, preview, filename selection and concurrent-export rejection.
The final view/transport follow-up passed 45 tests, including both detail-page
entry links. All 418 cases have passing evidence across the full and targeted runs;
this is not a claim that the initial `npm run verify` exited successfully.
Both final TypeScript checks and the production build passed.

Migration checks compare every pre-existing table's data/schema, retain the private
base resume, reopen upgraded copies twice and verify old-reader restart. Only
synthetic temporary/in-memory databases were used. Browser checks cover creation,
independent edit/save/reload, unchanged base content and desktop/390px layouts.
The temporary preview server was stopped and its in-memory synthetic data discarded.
The synthetic browser template is not a renderable real DOCX; this session does not
claim a new real-file PDF visual acceptance. Existing renderer tests passed.

The original pre-production gate was: take a consistent backup and recovery copy, run migration 018
on the copy and `node dist/scripts/verify-resume-variants-migration.js BEFORE AFTER`,
then perform the existing release/public gates and authenticated real-version
save/preview/export acceptance. The local development above did not migrate or edit
real data; the subsequently authorized production actions are recorded below.

### R1 release preparation — September 11

The user authorized proceeding with R1 after reviewing the updated roadmap.
Release source is `0ae8937c4e4d000e0456b23d1521fcd554eb7226`. The existing recovery
script now dispatches `--resume-variants-upgrade` to the migration 018 verifier;
its candidate/repeat/previous-image checks are retained. The final release run
passed **418 tests in 54 files**, both TypeScript checks and the build, using two
workers and the existing explicit Python interpreter. No test failures remain
from the earlier development run.

The source archive SHA-256 is
`c0ac65037623c44c4c2de69c028b388c7e7504487df879a2330e4d055f1500e2`.
The current production endpoint passed all five public boundary checks before
deployment. These checks cover the existing runtime, not the unreleased feature.

Direct SSH timed out; after the user signed in, AWS's browser SSH provided access.
Live UFW is **inactive**, so the retained initialization rule is not evidence of
the timeout's cause. Temporary single-IP Lightsail access was removed and the
original firewall rules retained. No broader SSH exposure was required.

### R1 production acceptance — September 11

`resume-variants-20260911-r1` became healthy at `2026-09-10T23:56:47Z`
(September 11, 09:56 Sydney). A consistent backup and retained stopped database
copy preceded migration 018. The candidate/repeated-open/previous-image recovery
rehearsal passed. The migration verifier preserved all 45 pre-existing business
tables; cutover fingerprints matched across 47 tables and 1,905 rows. All five
public boundary checks passed after release. General Web writes and identity
bootstrap remain off.

The first post-migration verification attempt failed with `SQLITE_CANTOPEN`:
the WAL-mode before-copy had been mounted as one read-only file without a writable
directory for SQLite sidecars. The trap restored the previous healthy application
image while retaining the additive 018 database. Verification then passed using
an isolated writable directory containing the before-copy. A second application
cutover passed matching fingerprints. No old database was restored over live data.
For this verifier, mount the isolated copy directory, not a lone WAL-mode file.
Private recovery evidence remains in `/srv/paw/deployments/` under the release prefix.

Using the existing authenticated account, acceptance created one real Nuix
application working copy from saved base version **8**. Save without content
changes remained copy version **1**; reload, preview and Word/PDF downloads worked.
The base fields and item order matched the pre-release DOM readback. The copy was
linked to the existing application, without submission confirmation or lifecycle/
Task edits. This does not claim a real changed-content save; independent edits
and version increments were exercised with synthetic integration/browser fixtures.
Later unsaved user edits were observed and left untouched.

PDF inspection found three pages, with only `Page 3 of 3` on the last page.
The PDF-input education builder appended an empty paragraph after the last school.
An isolated production-renderer comparison retained all text and reduced the
output to two pages by removing that final separator. Source `7cca996` emits
separators only between schools. Its seven Python renderer cases, all **418 tests
in 54 files**, and production build passed. The unchanged TypeScript/browser
checks retain the preceding release's passing evidence.

The correction was deployed as `resume-variants-20260911-r2` at
`2026-09-11T00:09:58Z` (10:09 Sydney), source `7cca996`. Its fresh backup and
candidate/repeated-open/previous-image recovery rehearsal passed with migration
018 unchanged. Before/after cutover fingerprints matched: 47 tables, 1,907 rows.
The first public probe overlapped the service replacement and failed; after the
new container was healthy, all five checks passed. Temporary private source
transfer objects for both releases were deleted by exact object version.

During final readback the user's named copy had advanced to version 3 while the
base remained version 8. These were user edits, not agent acceptance mutations;
the original editing tab was not refreshed or overwritten.

Final authenticated export of saved base version 8 through the new runtime
produced `Resume-v8.pdf`: **two pages**. Normalized body text matched the earlier
Nuix version-1 export exactly after excluding page-number fields. Both rendered
pages were visually inspected: complete education content, correct `1 of 2` /
`2 of 2` footers, no blank tail page. The correction changes document layout only;
it does not rewrite stored content. Export artifacts remain private, outside Git.
