# Application calendar and ongoing default — 2026-09-09

**September 11 follow-up:** the user approved showing existing application
confirmation emails when a submission date is missing. See the follow-up below;
the original September 9 gate and release evidence retain their historical scope.

## Continuity and benefits

### September 11 application-list follow-up

The user reported that today's applications were missing from the list below the
calendar. The list defaulted to submission-date order, pushing undated new
applications to the end; its update sort ignored newly stored email evidence.
The Web list now defaults to `UPDATED_DESC`, ordered by the later of project
update time and the latest linked EMAIL Resource's recording time, with project
ID as a deterministic tie-breaker. Each row shows that recent-update timestamp
separately from its unchanged application date. NOTE check receipts, including
no-update checks, do not promote a row. Explicit date/company/task sorting remains
available. This makes actual saved updates discoverable and supports continued
follow-up without fabricating submission dates or changing calendar, lifecycle,
Task or persistence rules. Local sorting/pagination/default-rendering regression
passed. This unblocks the user's current list check; it does not claim additional
applications or change the distinction between recording and submission dates.

Released as `application-list-20260911-r1` at `2026-09-11T06:34:33Z` (16:34 Sydney),
runtime source `ce9668bd9df1d9462af3f45cf06e1822345dbc08`, [PR 25](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/25).
Both type checks, **426 tests / 56 files**, build, pinned Skill packaging and
[runtime-source CI](https://github.com/Andy-JunXiong/Personal-AI-Workspace/actions/runs/34570327082)
passed. Desktop 1440px and narrow 390px synthetic rendered checks showed the
selected update sort and readable timestamp rows without horizontal overflow.
Sandbox Chrome closed before rendering; the same headless check outside the
sandbox passed. No application change was required for that environment issue.

Backup-copy candidate/previous-image recovery passed; schema remains 018. Fresh
cutover backup `workspace-20260911T063423Z.db` passed integrity. Before/after logical
fingerprints matched `209a426859d130302de7f6fad7a1922dffbf436e1ee5dc24053b0b67e1722c7c`
across 47 tables / 1,971 rows. All five public checks and health passed. Source
archive SHA-256: `822dbfb7e9eaec2ab53c4f5a1e3d1fdd138e8c1419aed099bcfc58bc6665e5a0`;
image `sha256:6eaec20e73471507d36f449890d5331e7882d15a7221dcab1de173b88221b720`.
Rollback target is `application-preparation-20260911-r1`. Temporary operator-IP
access was restored after remote checks.

Read-only production service/view execution verified 13 ongoing applications,
with **One51, Nuix, Coates** first in that order. Their displayed recent-update
times are September 11 10:22, 08:00 and 07:59 Sydney respectively. Calendar totals
remain August 11 / September 4. This check rendered from the live database through
the deployed view function; it did not claim an authenticated browser-session
readback. Existing URLs with explicit `sort=APPLIED_DESC` retain that choice; a
fresh My Applications navigation uses the new default. User-visible acceptance
after reopening remains separate from the read-only production check.

The user requested that My Applications default to ongoing applications, hide
rejections, and show submission counts for the previous and current month above
mail updates. This follows the [ongoing-only mail correction](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#ongoing-only-keyword-follow-up--2026-09-09)
and the [core workflow](../architecture/CORE_JOB_WORKFLOW.md).

The website now focuses its list on active APPLIED, RECRUITER_CONTACT,
INTERVIEWING and OFFER applications. Explicit All, Closed and Open (including
paused) filters remain available. Existing API OPEN semantics are preserved.
The new ONGOING filter participates in pagination cursor identity.

Two calendar months show daily counts, monthly totals and days with submissions.
Native expandable date cells link to that day's applications. The calendar is
independent of list filters, pagination and present lifecycle: a rejection does
not erase historical activity. Only valid recorded appliedDate values count;
missing dates are disclosed without substituting creation timestamps. Months
and today's outline use the configured workspace timezone and handle year rollover.

This enables users to review submission cadence and then open a day's jobs,
while keeping current follow-up focused. The durable benefit is a historical
view grounded in the same application records. No mail scans, lifecycle writes,
new external service, database migration or infrastructure is introduced.
Production rendering and user acceptance are separate from local verification.

## Confirmation-date display — September 11

The user found Nuix and Coates in today's updates but absent from the calendar.
Live reads confirmed both applications were APPLIED with `appliedDate: null`;
their matching confirmation emails arrived September 10, while registration was
September 11. This follow-up composes a read-only date projection from those
existing records, enabling visible activity without inventing submission dates.
It supports the roadmap's next preparation-context package by retaining the
distinction between a fact, its source and its interpretation.

- Valid recorded submission dates take priority. Otherwise the earliest matching
  application-confirmation email's received timestamp is converted to the Workspace
  timezone. Registration/scan timestamps never substitute for submission dates.
- Existing milestone classification is reused, with legacy English
  `confirmed/acknowledged receipt of the application` recognition added.
  Company and role must match. Explicit unrelated categories, recruitment
  marketing, interviews, offers and rejections are not confirmation fallbacks.
- Each application appears once. Date cells label the fallback
  **确认邮件，投递日期待确认**; totals describe applications rather than asserting
  that every included date is a known submission date.
- No metadata, lifecycle, Task or evidence is rewritten. The confirmation Resource
  ID is retained in the query projection for provenance.

Local verification: the new calendar regression exercises earliest receipt,
Sydney date rollover, recorded-date priority, unrelated/wrong-role exclusions,
non-confirmation milestones and zero writes. Calendar, timeline and library
checks passed, followed by the actual release gate: **420 tests / 54 files**,
both TypeScript checks and build. Source: `696e692`.

Production `calendar-library-20260911-r1` became healthy at
`2026-09-11T00:32:57Z` (10:32 Sydney), retaining migration 018. Consistent backup,
candidate/previous-image recovery rehearsal and matching cutover fingerprints
passed: 47 tables, 1,971 rows. All five public boundary checks passed. The private
temporary source-transfer object was removed by exact object version.

Authenticated UI acceptance confirmed September 10 expands to Nuix and Coates,
each with the confirmation-date label; September totals are four applications
across two dates, and three applications remain without a usable date. Desktop
inspection verified the expanded popover and both links/labels. The companion
library correction displays 37 sources: 36 distinct Word bodies and one confirmed
fact correction, zero PDF entries. Two same-title/different-content pairs show
variant labels. The original library form values were checked unchanged before
refresh; no real application/library content was edited for acceptance.

The source archive SHA-256 is
`f2c1b93c579e402900bcfa26f7cf6724a7172a33084479f036a4a0d794ffe9e7`.
Backup/rehearsal and cutover logs are retained privately in
`/srv/paw/deployments/` under the release prefix. Rollback image is
`resume-variants-20260911-r2`. No new scheduled-run or mobile viewport acceptance
is claimed by this follow-up.

## Validation and release

- Local: 371 tests across 45 files, server/browser type checking and build passed.
- Regression coverage: ongoing default, explicit All and pagination, closed and
  paused exclusion, independent historical counts, timezone/year/leap boundaries,
  missing dates, workspace isolation, HTML escaping and read-only rendering.
- Deployed `calendar-20260909-r1` at 2026-09-09 06:57:49 UTC (16:57 Sydney),
  source commit `256bdf93e410284efc4412c3571e637c79efcfdd`, pushed to main.
- Exact source archive SHA-256:
  `cab7493e9979678783d13949c1c3aa0ef9c7ee35516b4bb2e139c908266f6d75`.
- Image SHA-256:
  `3f5706326c07aa8c1aac8a2f0ab8a7202077c331f98fa2f5b86c88c55468a4d8`.
- Backup, new/previous image recovery rehearsal, public website checks and health
  passed. Migrations remain 001–014. Pre/post-cutover fingerprint identical:
  `e52dc4489d4433d085cd68699568dbd28caa2e63024f171f3260a9e4d30031ab`
  (38 tables, 1,533 rows). Rollback image: `ongoing-20260909-r1`.
- Read-only production rendering verified ONGOING selected, 12 ongoing rows,
  12 ended applications excluded from the list, calendar above mail updates, and
  daily counts matching stored submission dates independently of lifecycle.
  Real monthly totals were reconciled privately; no application data was changed.
- Synthetic browser checks: desktop screenshot at 1440px and mobile screenshot
  at 390px; all 17 populated date cells stay within the mobile viewport when
  expanded, clicking opens the day's links, and the default selection is ONGOING.
- After the popup positioning correction, build and the 38 focused web/calendar
  tests passed again. Device checks used desktop Chrome emulation, not a physical
  phone. First user acceptance and the scheduled mail-run gate remain separate.
