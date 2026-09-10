# Platform Watch report-to-decision contract

**Status:** P0 implemented in source; production migration and real-report acceptance pending.

**Accepted scope:** authenticated website import, readback and explicit per-finding disposition.

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
