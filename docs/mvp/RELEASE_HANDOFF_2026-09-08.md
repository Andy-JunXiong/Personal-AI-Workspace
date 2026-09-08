# September 8 release handoff

Current production: `mail-layout-20260908-r2`, migrations 001–011, 29 MCP tools.
Website: https://workspace.ai-radar-lab.com/workspace/job-search/today

Later local follow-up: [manual-check diagnostics and relevance filtering](MAIL_CHECK_DIAGNOSTICS_2026-09-08.md)
implements the next code changes for items 1–2 below, with 327 passing tests in
an independent LF verification tree. It is not deployed; historical failure
diagnosis and real-mail accuracy remain unverified. This release record remains
the evidence for the active production image.

## Continuity and benefits

- Upstream requirement: the [confirmed workflow](../architecture/CORE_JOB_WORKFLOW.md)
  keeps daily GPT ingestion and occasional website checks on the same database.
  The user then requested a less crowded status layout and publication of the
  completed work to GitHub `main` after updating its documentation.
- Current package: shared Gmail source identity and evidence deduplication,
  durable application-scoped manual checks, recent incremental search, additive
  migration 011, and two collapsed status cards with details on demand. This
  handoff reconciles the earlier recovery, ingestion and layout release records.
- Downstream enablement: maintainers can identify the active release, repeat
  local verification, inspect partial results and continue the remaining work
  without mistaking a website check for successful daily mailbox coverage.
- Short-term benefits: all 291 tests, type checking and build pass on the final
  publication tree; desktop and 390px synthetic browser checks verified the
  layout, and production readback verified both summary and expanded details.
- Long-term benefits: one traceable business database and a concise reporting
  website, with release evidence and unresolved acceptance gates recorded together.

## Release and verification

| Area | Verified result | Evidence |
| --- | --- | --- |
| Active image | `paw:mail-layout-20260908-r2` | [Layout release](MAIL_STATUS_LAYOUT_2026-09-08.md) |
| Image SHA-256 | `d0875f9efdba699b00fab7550e9cc7e5614df710423811ed88cca6fe33a53d8c` | Container inspection at cutover |
| Runtime source | `/opt/paw-mail-layout-20260908-r2` | Existing Lightsail `paw-mvp`, Sydney |
| Database protection | Migration 011 added four tables; layout cutovers preserved all 28 tables / 239 rows | [Ingestion release](MAIL_INGESTION_ALIGNMENT_2026-09-08.md), layout logical fingerprints |
| Rollback readiness | Backup `workspace-20260908T015234Z.db`; old images retained; isolated new/old image starts passed | Layout release record |
| Browser | Two collapsed cards; readable local times; details and application links available | Desktop and 390px local preview; production Today readback |
| Public endpoint | Health checks and `web:check --writes off` passed | Signed-out boundary, route isolation and OAuth checks |
| Final publication checks | `npm.cmd run verify`: 36 files / 291 tests, both type checks, production build; `node --check deploy/cloud/mail-batch-cloud-smoke.mjs` passed | September 8, 12:07 Australia/Sydney |

The public release probe now requires explicit `PAW_SMOKE_WORKSPACE_ID`,
`PAW_SMOKE_MAILBOX_1_EMAIL`, `PAW_SMOKE_MAILBOX_2_EMAIL` and
`PAW_SMOKE_HISTORICAL_RUN_ID` environment variables instead of hard-coded personal
identities. Supply them deliberately when invoking the read-only probe inside
the running container. This publication-only probe adjustment was syntax-checked;
it was not rerun against production and does not change the deployed application.

## Remaining work

1. Diagnose why mailbox 1's real Synogize website check returned PARTIAL.
   The handler retained a generic failure description, not a precise underlying
   error. Only mailbox 2 advanced application-scoped coverage.
2. Tighten relevance filtering: the check saved four job-recommendation EMAIL
   records plus one NOTE. These are not confirmed application-state developments.
   No application lifecycle or task changes were made by that check.
3. Await resolution of the reported ChatGPT write block. Both old and replacement
   Job Tracker tasks remain paused. The [support report](JOB_TRACKER_PLATFORM_BLOCK_REPORT_2026-09-08.md)
   records the evidence and its limits; no exact platform root cause is established.
4. After platform recovery, save the updated [daily policy](UPDATE_JOB_TRACKER_WORKSPACE_PROMPT.txt),
   verify a bounded GPT run with durable readback, then accept a real scheduled run.
   The latest local policy is not yet saved online. Only the replacement task may
   eventually be active, at 08:00 Australia/Sydney.

Per-application manual runs persist; the overall website batch envelope remains
in memory. Manual coverage does not advance daily full-mailbox checkpoints.
Existing uncertain legacy mailbox identities require reconciliation rather than
automatic rebinding. See the ingestion record for the full operational limits.

## Publication scope

This commit includes the implemented code, migration, tests, release helpers and
updated public documentation. Raw support messages and screenshots remain local
and are explicitly ignored by Git; the public diagnostic report retains the
relevant conclusions and observed error behavior.

Pushing the repository records the delivered work. It does not redeploy the
service, change database records or activate either scheduled task. The earlier
release documents retain their original timestamps and image tags as history;
the active version is the one at the top of this handoff and README.
