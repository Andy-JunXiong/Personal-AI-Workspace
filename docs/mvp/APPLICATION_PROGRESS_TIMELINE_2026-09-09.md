# Application progress timeline — 2026-09-09

## Continuity and benefits

Following the [calendar release](APPLICATION_CALENDAR_2026-09-09.md), the user
identified operational Gmail check receipts and vacancy recommendations in
application timelines. The [core workflow](../architecture/CORE_JOB_WORKFLOW.md)
requires the website to report meaningful application progress over the same
stored evidence. Company/role keyword overlap does not prove an application update.

This increment projects submission dates, admitted progress and relevant mail
milestones. Check receipts of every outcome, task administration and unclassified
or marketing mail are excluded. A recorded appliedDate replaces the duplicate
initial APPLIED registration event. Tasks and historical resources retain their
separate views, and check results remain available in the mail-check area.

New web evidence preserves its classification. Canonical Gmail interpretation
accepts optional category: APPLICATION_CONFIRMATION, APPLICATION_UPDATE,
INTERVIEW, OFFER, REJECTION or ACTION_REQUEST. Non-evidence categories and clear
vacancy marketing are rejected at observation normalization; the website also
filters marketing before save. MCP tool guidance and the interactive copy prompt
describe these rules. Legacy contracts without category remain accepted.

Timeline mail must match the application's company and role. Existing mail without
a category uses conservative positive milestone phrases; ambiguous old summaries
remain in evidence rather than being promoted to events. This is a display policy,
not a new inference that changes lifecycle state. Other structured providers are
not automatically treated as canonical application evidence.

Users can now review their actual progress without scanning operational noise.
The next gate is live projection verification on the reported applications.
Longer term, preserving classification avoids losing meaning between ingestion
and display. No records are deleted or rewritten, no migration or new service is
introduced, and this release does not claim scheduled mail-run acceptance.

## Validation and release

- Local full verification: 374 tests in 46 files, server/browser type checking
  and build passed. Coverage includes historical noise, all check outcomes,
  submission deduplication, pagination after filtering, exact application matching,
  meaningful recruiter requests, classification persistence, future marketing
  rejection and unchanged records after timeline reads.
- Production: pending; prior release is `calendar-20260909-r1`.
