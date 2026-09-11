# Nine-region resume editor

Status: deployed to AWS Lightsail as `resume-editor-20260909-r3` on
2026-09-10 Sydney time (2026-09-09 UTC), with migration 016 and the private
baseline initialized as version 1. Production verification is recorded below.

**September 11 follow-up:** [named per-job versions](RESUME_VARIANTS.md) are deployed
as `resume-variants-20260911-r2` with migration 018. Real-copy save/reopen and exports
passed; the release also removes the final education separator that could create
a footer-only PDF tail page. The saved base remains version 8.

## Continuity and benefits

### Upstream requirement

Jun's September 9 follow-up explicitly prioritizes a standalone resume page before
further external-job updates. It builds on the [private library](JOB_LIBRARY_WORKFLOW.md)
and [Drive resume associations](APPLICATION_RESUME_ASSOCIATIONS.md). Seven supplied
screenshots and the matching private Drive Word file define nine regions.

### Current package

The website edits, saves and exports one reusable base resume in DOCX or PDF.
Name/contact are fixed; the headline, section headings and remaining content are
editable. This is an explicitly authorized scoped website operation. No external
model, mail scan, scheduler change, application mutation or Drive write is performed.
Private templates and rendered QA files remain outside Git.

### Downstream enablement

The reusable base resume enables the next increment: named per-job variants and
JD comparisons, after continued user layout review. Export does not prove
submission; association evidence stays separate.

### Short-term benefits

The base resume is now persisted in the production Workspace database and can be
edited independently of the local development server. Local verification covers
stale-write rejection, fixed identity, safe links and project expansion; cloud
checks cover real save, preview and downloads. Source text and opaque template
parts are retained, with the user-requested spacing corrections below.

### Long-term benefits

Structured fields and a retained template provide consistent inputs and layout for
future variants. Named copies, revision restoration and automated tailoring remain
separate future increments. The version counter is not a selectable revision history.

## User interface

Route: `/workspace/job-search/resume`; navigation label: Resume.

| Region | Fields |
| --- | --- |
| 1 | Fixed name, enforced by the service |
| 2 | Editable headline |
| 3 | Fixed contact; original contact links retained in exports |
| 4 | Summary heading and text |
| 5 | Skills heading and six combined text areas (`Group name: content`); name automatically bold in preview/export, blank groups omitted |
| 6 | Section heading; three default projects, expandable to five; separate name, GitHub URL, Demo URL, link label and bullets |
| 7 | Experience heading; title/company, location, dates, overview and bullets per position |
| 8 | Certification heading and bullet list |
| 9 | Education heading; school, location, degree, dates and detail per entry |

Save is explicit. Unsaved input survives returning to the tab and request failures;
leaving with changes triggers the browser's native warning. Export is disabled until
changes are saved and checks the expected saved version. The sixth skill is blank
because the supplied template contains five groups. No factual skills are invented.

## Storage, authorization and initialization

Migration `016_resume_editor.sql` adds only `resume_documents`, keyed by workspace:
private DOCX BLOB, SHA-256, source URL, structured content, version, updating principal
and timestamp. Existing business tables are not rewritten; normal DB backups include
the resume. Synthetic fixtures contain no private resume content.

`GET /api/v1/job-search/resume` requires current session membership. Scoped POSTs to
`/resume` and `/resume/export` require same origin and session CSRF even with general
writes OFF. Export revalidates identity and saved version after conversion. One
export runs per web app process, with timeouts and temporary-file cleanup. Project
HTTP(S) URLs become hyperlinks; export never fetches those URLs.

Initialize once using the existing configured identity and private source file:

```sh
node dist/scripts/import-resume-template.js /private/reference.docx https://docs.google.com/document/d/FILE_ID/edit
```

The importer refuses to overwrite an initialized resume. It validates the reviewed
template's section markers and structure; arbitrary Word templates are unsupported.

## Export and rendering

The source controls A4 geometry, Arial fonts, margins, lists, rules, headers/footers
and page numbers. Only edited body slots and added project hyperlink relationships
change; all other package parts remain byte-identical. Default exports also apply
the approved leading-spacing correction below. Added projects clone source roles. Edited position/education
columns use right tabs at the original text width; project headings stay with their
first bullet. Content grows across pages without shortening or font shrinking.

Production PDF uses Python 3 and LibreOffice Writer with Liberation font fallback
and a per-export profile under a 128 MiB `/tmp` tmpfs. Font substitution can affect
line breaks. PDF conversion materializes collapsed margins between contiguous
imported list items and uses explicit right tabs for education columns, avoiding
overflow from the original runs of spaces. DOCX retains the approved Word layout.
See the [official PDF CLI filter documentation](https://help.libreoffice.org/latest/en-US/text/shared/guide/pdf_params.html).
Optional Windows QA uses installed Word with `PAW_RESUME_WORD_PDF=true`.
`PAW_RESUME_PYTHON` and `PAW_RESUME_SOFFICE` select trusted operator executables,
never request-supplied commands.

## Local verification history and original release gates

- Final local suite: 388 tests / 50 files, type checks and build passed in an
  isolated LF-normalized copy after the editable-heading and migration checks.
- Initial private baseline: two pages, every page inspected; before the subsequent
  user-requested spacing correction, unchanged DOCX bytes matched the source.
  Expanded five-project/six-skill sample: three pages, all inspected after fixing
  title link styling and orphan headings. Fixed headers and opaque template parts
  retain the original content and structure.
- Browser preview: save/reload, 3-to-5 project expansion and bound, remove extras,
  DOCX and PDF downloads passed. Test edits restored. Real authentication and CSRF
  are tested separately through the actual web transport with synthetic identities.
- Cloud image build, Linux PDF/font comparison, backup-copy recovery rehearsal,
  production migration, private initialization and live readback remain required
  before claiming this feature is live. Use `--resume-editor-upgrade` in the existing
  rehearsal and `verify-resume-migration.js`. Verify retained data before the
  separately authorized private initialization.
- Daily tasks and external matching OFF are retained. No production change,
  Git commit or GitHub push is claimed by this local package.

### User spacing correction — 2026-09-09

Jun requests AI Radar's title-to-body gap to match GLAP, and Program Manager / IT
Consultant leading body gaps to match Operations & Data Analyst. These three first
body paragraphs inherited HTML-style automatic paragraph-before spacing. Export
now overrides only their `before` and `beforeAutospacing` to zero, preserving
trailing space between positions, line height, text, lists and hyperlinks. This
applies to default and edited exports and supersedes the original no-edit byte-copy
rule for affected templates. It supports continued layout review without manual
Word cleanup each time. The private source remains unchanged.

Verification: three Python export tests and build passed. Real default export
changes only document.xml body paragraphs 19, 37 and 48; all text and other package
parts are preserved. Both rendered Word pages were inspected, remain two pages,
and show the requested tight leading gaps with separate positions retained.
The local export helper is rebuilt; production release status is unchanged.

### Preview and overview spacing follow-up — 2026-09-09

Jun requests a little space after the Program Manager overview and a Preview button
below the original-template link. The overview-to-first-bullet gap is now 3pt
(60 twips), superseding the zero gap for paragraph 37 above. Edited experience
blocks apply this only when an overview exists; later bullets and positions without
an overview keep the tight spacing. AI Radar and IT Consultant retain zero leading
automatic spacing.

The Preview dialog shows the same generated PDF layout used by export, with zoom
and page navigation. It accepts the current unsaved form without persisting it;
Continue Editing closes the dialog and retains the draft. Explicit Save and Export
buttons save the current draft before exporting Word or PDF. Failed preview/export
keeps input; preview object URLs are released when the dialog closes.

`POST /resume/preview` shares the scoped CSRF/origin, fixed identity, version check,
conversion limit and post-conversion session validation of export. It returns an
inline PDF and performs no resume write. Only the resume page adds `frame-src blob:`
to its CSP for this local PDF viewer; other pages keep their existing restrictions.

Validation: 42 relevant integration tests (including Python template checks), type
checks and build passed. Tests cover unsaved preview without persistence, fixed
identity, stale versions, CSRF denial and page-scoped frame policy. Both pages of
the real Word render were inspected and remain two pages. The browser PDF dialog
renders under that CSP with the requested button placement; production is unchanged.
Browser follow-through also passed: an unsaved headline appeared in preview while
database version 1 and stored content remained unchanged; Continue Editing retained
the draft. Test content was restored, and Save and Export Word completed from the
dialog without changing the stored baseline version.

### Combined skill input — 2026-09-09

Jun requests one text area per skill group instead of separate name/content fields.
The editor joins existing fields as `Group name: content`. On edits it splits only
the first ASCII or full-width colon; the remainder, including further colons and
newlines, remains body text. An entry without a colon is plain body text; blank
entries remain omitted. Untouched values retain their existing split fields exactly.
Persistence and the export contract still store a separate name and body, so preview
and Word/PDF export automatically bold the group name and use regular body text.
This reduces editing steps without a migration or changes to other resume regions.

Validation: type checks and build passed. Browser inspection confirms six combined
inputs and PDF preview accepts a full-width separator. A generated DOCX confirms
bold name, regular body, and retained body colon for `Preview Skill: Python: FastAPI`.

## Production deployment — 2026-09-10 Sydney / 2026-09-09 UTC

Jun accepted the local editor and explicitly requested AWS deployment. The live
page is [Resume Studio](https://workspace.ai-radar-lab.com/workspace/job-search/resume).
The final release is `resume-editor-20260909-r3`, activated at
`2026-09-09T14:13:34Z` (September 10, 00:13:34 Sydney).

### Persistence and recovery evidence

- Existing Lightsail `paw-mvp`, Sydney region; SQLite remains at
  `/srv/paw/data/workspace.db` on persistent storage. No new AWS resource was added.
- Pre-migration backup `workspace-20260909T135435Z.db` passed integrity checks.
  `rehearse-database-copy.sh --resume-editor-upgrade` verified candidate startup,
  repeat startup and previous-library startup against the upgraded copy.
  Migration 016 preserved all 41 original business tables and added only the
  resume table and migration ledger row. Production migration verification passed.
- Private reviewed template was initialized once, with three projects and six skill
  slots, as resume version 1. It was copied through stdin into container `/tmp`;
  the root filesystem remains read-only. Normal database backups include the
  template and structured resume. The original Drive document was not modified.
- Backup before final r3 switch: `workspace-20260909T141325Z.db`, integrity OK.
  Final switch preserved all 43 tables and 1,645 rows. Logical fingerprint before
  and after was identical:
  `16d47a5f15a84f177258e42488bf831bb919583921332ab65acf3ca5d9beda5bb`.
- Initial r1 initialization hit the read-only filesystem with `docker cp`; the
  rollback trap restored the healthy previous library release. The corrected stdin
  method passed. Final rollback target is `resume-editor-20260909-r2`; earlier
  editor and library images remain available. No data rollback was necessary.

### Runtime and layout evidence

- Local full suite before Linux-specific export adjustments: 389 tests / 50 files,
  type checks and build passed in an isolated LF-normalized copy. After list-margin
  adjustment: type checks, build and three targeted tests in two files passed.
  After education-column adjustment: build and the export integration test passed,
  including all five Python template regressions. The subsequent source handoff
  below also ran the full suite against the final changes.
- Both cloud-specific adjustments affect only LibreOffice PDF conversion input:
  contiguous imported list margins collapse; education columns use right tabs
  instead of long space sequences. Word download package contents remain identical
  to the locally accepted baseline. The Program Manager overview retains its 3pt gap.
- Final image built successfully; isolated no-network DOCX/PDF conversion passed.
  Container and database health passed. All five external website release checks
  passed after final cutover: signed-out boundary, public route isolation, write
  mode boundary, OAuth start contract and unsafe return rejection.
- Final cleanup removed the private template/content transfer directory and its
  temporary upload copies. Service readback remained healthy, `OOM=false` and
  read-only root filesystem enabled. The temporary narrow SSH rule used during
  connection troubleshooting was removed; the original firewall was restored.
- Actual authenticated browser verification passed: nine-region editor and six
  combined skill inputs, save/readback version 1, PDF preview, Continue Editing,
  Word/PDF downloads and preview's Save and Export Word action. No test content
  was introduced into the production resume.
- Final downloaded PDF is two A4 pages, 55,341 bytes. Both pages were rendered and
  visually inspected: complete text, bold skill labels, project links, consistent
  list spacing, overview gap, intact right-aligned education dates, and page numbers.
  Cloud font fallback can still produce different line breaks from Microsoft Word;
  pixel-identical rendering across platforms is not claimed.

### Release traceability and next step

Source is `/opt/paw-resume-editor-20260909-r3`. All 149 runtime/source files were
verified against the LF-normalized local manifest before image build. Build log and
manifest are retained in `/srv/paw/deployments/` under the same release tag;
`active-image-tag` records r3. This deployment used reviewed local source overlays
over the existing library release; no Git commit or push was performed during the
rollout itself. The later source handoff is recorded below.

The user can now maintain and export the base resume on the live website without
the local server. The next product increment is named per-job variants and JD
comparison using this saved baseline; external-job updates remain a later priority.
Export is preparation, not evidence of application submission. Existing applications,
mail state, scheduled-task configuration and external matching OFF were retained.
This deployment does not independently validate daily scheduled execution.

## Source and documentation handoff — 2026-09-10

Jun requested the day's documentation update and commit/push to GitHub `main`.
This package captures the deployed resume editor, migration, export helpers,
regressions and production evidence together. Private templates, downloaded
resumes, databases, credentials and visual-QA artifacts remain outside the source
commit. Runtime files were rechecked against the deployed 149-file manifest.

Final verification against an updated LF-normalized source copy passed: both
type-check configurations, all 389 tests in 50 files (including five Python
template checks), and the production build. LF normalization matches the cloud
source and avoids Windows checkout line-ending differences in fixture checks.

The [core workflow](CORE_JOB_WORKFLOW.md#storage-and-analysis-responsibilities-clarified--2026-09-10)
now distinguishes Lightsail SQLite storage, GPT/MCP analysis, backend document
rendering, and the existing manual-mail OpenAI API call. The earlier blanket
conversation claim of no backend OpenAI API use is corrected; only resume
rendering is model-free, and optional external job matching remains disabled.
No runtime configuration or scheduled task was changed by this handoff.

The saved baseline and reproducible source make continued online resume editing
available now and prepare the next increment: named per-job variants/JD comparison.
Revision restoration and external-job expansion remain future work.

## Uniform export spacing follow-up — 2026-09-10

### Continuity and benefits

Jun's screenshots of saved resume version 2 show inconsistent project line heights
and doubled gaps after adding a fourth project. This follow-up corrects the existing
export helper, so the retained template and all edited project/job slots use the
same readable spacing. It enables reliable preview/export of the current base
resume before the later per-job variants increment. The immediate benefit is
consistent spacing without rewriting any resume text; the durable benefit is that
reordering or adding projects no longer changes typography through slot inheritance.

### Correction and scoped evidence

The template mixes imported HTML automatic margins, 1.15/1.02 line spacing,
justified body paragraphs and full-height empty paragraphs. The exporter also
appended a separator after the final project/job while retaining the template's
existing final separator. Word and LibreOffice interpreted this combination
differently.

The helper now sets project/job body paragraphs to left alignment, single line
spacing and zero automatic margins. Project and job separators use one explicit
6pt gap; final duplicate separators are omitted. The Program Manager overview
retains its 3pt leading gap. Font family/sizes, real list definitions, source text,
links, template ZIP parts outside document XML/edited relationships, and saved
business data remain intact. Both Word and PDF input use these spacing rules.

Validation covers unchanged templates and edited three-, four- and five-project
exports in both modes, content retention, fixed identity, hyperlinks and other ZIP
parts. Four Python regressions and the two directly affected integration files
(three Vitest tests) passed. The final Python checks were repeated only after a
test expansion. Existing unrelated release evidence is retained; no application,
mail, persistence or frontend behavior changed. `git diff --check` passed.

A read-only copy of the user's current four-project version 2 was exported using
the corrected helper and rendered by installed Microsoft Word. Both resulting
pages were visually inspected: consistent body lines and compact, single project/
job gaps, with all four projects on page 1. This is local Word evidence; the cloud
LibreOffice result must be inspected separately. Preview content and version 2
were not saved or modified during QA. Private content and QA artifacts remain
outside Git.

### Production acceptance

Deployed as `resume-spacing-20260910-r1` at `2026-09-10T02:03:35Z` (12:03 Sydney),
after the user restored the expired AWS browser session. The single-helper overlay
uses `today-jobs-20260910-r1` as its verified baseline; all 149 runtime files were
checked against the final manifest. Unaffected results from the accepted full
release were reused, and only the changed export checks were repeated.

- Helper SHA-256: `c1d6d8050c2bde6055cc37ac40d8a0e834df68c52a306029064e526848c0f2f8`.
  Image: `sha256:04beb43eb5e4ab2d2f4be493c7df72b52e1630d352ff0a90973881a4d636e2fa`.
- Cloud build and isolated, network-disabled PDF conversion of the read-only real
  resume succeeded before cutover. Version 2 produced a valid 54,650-byte PDF.
- Backup `workspace-20260910T020308Z.db` passed integrity checks. Both new and
  previous images passed isolated backup-copy recovery. All 43 tables/1,753 rows
  retained an identical logical fingerprint across cutover:
  `91e5bc4fd4fbcec0453d15f30a414d630657ce1686fb57e2111edd17be216e7e`.
- Container/database health and all five public web release checks passed.
  Logs and manifest are retained under `/srv/paw/deployments/resume-spacing-20260910-r1-*`.
- Authenticated live export downloaded the actual 54,650-byte PDF and 32,089-byte
  Word document. Both PDF pages were rasterized and visually inspected: four
  projects fit on page 1, consistent line heights, single compact separators,
  complete experience/education and page numbers. The page retained version 2;
  no save or content edit occurred. A fresh PDF preview was opened for the user.
- Temporary private source upload was deleted by exact object version; readback
  found no remaining versions or delete markers. No firewall changes, synthetic
  records, migrations or model configuration changes were made.

This closes the current export-spacing defect. Named per-job resume variants remain
the next product increment; this correction preserves the user's base content.

## Reference-led spacing correction — 2026-09-10

### Continuity and benefits

Jun supplied `Jun_Xiong_AI_Enablement_Builder(AI)_Nuix_Resume.pdf` as the desired
layout and rejected the compact `Resume-v2.pdf`. The reference supersedes the
previous goal of fitting four projects on page 1. This increment restores the
reference's readable paragraph rhythm while retaining source content, consistent
rendering and protection against stacked empty paragraphs. It completes the base
resume layout before later per-job variants. Its immediate benefit is readable
separation of projects and jobs; the longer-term benefit is a measured visual
reference rather than repeated subjective spacing guesses.

Both PDFs were rasterized and inspected. The matching local Word source of the
Nuix reference was inspected read-only to confirm its actual spacing. Body font
size remains approximately 10pt; project/job baseline gaps in the reference are
about 25.5pt, compared with 17.5pt in the compact export. The separator is restored
from 6pt to 14pt; project headings use the reference's 1.15 leading, while project
body slots retain the measured single/1.15/1.02 leading. Automatic margins remain
explicitly disabled, and no duplicate final separator is added. Paragraphs stay
intact across pages so a project heading cannot precede only half its first bullet.

Local Word output was inspected on both pages using exactly four populated
projects (excluding the hidden blank editor template from QA input). It now places
GLAP on page 2, like the reference, with job-heading baselines within approximately
3.3pt of the supplied layout. All source text, font sizes, hyperlinks and saved
resume data are retained. The focused export integration test and its four Python
regressions passed. Unchanged runtime/type/build test evidence is reused; this
single-helper follow-up does not rerun unrelated suites.

### Production acceptance

Deployed as `resume-reference-20260910-r1` at `2026-09-10T02:16:55Z` (12:16 Sydney),
superseding the compact spacing release. The previous source and the final 149-file
manifest passed verification; only the export helper changed at runtime.

- Helper SHA-256: `9adb9a09d5853e2c46dd49e8b775da2d4ad0fd9fd9c1a33f4078972c7f986bac`.
  Image ID: `sha256:53d864020c3645e646b8cdf9b6cdf09470c5e22ac77f704636474f9cf2c5fa9b`.
- Backup `workspace-20260910T021628Z.db` passed integrity checks; candidate and
  previous image recovery copies both passed. All 43 tables/1,753 rows retained
  the identical live fingerprint:
  `91e5bc4fd4fbcec0453d15f30a414d630657ce1686fb57e2111edd17be216e7e`.
- Build, container/database health and all five public web release checks passed.
  The existing release log/manifest convention is retained under
  `/srv/paw/deployments/resume-reference-20260910-r1-*`.
- Authenticated actual PDF download is 54,805 bytes and two pages. Both pages were
  rasterized and compared visually with the supplied PDF. Three projects remain
  on page 1; GLAP starts on page 2 with its first bullet intact. Project/job gaps
  and title leading follow the more spacious reference. Word export and a fresh
  PDF preview also completed. The saved resume remains version 2; no save occurred.

## Section and item ordering — 2026-09-10

### Gutter navigation correction — 2026-09-10

**Continuity and benefits:** Jun clarified the red-marked location: navigation
belongs immediately beside the resume cards, in the gutter after the app sidebar.
This supersedes the sidebar placement below. Nine sticky ticks now show the active
region; hover or keyboard focus reveals its Area number and full name, and native
anchors jump to the region. The Preview button remains at the right of the save
toolbar. This makes long-document navigation compact while retaining stable
section identities for the next, separate named per-job resume increment. No
resume content, storage contract, export spacing or authorization changes apply.

Both type checks, three editor tests and build passed. Desktop and 390px layouts,
click navigation, active highlighting, and Tab/Enter navigation were checked in
the temporary in-memory preview. The work-experience jump aligned its heading at
y=110 below the toolbar. Unchanged ordering/export and full-suite evidence above
is reused; no new full-suite run was needed for these four UI files.

Deployed `resume-rail-20260910-r1` at `2026-09-10T04:56:34Z` (14:56 Sydney).
All 149 manifest inputs matched; four UI files changed. Image:
`sha256:6e2f1ff147500ae01fa02a4f2d4a58e47158c56893494b55a3425db1ee3ff56c`.
Source and release logs remain under `/opt/paw-resume-rail-20260910-r1` and
`/srv/paw/deployments/resume-rail-20260910-r1-*`.
Backup `workspace-20260910T045607Z.db`, both image recovery rehearsals, health and
five public checks passed. Before/after logical fingerprints matched:
`f3f15915d76c751693036f74db4024cb8b08e033d8956b41e57ae93a66db3864`,
43 tables / 1,753 rows. Live acceptance confirmed nine gutter links, no sidebar
Area links, the saved experience-before-projects order, and correct active-region
jumps. Version 5 and all 86 editor fields matched the pre-cutover baseline;
the saved live PDF preview also completed successfully. No live save occurred.
The private transfer object version was deleted and its
absence verified.

### Toolbar and sidebar follow-up — 2026-09-10

Historical placement, superseded by the gutter correction above.

**Continuity and benefits:** Jun accepted the ordering behavior and requested
Preview beside the save controls, at the far right, plus leftmost Area navigation.
This follow-up moves the existing preview button into the sticky save toolbar
and places all nine full region names in the left sidebar. Region moves update the
Area numbers and link order. The navigation can collapse and uses two columns on
narrow screens. This makes preview reachable while editing a long document and
supports faster movement between areas before the separate per-job variants work.
Resume data, export formatting and save behavior are retained.

Both type checks, three resume-editor tests, two scoped resume transport tests and
build passed. A rendered-HTML check confirmed one Preview button, last in the save
toolbar, plus nine sidebar links with valid section targets. Unchanged full-suite
evidence from the ordering release is reused; the full suite was not rerun for
this view-only adjustment. Browser communication later recovered after the user toggled the installed ChatGPT
browser extension off and on. Desktop and actual 390px iframe layouts were visually
inspected. A navigation jump put the section at y=110 below the sticky toolbar
ending at y=77. Moving experience above projects updated the sidebar to Area 6
and retained its correct anchor. The in-memory QA save succeeded. Production
acceptance is recorded below after cutover.

Deployed as `resume-nav-20260910-r1` at `2026-09-10T04:39:59Z` (14:39 Sydney).
All 149 runtime manifest inputs matched the verified source; only four UI files
changed from the ordering release. Image:
`sha256:2eea1b903e80f804ab326789ee6c7dfa156365009a48448deb1a4fa7f519a366`.
Source and logs are retained at `/opt/paw-resume-nav-20260910-r1` and
`/srv/paw/deployments/resume-nav-20260910-r1-*`.

Backup `workspace-20260910T043933Z.db` and both image recovery rehearsals passed.
The before/after logical fingerprint was identical:
`f3f15915d76c751693036f74db4024cb8b08e033d8956b41e57ae93a66db3864`,
43 tables/1,753 rows. Five public checks passed. Authenticated live acceptance
confirmed nine sidebar links reflecting the user's saved order, Preview inside
the save toolbar, correct navigation, and successful saved PDF preview. Version 5
and its complete saved content were identical before and after cutover; no live
save was performed. The temporary in-memory preview was stopped and the private
source-transfer object was deleted by exact version with absence verified.

### Continuity and benefits

Following the reference-led spacing correction above, Jun requested movable major
regions and entries, including Professional Experience before projects. This
increment adds up/down controls for all nine regions and for skills, projects,
experience, certifications and education entries. It makes emphasis adjustable in
the existing base resume and supplies the ordering representation that future
per-job versions can retain. Named per-job versions remain a separate increment;
the fixed name/contact text, content ownership and save concurrency rules remain
in force. The immediate verified benefit is consistent order through save, reload,
preview and export; the expected longer-term benefit is independently tailored
resumes without manually rearranging Word documents.

### Behavior and compatibility

- Optional `sectionOrder` is a permutation of the nine canonical region keys.
  Missing order preserves the established template order. Existing entry arrays
  carry their own order; no SQLite migration is needed.
- Buttons move whole regions or entries. Navigation and numbering follow their
  positions. First/last movement is disabled; unsaved changes retain the existing
  preview/save/export behavior. Certification entries now have separate controls.
- Stable field indices preserve every entry's text and links through repeated
  moves and saves. Skills preserve their original name/content split when untouched.
  An older open editor omitting `sectionOrder` cannot erase an already saved order.
- Export moves complete XML regions after content replacement and retains the
  template's non-document parts, links, page properties and reference spacing.
  Reordering can naturally change pagination.
- Downgrade boundary: the preceding image's strict JSON reader cannot read a
  resume after its first custom section-order save. The cutover rollback target
  is valid for the unchanged pre-save database. After custom-order writes, use a
  forward correction retaining the new reader/exporter; do not restore an old
  database or blindly switch to the preceding image. Backups remain recovery
  evidence, not permission to discard subsequent user edits.

### Verification

- Focused persistence and export tests passed. Six Python cases cover all nine
  regions at the start/end, reverse ordering, invalid permutations, whole-block
  contents, item order, hyperlinks, fixed identity and template preservation for
  both export modes.
- The release verification run passed both type checks and 395 of 396 tests.
  The expanded Python export check completed beyond Vitest's default five-second
  budget under parallel load. Its local timeout now matches its bounded child
  process budget; the focused rerun passed. Those unchanged 395 results were
  reused, giving passing evidence for all 396 tests. Build passed separately.
- Browser QA used a temporary in-memory database: moves in all five lists,
  two successive saves, unchanged save, reload, and certification removal/addition
  preserved the expected content. Desktop and 390px layouts were inspected.
- A private copy of Jun's current four-project content was exported with experience
  before projects. Both Word-rendered PDF pages were inspected: experience is on
  page 1, projects on page 2, with readable spacing and no lost entries.

### Deployment and real-data acceptance

Deployed `resume-order-20260910-r1` at `2026-09-10T02:40:09Z` (12:40 Sydney).
The six changed runtime files overlay the reference release, with all 149 release
manifest inputs checked. Image:
`sha256:dc570c76e057e52348a1d49d30c911b824d45f7950a631f7e8012854ec6b3b1c`.
Source, manifest and logs are retained at `/opt/paw-resume-order-20260910-r1` and
`/srv/paw/deployments/resume-order-20260910-r1-*`.

Backup `workspace-20260910T023942Z.db`, both image recovery rehearsals and the
cutover succeeded. The before/after logical fingerprint matched:
`eb11aa57ac9cac14a64f75e03a5db10b4ff7bf81d7605803682e05d08f7df2d9`,
43 tables and 1,753 rows. Five public checks passed. The temporary encrypted S3
source transfer's exact object version was deleted and its absence verified.

The user had saved version 3 while development was underway; live acceptance used
that current record. A read-only draft preview moved experience before projects
and exchanged the first two projects. Both cloud PDF pages were visually checked:
the regions and project bodies followed the new order with reference spacing.
A fresh page confirmed version 3 and every saved content field remained unchanged.
No live save was performed. The temporary in-memory preview was stopped; no example
records were added to the user's local or cloud database.
- Private source upload was deleted by exact version; readback found no versions
  or delete markers. Original reference files and the earlier comparison PDF were
  not overwritten. Private QA artifacts remain outside Git. No firewall, schema,
  data or model-configuration changes were made.

The reference-led layout is now the accepted implementation target. Pixel-identical
Word/LibreOffice font rendering is not claimed; matched spacing, natural two-page
flow and complete text were verified with the actual cloud output.
