# Platform Watch report-to-decision P0 results — 2026-09-10

**Result:** bounded source implementation complete; deployment and real-report acceptance pending.

## Continuity and benefits

Upstream, the September 10 session closed with a concrete question: whether PAW
should provide a small report-to-decision bridge for the already-running OpenAI
Platform Watch. The user's request to continue development authorized this bounded
P0, while the existing [Watch governance contract](../strategy/OPENAI_PLATFORM_WATCH.md)
continues to deny recommendations their own execution authority.

This change provides immediate, locally verified value: a logged-in user can save
an immutable report, see pending findings on Today, decide each finding separately
and inspect the resulting history. Longer term, that durable provenance should
prevent later sessions from treating an old suggestion as a current decision.
That expected benefit is not yet real-use evidence.

Downstream, the next developer can start with the
[active report/decision contract](../architecture/PLATFORM_WATCH_REPORT_DECISIONS.md)
and a real report acceptance rather than rediscovering ingestion, deduplication or
authority rules. The first unattended Job Tracker receipt remains the separate
operational gate; this work does not start M4 v0.3.

## Implemented

- Migration 017 stores immutable reports, keyed findings and append-only decisions.
- `PlatformWatchService` enforces Web-only authority, Workspace isolation,
  canonical-content deduplication, intent idempotency and optimistic concurrency.
- Authenticated JSON read/write routes use the existing Web session and CSRF boundary.
- A new 平台判断 / Reports view supports JSON import, list/detail readback,
  explicit accept/reject/defer/reopen actions and visible decision history.
- Today presents unresolved Watch findings after application updates without
  converting them into Job Search Tasks.
- Imported report text is escaped and external links are limited to HTTP(S).

No MCP tool, scheduled task, mailbox behavior, lifecycle rule, resume flow or
external-model setting changed. No report was imported into production, no task
was activated, and no business data was modified by this source work.

## Verification

Targeted verification passed on Node.js 24:

- TypeScript server and browser checks passed.
- 47 focused integration/transport tests passed across the new report suite,
  authenticated Web transport and database backup suites.
- The tests cover immutability, content/identity deduplication, retry replay,
  Workspace isolation, explicit decision authority, audit history, stale-write
  rejection, transition order, CSRF, login return paths, field validation, Today
  attention and imported-content escaping.
- The final full suite passed: 52 files and 403 tests.
- The production TypeScript build passed, and `git diff --check` passed.

Migration 017 also exposed that the historical migration 016 test was reading the
ever-growing current migration directory. It now verifies against an isolated
001–016 source set, preserving its original meaning. Three existing P6 integration
timeouts were raised to match observed loaded-run durations; their behavior and
data-preservation assertions were not relaxed. Local verification does not prove
deployment, target-browser usability, production backup/recovery or real scheduled
execution.

## Remaining gates

1. Review and merge the source package.
2. Perform the normal production backup/recovery and migration 017 rehearsal.
3. Deploy without changing the 30-tool MCP contract or scheduled tasks.
4. Import one real revised weekly Watch report through the authenticated website.
5. Record and read back one deliberate finding disposition, then assess whether
   the flow is useful before adding automation or another ingress channel.
