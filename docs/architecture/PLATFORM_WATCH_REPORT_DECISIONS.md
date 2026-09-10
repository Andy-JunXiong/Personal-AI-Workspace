# Platform Watch report-to-decision contract

**Status:** P0 implemented in source; production migration and real-report acceptance pending.

**Accepted scope:** authenticated website import, readback and explicit per-finding disposition.

Report import and finding decisions are scoped Web actions, like the existing
resume and library controls. They require a linked session, same-origin request
and CSRF token even when `PAW_WEB_WRITES_ENABLED=false`. They do not enable the
separate task-completion or generic candidate-write routes. The September 10
deployment preflight identified and corrected the original P0's accidental
dependency on the general-write switch.

**Not included:** scheduled-task changes, report generation, MCP tools, automatic roadmap/ADR/code changes, deployment or production data writes.

## Continuity and benefits

The [OpenAI Platform Watch](../strategy/OPENAI_PLATFORM_WATCH.md) already produces
architecture-first reports in ChatGPT, but the September 10 handoff identified a
missing bridge between an advisory report and a durable human decision. This P0
adds that bridge without moving report generation or scheduling into PAW.

The immediate benefit is a single attributable record for what was recommended
and what a person decided. The expected long-term benefit is lower decision drift:
future work can distinguish a new recommendation from an accepted, rejected,
deferred or reopened one instead of inferring intent from conversation history.

## Responsibility boundary

ChatGPT and its scheduled task remain responsible for running the Watch and
delivering the report. PAW stores only an explicitly imported snapshot and the
user's later dispositions. The website is the initial interaction surface; the
underlying Workspace database remains authoritative for the imported record.

The ownership check is:

1. Report scheduling and model execution are generic platform capabilities.
2. The existing ChatGPT task already provides them for this scenario.
3. PAW is still needed for the domain-specific link between immutable findings,
   explicit user authority, optimistic versions and later readback.
4. Revisit this storage if the target platform provides durable, exportable,
   per-finding decisions with equivalent provenance, isolation and recovery.

This contract does not establish a generic governance engine. It supports one
named Watch workflow and does not add a second scheduler or agent runtime.

## Ingestion contract

`POST /api/v1/job-search/platform-watch` is available only through a verified,
authenticated Web request with CSRF protection. The JSON body contains:

- stable `externalId`, title, generation time and original report URL;
- optional evidence cutoff and exact 40-character repository SHA;
- one directional judgment: `NO_DRIFT`, `NARROW`, `EXPAND` or `REPOSITION`;
- immutable summary/body text;
- one to twenty uniquely keyed findings, each with direction, verification,
  recommendation, next step and bounded HTTP(S) evidence links;
- a UUID `intentKey` for safe retry.

The server validates and normalizes the payload. A repeated intent with identical
content replays its original result. The same external ID with changed content is
rejected. Identical canonical content under another ID resolves to the existing
report. There is no report update or delete endpoint in P0.

Reports and findings are Workspace-scoped. Imported text is escaped on render;
source and evidence links are restricted to HTTP(S). The import request has a
256 KiB transport limit, while individual fields and finding counts have tighter
schema bounds.

## Decision contract

`POST /api/v1/job-search/platform-watch/:reportId/findings/:findingKey/decision`
requires:

- `ACCEPT`, `REJECT`, `DEFER` or `REOPEN`;
- the finding's expected positive `recordVersion`;
- a non-empty rationale;
- a UUID `intentKey`.

A pending finding can be accepted, rejected or deferred. A decided finding must
be reopened before another disposition. Every valid change increments the finding
version and appends an immutable audit row containing prior/new state, rationale,
Web channel, principal, explicit-user authority reference and timestamp. Replayed
intents return the original result; stale versions fail without a partial write.

The report list, report detail and decision history are readable from authenticated
Web/API routes. Today shows pending Watch findings after daily application updates.
The alert is attention only: it does not create a Task, accept a direction or run
the proposed next step.

## Storage and migration

Migration 017 adds:

- `platform_watch_reports`: immutable source identity and canonical hash;
- `platform_watch_findings`: independently versioned current disposition;
- `platform_watch_decisions`: append-only human decision history.

All foreign keys point into the existing Workspace/principal model. Existing MCP
tools and their contracts are unchanged; the inventory remains 30 tools.

## Acceptance and next gate

Source acceptance requires schema/service tests, authenticated transport and CSRF
tests, Workspace isolation, XSS/link handling, idempotency, stale-write rejection,
Today visibility, type checks, build and the repository's full verification suite.

Production remains a separate gated operation: back up the database, rehearse
recovery, apply migration 017, verify business-data fingerprints and route health,
then import one real revised Watch report and read back one explicit disposition.
No scheduled report should write directly into this endpoint until a separate
authority and end-to-end retry contract is accepted.

## Release procedure

Source P0 is merged through PR #22 at
`6e4eda80077d9f4144bac0c11e57c492d2f1b57f`, with successful main CI.
The recovery-mode follow-up must be included in the reviewed release source.
The last recorded production image is `resume-rail-20260910-r1`; confirm the
actual active image and migration 016 before proceeding. A different baseline
requires reconciliation, not substitution of a different verifier.

1. Build a uniquely tagged candidate from the reviewed source, retain its exact
   commit/image ID and verification evidence, and preserve the active image ID.
   Reuse the existing Compose Web/Gmail overlays and environment settings.
2. Use the running service's backup command and retain the exact returned backup
   filename. Verify that named backup; do not select an arbitrary latest file.
3. On the deployment host, run the following from the candidate source directory,
   substituting the actual backup filename and immutable local image tags:

   ```bash
   sudo bash deploy/cloud/rehearse-database-copy.sh \
     workspace-YYYYMMDDTHHMMSSZ.db <candidate-tag> <active-tag> \
     --platform-watch-upgrade
   ```

   This validates migration 016 to 017, unchanged old rows/history, exactly three
   empty new tables, candidate restart and old-image startup on the upgraded copy.
   It uses isolated containers without network access or published ports.
4. Before cutover, stop the service and retain a fresh consistent pre-migration
   snapshot. Keep ingress unavailable to writes until the candidate starts healthy
   and a stopped, post-migration snapshot has been checked against that exact
   pre-migration snapshot using the candidate's built verifier:

   ```bash
   node dist/scripts/verify-platform-watch-migration.js <before.db> <after.db>
   ```

   Run against copies in the candidate environment. A full-schema fingerprint
   must change for this migration; do not reuse an unchanged-schema `cmp` gate.
   The additive verifier checks the expected schema and every pre-existing table.
   No report import may occur before this check, which requires empty new tables.
5. Restore the existing ingress after successful migration validation. Run the
   standard five public release checks with the actual write-mode setting. Verify
   authenticated Today, Jobs, resume and the empty platform report page; confirm
   the MCP inventory remains 30 tools and existing scheduled tasks are unchanged.
6. On failure, keep ingress contained. Roll back the image only after its startup
   on the upgraded copy passed rehearsal. Retain migration 017 and any new records;
   restoring a database backup is a separate incident decision requiring
   reconciliation of intervening writes.
7. For real-use acceptance, prepare a faithful JSON snapshot of a real revised
   report and review its source URL, cutoff, repository SHA and finding keys.
   Import through the authenticated website, reload and compare the immutable
   content. Record a user-selected finding action and rationale, then reload to
   verify version 2, principal attribution and exactly one decision-history row.
   An operator must not invent an ACCEPT/REJECT/DEFER choice for acceptance.

The weekly September 15 run is still future evidence. An earlier real revised
report can validate this storage flow, but cannot validate unattended weekly
execution or the revised weekly report's quality.
