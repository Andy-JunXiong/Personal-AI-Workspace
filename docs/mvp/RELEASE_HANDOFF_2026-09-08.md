# September 8 release handoff

End-of-day September 9 successor:
[`resume-20260909-r2`](../architecture/APPLICATION_RESUME_ASSOCIATIONS.md#validation-and-release-evidence),
migrations 001–014 and 30 MCP tools. Filtered manual/website acceptance passed;
the retained daily task is enabled and its first actual scheduled receipt remains
pending. All statements below retain their original release-time scope.

Historical production: `mail-layout-20260908-r2`, migrations 001–011, 29 MCP tools.
Superseded by the [September 9 production cutover](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#production-cutover-2026-09-09):
`mail-ledger-20260909-r1`, migration 012 and 30 tools. Evidence below retains its
original September 8 scope.
Website: https://workspace.ai-radar-lab.com/workspace/job-search/today

September 9 continuation: the [backend receipt release preflight](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#september-9-release-preflight)
prepared the migration 012 rehearsal entry and verified source candidate. Local
340-test verification, cloud image build and actual backup migration/restart/
previous-image rehearsal passed; live data stayed unchanged at 28 tables / 243 rows.
The user subsequently confirmed both tasks paused and authorized the next step;
production cutover and independent read-only release checks passed. Hosted manual
and scheduled acceptance remain pending, as recorded in the current release above.

Governance/navigation follow-up: [documentation index](../INDEX.md), [M4 retirement and v0.3](../dogfood/M4_REAL_USE_EVALUATION_v0.3.md), and [daily workflow acceptance](DAILY_WORKFLOW_ACCEPTANCE.md). The follow-up changes no deployment; live ledger reads still show no completed daily scan.

End-of-day source follow-up: the [backend-managed receipt implementation](../architecture/MAIL_SCAN_BACKEND_LEDGER.md)
delivers opt-in server-owned progress, transactional write attribution and derived
receipts while retaining GPT interpretation and existing business authority.
Local verification passed 41 files / 340 tests, type checks, build, migration 012
and previous-code compatibility checks. The candidate exposes 30 tools; it is
not deployed and saved task policies remain unchanged. Publication to GitHub main
is the requested stopping point today. Next: verify the actual deployment copy,
prepare the release, then independently pass hosted manual and scheduled acceptance.
The [recovery log](JOB_TRACKER_RECOVERY_2026-09-08.md)
also records a successful two-observation Codex trial without a receipt; this
does not change the active release or establish daily coverage.

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

The new backend receipt requirements add a contract-design and implementation
workstream. They do not remove the platform authorization and real-run gates
below. Keep the current online tool policy until a compatible implementation is
deployed and its tools are available; do not treat this documentation as activation.

1. Diagnose why mailbox 1's real Synogize website check returned PARTIAL.
   The handler retained a generic failure description, not a precise underlying
   error. Only mailbox 2 advanced application-scoped coverage.
2. Tighten relevance filtering: the check saved four job-recommendation EMAIL
   records plus one NOTE. These are not confirmed application-state developments.
   No application lifecycle or task changes were made by that check.
3. Await resolution of the reported ChatGPT write block. Both old and replacement
   Job Tracker tasks remain paused. The [support report](JOB_TRACKER_PLATFORM_BLOCK_REPORT_2026-09-08.md)
   records the evidence and its limits; no exact platform root cause is established.
4. After platform recovery, verify a bounded GPT run with durable readback, then
   accept a real scheduled run. The updated [daily policy](UPDATE_JOB_TRACKER_WORKSPACE_PROMPT.txt)
   was saved and exactly read back before the September 8 17:26 restart check;
   that attempt still reported a platform block and persisted no receipt.
   See the [recovery record](JOB_TRACKER_RECOVERY_2026-09-08.md). Only the replacement task may
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
