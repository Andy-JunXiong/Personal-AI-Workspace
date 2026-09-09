# Nine-region resume editor

Status: deployed to AWS Lightsail as `resume-editor-20260909-r3` on
2026-09-10 Sydney time (2026-09-09 UTC), with migration 016 and the private
baseline initialized as version 1. Production verification is recorded below.

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
