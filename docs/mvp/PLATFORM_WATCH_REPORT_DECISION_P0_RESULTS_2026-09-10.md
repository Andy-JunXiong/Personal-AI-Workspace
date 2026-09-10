# Platform Watch report-to-decision P0 results — 2026-09-10

**Result:** deployed as `platform-watch-20260910-r1`; migration, recovery,
data-preservation, public release and authenticated real-report import/readback
passed. A deliberate human finding disposition remains pending below.

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

1. Source merged through PR #22 at `6e4eda80077d9f4144bac0c11e57c492d2f1b57f`;
   [main CI](https://github.com/Andy-JunXiong/Personal-AI-Workspace/actions/runs/34459242046)
   completed successfully. The recovery-mode follow-up below remains local.
2. Perform the normal production backup/recovery and migration 017 rehearsal.
3. Deploy without changing the 30-tool MCP contract or scheduled tasks.
4. Import one real revised weekly Watch report through the authenticated website.
5. Record and read back one deliberate finding disposition, then assess whether
   the flow is useful before adding automation or another ingress channel.

## Release preparation follow-up — September 10

The resumed review found that the existing recovery script did not accept a
Platform Watch upgrade mode. Its default unchanged-schema check would reject the
intended migration, and the other modes select different migration baselines.
The local follow-up connects `--platform-watch-upgrade` to the existing exact
016-to-017 verifier. It retains isolated candidate startup, repeated candidate
startup and previous-image startup on the upgraded copy. This closes a release
preparation gap; actual container recovery and production acceptance remain pending.

The [release procedure](../architecture/PLATFORM_WATCH_REPORT_DECISIONS.md#release-procedure)
records the concrete backup, migration and readback sequence. Existing 403-test
and main-CI evidence applies to the unchanged application source; follow-up checks
are recorded separately below.

- `npx.cmd vitest run tests/unit/cloud-web-deployment.test.ts tests/integration/platform-watch-report.test.ts`:
  PASS, 17 tests in two files. Covers retained deployment isolation constraints,
  additive migration verification and the existing report/decision contracts.
- Git Bash `bash -n deploy/cloud/rehearse-database-copy.sh`: PASS. Reviewed mode
  dispatch selects `dist/scripts/verify-platform-watch-migration.js` and retains
  all three existing upgrade/restart/previous-image stages.
- `git diff --check`: PASS. The active contract and README now point to the
  remaining recovery/deployment gate instead of the already completed merge.
- No full-suite, typecheck or build rerun: application, schema, dependencies and
  compiler inputs are unchanged from the passing main CI. This shell-only wiring
  follow-up does not establish actual Docker recovery or cloud cutover evidence.
- Follow-up remains local and unpublished. No deployment, production import,
  human disposition or scheduled-task change was performed.

## Authorized deployment follow-up — September 10

Jun subsequently requested performing the prepared deployment. SSH preflight
confirmed the healthy `resume-rail-20260910-r1` image, migration 016, disabled
general Web writes and identity bootstrap, and sufficient disk space. Temporary
operator-only SSH access is restored after each remote operation.

Preflight also found that the original Watch router and controls depended on
general Web writes, making the new flow unavailable with the accepted production
settings. The bounded correction mounts only Watch actions through the existing
linked-session/origin/CSRF guard, as used by scoped resume/library actions.
Task completion and generic candidate writes retain their existing switch.
The transport test now exercises both switch settings, rejects unauthenticated
and cross-origin imports, and verifies unrelated write routes stay unavailable.
Both type checks and 47 focused transport/report tests passed. Because this
changes runtime routing during an actual migration release, a full release
verification is required before cutover; the prior 403-test result alone no
longer covers the final candidate.

### Production release evidence

- Pinned release source: `8e1ff17dde29b3f93ca4576336a7710e16b5f8e8`.
  Full verification in an isolated LF checkout on Node 24 passed: both TypeScript
  checks, **404 tests in 52 files**, and build. Two workers and the explicit
  existing Python interpreter avoid known Windows environment variability.
- Source archive SHA-256:
  `d075b4ff8361cfd9fb6898246784d305c3b09c8b95e3ba50909743bea503b43a`;
  upload hash readback matched. Built image:
  `sha256:90cb102041af3f6f4419e8ea4b8ff953dc3cc34a61a762d8088409fd581c6743`.
- Named backup `workspace-20260910T105302Z.db` passed integrity verification at
  migration 016; no older backups were removed. Migration rehearsal preserved
  **42 pre-existing tables**, adding only three empty Watch tables and migration
  history. Candidate upgrade, candidate repeat startup and previous-image startup
  on the upgraded copy passed: 46 tables / 1,754 rows, approximately 37–39 MiB.
- The first cutover applied 017 but its direct read-only WAL verification failed
  with `SQLITE_CANTOPEN`. The trap restored the previous image and ingress to
  healthy service while retaining the upgraded database. No database restore or
  report write occurred. The rehearsal had already proved that old image compatible.
- Resumption used the retained stopped pre-migration snapshot
  `workspace-20260910T105503Z.db` and a new standalone post-migration snapshot.
  The post-migration snapshot is `workspace-20260910T105629Z.db`.
  The additive verifier passed against these copies, including every old table,
  migration history and exactly three empty additions. This corrects the operational
  snapshot procedure; it does not weaken the verifier or change application code.
- Final cutover passed at **2026-09-10T10:56:37Z / 20:56:37 Australia/Sydney**.
  Container healthy, database available. All five public release checks passed
  both on the host and independently from the local client. General writes and
  bootstrap remain disabled; Compose, Gmail and model settings were retained.
- Actual connected `workspace_ping` readback returned the existing Workspace and
  available database; connected MCP inventory remains **30 tools**. No mail scan,
  model call, task edit or application lifecycle operation was triggered.
- Temporary operator `/32` SSH access was restored after every remote operation.
  Release source is `/opt/paw-platform-watch-20260910-r1`; durable image, backup,
  rehearsal, migration, public-check and cutover records are under
  `/srv/paw/deployments/platform-watch-20260910-r1-*`.

The earlier source-only and local-follow-up paragraphs retain their historical
scope; this explicit deployment and dated production evidence supersede their
pending deployment statements. Immediate value is an operable report entry point
with existing data preserved. Durable decision usefulness still requires actual
human disposition and later reuse; the September 15 weekly run is future evidence.

### Authenticated real-report acceptance

Normal Chrome/Google sign-in reached the already-linked Workspace account;
the other account was correctly rejected as unlinked. No identity mapping or
bootstrap setting was changed. The empty report page showed the scoped import
control with general writes disabled.

The browser imported the real September 10 directional rewrite from fixed source
`001bef2589aed8b4c877b95fbd450fcf688de951`. Its body is an exact snapshot of the
report section and appendix; historical claims remain historical. The structured
summary explicitly labels the rewrite as an existing scan, uses the editorial
commit time for `generatedAt`, and retains the original PAW scan SHA and cutoff.
It is not a new scan, the September 15 weekly run, or updated platform research.

- Report ID: `da950bd7-2254-422a-9ff8-9749d5ca92c3`.
- External ID: `openai-platform-watch:2026-09-10:editorial-001bef2`.
- Canonical input hash, verified against the stored record:
  `e8b18654b1c0a9f0deaa8ec21d72d9b74c6fde8eb261a6efef5fcab100cfc5e6`.
- Exact body SHA-256:
  `667356c57f94f5448d1444b13534cde95ac833f45793c9ce9dfbed99e4914557`.
- Independent read-only database query found exactly one report, findings
  `F1-UI-REVIEW`, `W20260910-01`, `W20260910-05`, all PENDING at version 1,
  and zero decision rows. The original cutoff remains `2026-09-10T05:50:14Z`.
- Authenticated report refresh preserved the content and displayed provenance,
  source/evidence links and per-finding controls. Desktop rendering was inspected.
  Today retained Nine's application update and showed three pending findings;
  Jobs retained 10 candidates, and the resume page retained saved version 5 and
  its preview/order controls. No resume save, candidate decision or mail check ran.

Remaining gate: the user selects an actual finding action and rationale, followed
by authenticated submission and independent version/history readback. Deployment
authorization is not treated as an ACCEPT of all imported recommendations. Narrow
mobile report usability and future weekly reasoning quality are not claimed as
verified by this desktop release acceptance.
