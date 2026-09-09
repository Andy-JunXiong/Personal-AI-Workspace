# Application calendar and ongoing default — 2026-09-09

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

## Validation and release

- Local: 371 tests across 45 files, server/browser type checking and build passed.
- Regression coverage: ongoing default, explicit All and pagination, closed and
  paused exclusion, independent historical counts, timezone/year/leap boundaries,
  missing dates, workspace isolation, HTML escaping and read-only rendering.
- Deployment: pending; the previous live release is `ongoing-20260909-r1`.
- Synthetic browser checks: desktop screenshot at 1440px and mobile screenshot
  at 390px; all 17 populated date cells stay within the mobile viewport when
  expanded, clicking opens the day's links, and the default selection is ONGOING.
