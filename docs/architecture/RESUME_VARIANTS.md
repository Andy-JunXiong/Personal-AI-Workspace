# Named per-job resume versions

Status: implemented and locally verified on September 11, 2026. Not deployed.
Production remains `watch-reading-20260910-r1` / migration 017.

## Continuity and benefits

The user selected per-job resume versions as the next development priority after
accepting the [base editor, ordering and gutter navigation](RESUME_EDITOR.md).
This package adds named editable copies linked to existing candidates or applications,
using the same editor and rendering pipeline. The next gate is production backup,
migration 018, release and authenticated real-data acceptance. Locally verified
benefits are independent content, preserved section order and reliable version
selection; live use remains pending. Longer term, stable copy identifiers enable
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

Before production: take a consistent backup and recovery copy, run migration 018
on the copy and `node dist/scripts/verify-resume-variants-migration.js BEFORE AFTER`,
then perform the existing release/public gates and authenticated real-version
save/preview/export acceptance. This development did not migrate or edit real data.
