# Application resume associations

## Continuity and benefits

Jun approved using the Google Drive resumes he uploads to find the material for
each application on September 9, 2026. This follows the completed filtered manual
mail gate: a submission-confirmation email establishes the new application;
Drive discovery supplements its dossier. It never creates an application or
changes its lifecycle. GPT operates the connectors, Workspace persists the
association, and the website reports it.

This increment adds durable file/revision associations through the existing
observation tool, with separate candidate, confirmed-file and confirmed-version
labels. It preserves existing JD/skill reports and the original Drive files.
The immediate benefit is finding materials without repeating a Drive-wide search
or losing the association among later emails. It enables grounded JD/resume
comparison and interview preparation using the actual submitted version once
identified. Long-term value is an attributable history of what was used for each
application, including corrections and subsequent file changes.

The interactive GPT/Drive workflow is available through the connected tools.
The saved daily mail task has not been changed to call Drive: unattended Drive
discovery is not implemented or accepted by this release. No new scheduler,
website editing form, Drive mutation, public sharing or new application authority
is introduced. First actual scheduled mail execution remains a separate gate.

## Operator procedure

1. Read the exact existing Workspace application. For new automatic application
   registration, first follow the submission-confirmation rule in
   [the core workflow](CORE_JOB_WORKFLOW.md). A CV filename or recruiter request
   is not confirmation that the user applied.
2. Read `workspace_get_project.resumeAssociations` first. It returns the current
   record for each file/revision even if it is outside the latest ten Resources.
   Reuse prior explicit confirmation; do not repeatedly ask the user or search
   all of Drive for a known file. Respect dismissed candidates.
3. For missing materials, search the user's observed Resume folder by company
   and role in the filename, using metadata before file contents. Prefer precise
   company+role matches. A distinctive role-only match is a candidate with the
   missing company evidence stated. Generic role matches, cover letters and files
   for companies without an application must not be silently associated.
4. Fetch/list Drive revisions for the selected file ID. Preserve the actual ID,
   filename, MIME, observed modification time, revision ID and revision time.
   Unknown fields stay null. A timestamp is not a revision ID. A PDF and DOCX are
   separate files; same basename does not prove equal content or submitted format.
5. Persist a `CANDIDATE` when the filename supplies the association. Current Drive
   contents and timestamps do not prove what was submitted earlier. If the current
   revision postdates the application, say so and retain version uncertainty.
6. If Jun says "this is the resume I submitted for this company/role", save the
   attributable statement and the identified file as `CONFIRMED_FILE`. Use
   `CONFIRMED_VERSION` only when that statement or a submission record identifies
   the exact revision. Merely reading today's revision does not identify the
   historical submitted version. Resolve only the remaining ambiguity.
7. Read back the saved association. For changes, read current state and append a
   new observation superseding its Resource ID. Preserve prior observations.
   A newer revision is a new candidate; it does not replace an older confirmed
   submitted version. Dismiss mistaken associations with a reason.
8. For interview work, retrieve the confirmed revision explicitly. The ordinary
   Drive browser link opens current content. If a saved revision is unavailable,
   report this and do not substitute the current file as if it were historical.

The folder identity is private operational data retained with the live source
links; do not publish personal file IDs or resume content in repository examples.

## Existing-tool contract

No migration or extra MCP tool is required. Use `workspace_record_observation`:

- `resourceType`: `DOCUMENT`; `provider`: `google-drive-resume`.
- `externalId`: a unique observation/event ID, **not just the Drive file ID**.
  Reuse the same event ID and idempotency key when retrying that exact write.
  A later confirmation/correction needs a new event ID and idempotency key.
  The local follow-up below rejects reuse of an event ID with different content
  as `IDEMPOTENCY_CONFLICT`, even with a fresh idempotency key. An identical
  event with a fresh key still returns the saved historical Resource; it does
  not undo a subsequent correction. Read `resumeAssociations` for current state.
- `externalUri`: observed HTTPS Drive file or Docs document URL matching `fileId`.
- `observedAt`: the actual observation time; not the application date.
- `observedFacts` follows the strict schema below; extra fields are rejected.

```json
{
  "contractVersion": "job-application-resume-v0.1",
  "supersedesResourceId": null,
  "sourceFacts": {
    "fileId": "observed-file-id",
    "fileName": "Company Role Resume.pdf",
    "mimeType": "application/pdf",
    "modifiedTime": "2026-09-01T00:00:00Z",
    "revisionId": "observed-drive-revision-id",
    "revisionModifiedTime": "2026-09-01T00:00:00Z"
  },
  "interpretation": {
    "status": "CANDIDATE",
    "reason": "Filename matches company and role; actual submission is unconfirmed."
  },
  "confirmation": null
}
```

Status is `CANDIDATE`, `CONFIRMED_FILE`, `CONFIRMED_VERSION` or `DISMISSED`.
For either confirmation status, `confirmation` must contain `kind`
(`USER_STATEMENT` or `SUBMISSION_RECORD`), `reference` and `statement`, all
attributable to actually observed evidence. Schema validation requires these
fields; it cannot independently prove that an agent's statement is true. GPT
must ground them in the actual user instruction or submission record.
Candidate/dismissal confirmation is null. A confirmed version needs a non-null
revision ID. A correction must provide the current same-file/revision Resource
ID in `supersedesResourceId`; stale writes fail. Discovery cannot downgrade a
confirmed record to a candidate. Dismissal/correction history remains readable.

Original `job-application-profile-v0.1` records are retained and rendered as
legacy resume notes with unspecified confirmation provenance. JD/skill-match
profiles and resume associations do not overwrite one another.

## Validation and release evidence

### Local event-conflict correction — 2026-09-09

**Status:** Implemented and verified locally; not deployed or published.

**Continuity and benefits:** The existing immutable-event and attributable
confirmation contract requires later corrections to use new event IDs. Review
found that a changed payload with an existing `externalId` and a new idempotency
key returned the old Resource as a successful deduplication, silently skipping
the intended confirmation. The service now compares normalized event content
before resume deduplication and rejects conflicting reuse. This preserves exact
retries and append-only correction history, immediately making failed confirmation
writes explicit. It supports trustworthy submitted-material provenance for later
JD comparison and interview preparation. Actual file/version evidence and the
first scheduled mail execution remain separate gates. This is a routine fix
within the existing Workspace domain-state boundary; no new tool, migration,
connector access, deployment, task change or real-data write is included.

The new regression failed before the fix and passes afterward. It covers changed
confirmation/revision/title/time/URL, unchanged current state after rejection,
retry-key reuse after rollback, valid corrections, and replay of an old event
without reverting the current association. Full verification also exposed a
pre-existing web-mail fixture dated September 7 falling outside the normal
24-hour window; it now captures a recent timestamp once per fixture, preserving
source identity across retries. `npm.cmd run verify` passed server/browser type
checks, **368 tests in 44 files**, and the production build. Locked dependencies
were restored locally with `npm ci`; the manifest and lockfile are unchanged.
The deployed release evidence below still describes `resume-20260909-r2`.

Local type checking/build and the full LF-normalized release-copy suite passed:
367 tests in 44 files. Four new integration scenarios cover candidate vs actual
submission, revision identity and unsafe/mismatched URLs, idempotency and stale
corrections, preservation of confirmed older versions, bounded-history recovery,
read-only rendering, existing dossier/lifecycle preservation and Workspace isolation.

Production r1 was deployed on September 9 at approximately 14:53 Sydney. All 125
runtime source files matched the LF-normalized local manifest. Image
`paw:resume-20260909-r1` has SHA-256
`f64a5695ae3daac955b13d02e14ef4d01fc2bc5e6455ffb847aab71ecbdbe47c`.
Backup `workspace-20260909T045053Z.db` passed integrity/migrations 001–014.
Isolated current/previous-image starts both preserved 38 tables / 1,391 rows.
The live pre/post-cutover fingerprints were identical:
`620008623e4d658ac45e248023b233910c96981a99f2f01f9354a4d221dbf1c8`.
The active image became healthy and the public web release check passed with
general browser writes off. Existing job-mail functionality and migration 014
are retained; no new migration or MCP tool was introduced.

The actual connected Drive search found the user's Resume folder. Selected
metadata and revision lists supplied 16 candidate files across nine existing
applications: DoorDash, Amazon BIE, Slalom, RSM, Wake in Cloud, University of
Sydney, Suncorp, UST and Canva. Seven are PDF/Word pairs; two are Word-only
candidates in the selected folder. Role-only candidates explicitly state missing
company evidence. Two current Word revisions postdate the application date;
their reason states that limitation. No file contents were read or copied.

All 16 were saved through `workspace_record_observation` as DOCUMENT Resources,
then independently read back through `workspace_get_project.resumeAssociations`.
All file/revision IDs matched; all statuses are CANDIDATE. Each of the nine
projects, transitions and open-task arrays exactly matched its before snapshot.
Resources increased by 16 total. No application, lifecycle change, task, JD or
skill report was created from filename evidence. This is a bounded initial
association pass, not a claim that every application has its submitted CV.

The authenticated RSM website displayed both file links and candidate labels;
the expanded details displayed the saved Drive revision and revision timestamp.
Drive links open current content, as labeled. Actual submission confirmation was
exercised synthetically only; no live confirmation was fabricated. The saved
daily mail prompt and both task settings were not touched.

A CSS-only follow-up adds spacing and wrapping for long filenames/revision IDs.
The final healthy active release is `paw:resume-20260909-r2`, source directory
`/opt/paw-resume-20260909-r2`, image SHA-256
`35b5b8b0ec361525f900823b05412734d290ba8dd3e79cb3be756136882499fd`.
All 125 runtime source checks and the Docker build passed; business code is the
same code covered by the 367-test run. A fresh backup includes the newly saved
candidate records. Live pre/post-r2 fingerprints were identical, 38 tables /
1,423 rows, SHA-256
`e4d2dd659985ae2f502be1b32adcd965fa488ec81abc2a4145a70596fd735efd`.
The public web release check again passed with general browser writes off.
After r2, MCP still returned both RSM candidate records and an authenticated
page read again matched them. Expanded details, screenshot and DOM-backed styles
confirmed the version display, 8px spacing and `overflow-wrap: anywhere`.
This is desktop-browser verification, not a physical-phone acceptance claim.
The retained r1 image is the immediate rollback; the job-mail image also remains
available. The user subsequently requested end-of-day documentation and publication
of today's accumulated changes to GitHub main. Publication is separate from the
deployment evidence above; verify the resulting commit against remote main.
Private build, source-check, backup, rehearsal, fingerprint and public-web-check
artifacts are under `/srv/paw/deployments/resume-20260909-r1-*` (and r2 successors).
