# Proactive job discovery and interview library

## Continuity and benefits

The [application dossier](APPLICATION_DOSSIER_WORKFLOW.md) preserves material after
submission. Jun's September 9 instruction moves preparation earlier: aggregate
resume variants, projects and interview material, then compare each job and
prepare a tailored resume. His explicit selection permits viewing matches,
saving/ignoring candidates, editing preparation material and following the original
posting to submit. This supersedes the website's reporting-only boundary for these
specific operations; task completion and general application mutations remain gated.

This package provides a private source library, evidence-based comparison, draft
editing/download, and bounded email-alert discovery. It enables preparation before
application and reuse of the same background across jobs. Immediate benefits are
source traceability, stale-result detection and less repeated document selection.
The longer-term foundation is a reusable body of interview and experience evidence;
the library currently stores documents/cases, not an independently verified fact graph.

## Current operating choice

External model matching is disabled by default. The current user selection is to
save library material, candidate postings and JDs only. The server supplies no
comparison provider unless `PAW_JOB_LIBRARY_EXTERNAL_MATCHING=true` is explicitly
configured after user authorization. With it off, alert imports make no model calls,
and candidate details offer Save JD instead of comparison. Existing Gmail
application-status processing is independent of this setting.

## User workflow

1. Open **求职／面试资料库**. Add, search, review or exclude resume versions, project
   descriptions and interview cases. Historical documents start as `SOURCE`;
   explicit user corrections are `CONFIRMED`. Preserve original Drive links.
2. Open **职位**, then sync Job Alerts from connected Gmail accounts. This is an
   email-alert integration, not a native LinkedIn/SEEK account login.
3. Inspect candidates, sorted by current match score by default. Save or ignore.
   Missing JD remains visibly missing; paste the full description on the detail page.
4. Compare the JD with the library. Inspect each requirement, evidence passage,
   source, gap and unresolved conflict. Update facts and rerun when necessary.
5. Edit the selected-source resume draft, save and download Markdown with company
   and role in its filename. Follow the original posting to apply. A candidate or
   prepared draft never becomes an application merely through discovery.

## Evidence and scoring

- Model output must cite exact JD and source substrings. Unsupported citations,
  duplicate requirement labels and unsupported resume passages are rejected.
- Required requirements weigh 3; preferred requirements weigh 1. MATCH earns the
  full weight, PARTIAL half, UNKNOWN zero. Coverage counts requirements with usable
  evidence. These are advisory evidence-based metrics, never hiring probabilities.
- Open conflicts suppress the score. Explicit confirmed corrections supersede only
  their specific historical fact. Positioning headlines are not employment titles.
- All nonexcluded sources are considered within a 600,000-character request bound.
  Whitespace-equivalent source duplicates are suppressed for analysis; originals
  remain stored. Oversized inputs fail explicitly, without silent truncation.
- Library changes invalidate previous fit scores/downloads. Automatic alert refresh
  does not overwrite existing drafts. Explicit reanalysis checks both library and
  draft versions after the provider returns.
- The first generated draft is an evidence selection, not a finished designed PDF.
  Users review factual context and edit before applying. Provider semantic judgement
  still requires review; exact-quote validation alone cannot prove a skill match.

## Integration and authority

Gmail queries are bounded to seven days, LinkedIn/SEEK sender domains and job-alert
subject keywords, with at most ten messages per provider in each mailbox. Sender metadata is checked
before reading targeted bodies for posting URLs. Other mail is not read by this
flow. Listing/body limits and mailbox failures are reported, not treated as full coverage.
HTTP 204 empty list responses are reported separately as unverified coverage;
they neither prove no matching mail nor imply authorization failure.
At most ten postings are handled per run and three previously unassessed jobs with
usable JDs are automatically compared. Further jobs can be compared individually.
New links are prioritized on subsequent imports. Known application posting URLs
are excluded, including closed applications. No alert enters application timelines.

Job-labelled SEEK email tracking links may be resolved through two exact official
tracking hosts, at most twenty links per run. Unsubscribe/preferences links are
excluded. Redirects outside those hosts and canonical posting paths are rejected.
When an official job-labelled tracking link cannot resolve, its title, company and
original alert URL are still saved as an unverified candidate with no posting ID.
This preserves a useful reference without inventing a destination or JD. Exact alert
URLs deduplicate; different unresolved URLs are not assumed to represent the same
posting merely because titles match.
For JD fetches, only canonical HTTPS LinkedIn/SEEK posting paths are allowed; redirects must
retain the same provider and posting identity. Responses are bounded and require
one substantive JSON-LD JobPosting. Login walls, unavailable structured data and
blocked pages produce missing JD, not fabricated matches. Website access is not
guaranteed. Existing daily application-mail automation is unchanged; this discovery
button is not a newly scheduled background subscription.

All browser writes require the mapped Workspace session, same origin and CSRF token.
Routes under `/api/v1/job-search/library` expose only source preparation, candidate
decisions, fit/draft preparation and alert discovery. General web writes stay off.
No email is sent and no application is submitted by this feature.

Migration 015 adds four empty tables and an active-run uniqueness index. The CLI
`import-job-library` imports a separately transferred private JSON artifact with
optimistic versions, one transaction and source-by-source readback. Source documents
and user-specific corrections must never be committed to this public repository.

## Validation and release

Local validation: source ownership, CSRF, stale writes, corrected-fact precedence
instruction, exact citations, blocked-JD behavior, candidate deduplication and
decision preservation, migration preservation/repeated startup, and mobile layout.
The browser check uses a 390px viewport and the real private source inventory.

Production release `library-20260909-r1` went live at 2026-09-09T10:42:53Z.
Source commit: `c1399c2398aa844622e101cc4f86ba6d4e4787d9`. All 381 tests in 48
files, server/browser type checks and production build passed. The 390px browser
check rendered the complete private inventory without page overflow. Private source
import and source-by-source readback passed after deployment.

Image SHA256: `aaaafccfad99e2266cd36c0e261c83129fb64698ee4a56760788d4d2fcd5ce7f`.
Archive SHA256: `f2f0bc0a67ea64f378bfee99c017e6a4dc547ecd923a62584673682335a81e91`.
The backup-copy upgrade preserved all 37 preexisting business tables, added four
empty tables, and passed repeated startup and previous-image startup. Before/after
deployment had 38/42 tables and 1533/1534 rows; the sole added row was migration 015.
Public OAuth, signed-out access, route isolation and task-write-off checks passed.
Initial real alert discovery and external model acceptance are tracked separately
from these deployment and import checks.

Immediate rollback image: `dossier-20260909-r1`. Recovery rehearsal uses
`--job-library-upgrade`, verify all preexisting rows, then test repeated candidate
startup and previous-image startup against the upgraded copy. Import is a separate
authorized data change after deployment preservation verification.

Platform capability references: [LinkedIn API access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)
and [SEEK developer portal](https://developer.seek.com/). Current installed tools
provide no direct consumer LinkedIn/SEEK alert connector; ordinary sign-in is not
evidence of that capability.
