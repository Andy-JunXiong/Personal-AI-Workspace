# S1-03 — Responsive read-only Job Search interface

**Date:** 2026-09-05 (Australia/Sydney).

**Status:** Local implementation, synthetic HTTP verification and desktop/narrow
Chrome UI checks passed. This is an intermediate read-only interface, not the
complete S1 operational release or public iPhone acceptance.

**Authority:** The user's next-step request continues the
[approved local S1 scope](S1_LOCAL_SCOPE_DECISION_2026-09-05.md). No real business
database, Google account, public endpoint or cloud deployment was changed.

## Delivered behavior

| Page | Behavior |
| --- | --- |
| `/workspace/job-search/today` | Existing attention reasons, upcoming tasks, separate applications without open tasks, recent admitted changes and configured-timezone freshness. |
| `/workspace/job-search/applications` | Company/role search, open/closed/all scope, lifecycle filter, deterministic sorting, truthful totals and progressive pagination. |
| `/workspace/job-search/applications/{id}` | Actual application state and counts; task, evidence and progress sections; completed/cancelled task filters; bounded collection pages. |
| `/workspace/job-search/tasks/{id}` | Exact task state and completion time, parent link and a copyable task reference for a fresh ChatGPT read. |
| Login and error pages | Signed-out object links retain the object-only return path; browser login cancellation/failure/unlinked identity, invalid query, not found, stale cursor and unavailable storage have readable recovery states. |

The Express page router obtains the same freshly verified WEB request identity
as the JSON reads and uses `WorkspaceService` / `JobSearchQueryService`. No new
business query implementation, data migration, framework or dependency was added.
Google issuer/signature/link checks and secure session-cookie settings remain
those of S1-01. The existing MCP surface remains 13 local tools.

Evidence presents selected observed fields and safely linked sources. The
canonical Gmail contract displays received time/domain separately from the
interpretation summary. Interpretations/proposals are explicitly labeled and do
not become confirmed lifecycle state. Raw snapshots and arbitrary observation
JSON are not rendered. HTML text/attributes are escaped; external links permit
only HTTP(S) without embedded credentials and use no-referrer/no-opener behavior.

## Interaction and packaging

Ordinary links and GET filters work without JavaScript. A small browser module
enhances filtering, load-more, refresh, context copying and CSRF-protected logout.
Continuation adds rows while preserving an accurate loaded count. Refresh starts
again without a cursor; stale/expired continuations instruct the user to refresh.
Repeated reads cancel prior requests, and requests time out after 15 seconds.

Foreground and network-recovery refresh preserve unsubmitted filter input. A
dirty foreground view still checks the session. Read failure retains the prior
content with a visible stale-data warning. A 401 clears private rendered content
and offers login; restored browser-history pages reload. No browser persistence,
offline queue, service worker or business mutation endpoint was added.

The layout has desktop navigation, mobile navigation with accessible logout,
390px/320px breakpoints, labeled fields, visible focus, a skip link and live
status announcements. Mobile input text is 16px to avoid small-input zoom;
primary controls have at least 44px height. Context references remain in a
selectable read-only field if clipboard access is unavailable.

The two assets are explicitly routed under `/assets/`. CSP permits only same-origin
scripts/styles/connections and blocks inline scripts, framing and base-URL
replacement. Responses retain private/no-store and no-referrer headers. Build
copies the exact CSS/JS files into `dist/src/web/assets`; the existing Docker build
continues to package `dist`. The preview fixture is excluded from that build.

## Verification evidence

`npm.cmd run verify` passed: **18 files / 171 tests**, server and browser
typechecking, and production build. Five new integrated page tests cover:

- Signed-out saved-object page → signed synthetic OIDC flow → same object;
  revocation removes access and does not reveal object contents.
- Completed-task detail/filter, separate observation/interpretation rendering,
  canonical Gmail provenance, admitted/proposed history and zero database changes
  across reads.
- Ordinary GET filters including empty lifecycle selection, empty results,
  HTML/attribute escaping, pagination and clean stale-cursor recovery.
- Invalid queries, same missing/other-owner response treatment, the exact static
  asset allowlist, CSP and no-store headers.
- Readable unlinked/cancelled login and generic unavailable-storage response.

Existing identity, transport, query, MCP, task, lifecycle, backup and startup tests
also passed. Windows recursive directory copying failed in the initial asset
build; explicit directory creation plus copying the two named files succeeded.

Browser checks used the actual local CSS/JS/templates with **28 synthetic
applications**, isolated in-memory state and a loopback-only test harness:

- Desktop Today and responsive inventory/task screens inspected visually.
- Viewports set to 390 × 844 and 320 × 780. Chrome's scrollbar left respective
  content widths of 375px and 305px; measured document widths had no horizontal
  overflow on the checked screens.
- Loaded 25 then all 28 applications; the UI reported 28 total / 28 loaded.
- Searched Northstar and obtained six results; refresh preserved an unapplied
  filter draft instead of discarding it.
- Opened an application, selected completed tasks, opened the completed task,
  verified its completion timestamp and copied the exact task reference.
- Injected 503 through the fixture's local stdin: UI retained the list and warned
  that displayed data might be stale. Injected 401: private records and logout
  control disappeared and the object-return login link remained.

The browser viewport was restored and test tabs/listeners were closed afterward.

## Reproduction and limits

Run `npm.cmd exec tsx tests/manual/web-preview.ts` from the repository root.
The script always creates new synthetic in-memory data; it accepts no existing
database or account. Its console prints the loopback preview and object paths.
In an interactive terminal, enter `unavailable`, `expired`, `normal` or `quit`
to exercise faults/recovery or stop. A busy port fails explicitly. Fixture identity
and fault injection exist only in `tests/manual/`, with no production import.

The browser harness deliberately exercises presentation without real account
login. Production authentication was exercised by signed synthetic OIDC HTTP
tests, not by this presentation harness. Browser logout, clipboard-denied fallback,
airplane-mode recovery, foreground draft/session race behavior and broad assistive
technology coverage were not separately device-tested. Real Google login, Safari
HTTPS, Windows-off iPhone access, deployment/restart/rollback rehearsal and
cross-device completion remain pending. This evidence does not pass full G01–G09
release gates in the [P0 plan](JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md).

**Next package:** S1-04 task completion with trusted request authority,
atomic audit/idempotency, version conflicts and uncertain-response recovery.
Completion writes remain disabled until that package is implemented and verified.
Candidate/digest continuity remains S2; public release remains separately reviewed.
