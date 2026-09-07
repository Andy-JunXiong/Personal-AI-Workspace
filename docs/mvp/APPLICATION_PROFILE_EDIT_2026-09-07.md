# Recent applications and GPT-written dossiers

Status: deployed with `scan-receipts-20260907192417`; read-only cloud rendering and default latest-application ordering verified.

## Continuity and benefits

- Upstream: recent-first application ordering and complete job dossiers, followed
  by the user's authoritative clarification that GPT performs operations and
  the website principally reports from the same Workspace database.
- Current: APPLIED_DESC default (unknown dates last), display of GPT-saved JD,
  original fit text, resume version/text and source reference, and readable
  profile snapshots in Evidence. The newly proposed web editor and its POST
  endpoint were removed before deployment.
- Downstream: save confirmed source material through GPT's existing
  workspace_record_observation tool, deploy the read-only presentation, and
  verify browser readback. Daily scheduled-task acceptance is separate.
- Short-term verified benefit: later metadata edits do not reorder applications
  by default; GPT-written source content and versions are visible without
  maintaining another editing workflow.
- Long-term expected benefit: one durable job dossier supports reporting,
  interview preparation and future GPT conversations.

## Delivered contract and verification

Optional additions to job-application-profile-v0.1 are resumeVersion,
resumeText, skillMatchText and sourceReference. Existing jobDescription and
structured skillMatch remain backward compatible. GPT writes complete NOTE
snapshots with the actual source provider and exact application ID. It must
retain existing fields when saving a replacement snapshot and must not invent
missing analysis or submitted resume versions.

The website reads the latest inserted profile and displays prior versions in
Evidence. There is no browser profile form, profile save service, or profile
POST endpoint. The focused transport test proves GPT-style observation writes
are rendered and that subsequent web reads and attempts to use the removed
profile endpoint do not mutate the database. Existing text is HTML-escaped.

Full verification after the core-flow correction: 30 files / 248 tests pass,
typecheck passes, production build passes. The pagination tie-order test now
explicitly selects UPDATED_DESC to retain its original coverage; separate tests
verify the new default date ordering.

## Source audit and remaining gates

The earlier cloud audit found no attached JD/fit profiles, not proof that the
analysis never occurred in old ChatGPT conversations. Local company-specific
resume filenames exist, but have not been confirmed as the submitted versions.
No real profile content was imported or fabricated. Historical source content
backfill and user browser acceptance remain pending.

See [the core workflow](../architecture/CORE_JOB_WORKFLOW.md) for the authoritative
product boundary and scheduled-run verification gaps. The earlier proposed
editable dossier was superseded; it was never deployed by this package.
