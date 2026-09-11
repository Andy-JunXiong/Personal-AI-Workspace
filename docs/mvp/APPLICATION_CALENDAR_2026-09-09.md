# Application calendar and ongoing default — 2026-09-09

**September 11 follow-up:** the user approved showing existing application
confirmation emails when a submission date is missing. See the follow-up below;
the original September 9 gate and release evidence retain their historical scope.

## Continuity and benefits

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
