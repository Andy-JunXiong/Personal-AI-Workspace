# OpenAI Platform Watch

**Status:** ACTIVE GOVERNANCE CONTRACT AND MAINTAINED STRATEGY LEDGER; findings are advisory until human disposition.
**Adopted:** 2026-09-04. **Current boundary review:** 2026-09-08.
**Review owner:** repository maintainer.
**Last completed weekly scan:** Not recorded; the targeted review below is not a complete weekly scan.
**Next review:** first manual weekly scan by 2026-09-15, or a material event sooner.

## Continuity and benefits

The user-approved Topic A/B conclusion and [core workflow](../architecture/CORE_JOB_WORKFLOW.md)
require an explicit current boundary and a maintained correction mechanism. This
bounded documentation package replaces stale M4 constraints, separates platform
claims from PAW acceptance, and connects ownership checks to existing development
practice. It enables subsequent work to proceed from one current decision record
and the [daily acceptance gate](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md). Immediate
benefits are traceable evidence and preserved historical observations; expected
long-term benefit is lower unnecessary maintenance without premature dependency.
No runtime, deployment, task, mailbox, authority or business-data change is included.
Document link, scope and history checks are the local acceptance for this package;
they do not establish successful daily execution or continuous Watch operation.

## Topic A: current responsibility boundary

PAW is using real Job Search work to validate an authoritative domain-state,
evidence and coordination pattern behind AI interfaces. Job Search remains the
actual product domain; a universal multi-domain state kernel is not established.

Prefer verified OpenAI primitives for reasoning, interaction, model execution,
generic automation/scheduling, distribution, compatible UI hosting, connectors,
host confirmation UX and OAuth client registration. Platform availability is not
PAW scenario acceptance. Keep adapters small and replaceable where practical;
this is a direction, not a claim of complete provider independence in current code.

PAW defines and enforces its domain objects, state/version relationships,
evidence/provenance, lifecycle invariants, identity mapping, object access,
business admission, idempotency, concurrency, coverage, coordination, readback
and applicable correction contracts. Responsibility is not proof that every
scenario is implemented or verified. Authoritative state does not make model
interpretations true; source quality and reconciliation still need evidence.
External systems retain native-record authority. Store necessary references,
normalized source identities and domain facts rather than entire source archives.

Keep existing reporting Web and bounded manual controls. It reads the shared
database and supports inspection outside chat, but shared services mean it is
not a fully independent verifier of all mutations or source interpretation.
Do not expand it into a generic chat or agent console. Prefer MCP Apps for new
suitable conversational UI only after target-environment acceptance.

Keep one canonical Skill source. Server instructions summarize trust and authority;
Skills specify HOW and tool ordering; Workspace code enforces actual contracts.
Neither instructions nor a Skill grant authority. Plugin adapters may generate
target artifacts when an installation need is established; do not duplicate Skill
sources, assume every command uses proposal/admission, or extract a generic framework now.

The [M4 v0.1/v0.2 frozen evaluation is retired](../dogfood/M4_REAL_USE_EVALUATION_v0.3.md).
v0.3 is adopted but NOT STARTED; bounded manual and real scheduled acceptance
precede its new observation period. Old dates and scores are not rewritten.
This Watch does not activate v0.3 or authorize changes to runtime or evaluation metrics.

## Topic B: maintained correction mechanism

Correct boundary, not minimum boundary. Every responsibility needs a justified
owner; actual dependencies need target-environment evidence, and unverified parts
need explicit limitations and next steps. NARROW is not a success metric. Platform
capabilities may eventually replace current PAW implementations or responsibilities;
this mechanism must permit the hypothesis above to be revised.

Three triggers enter the same lightweight review:

- **Platform change:** official releases affecting UI, state, automation,
  connectors, distribution, authentication or permissions.
- **Compatibility failure:** an actual failure that challenges a relied-on
  capability or requires a replacement implementation. Diagnose routine incidents
  normally; do not turn every error into an architecture review.
- **New feature proposal:** especially generic scheduling, connector, UI, memory,
  orchestration, auth or agent-runtime work. Reuse the ownership check below.

Flow: trigger -> ownership check -> material impact? -> candidate if material ->
overlap analysis -> bounded experiment if needed -> target verification -> human
decision -> accepted ADR only when an established architecture boundary changes ->
implementation or no change -> appropriate acceptance -> close or revisit.
Every branch closes: implementation without an ADR still needs acceptance;
rejection, deferral and no-change outcomes record their reason/next condition.
A candidate finding does not itself authorize an experiment or implementation.

## Ownership check

Use these four questions in the existing development continuity statement; link
an applicable prior decision instead of repeating it. This is not a new approval board.

1. Is this generic platform capability or domain-specific responsibility?
2. Does the target platform/runtime/plan already provide it, with what evidence?
3. If so, why is a PAW implementation still necessary?
4. What is its exit or revisit condition?

## Evidence and finding fields

Official documentation establishes platform capability and its stated conditions.
Repository code establishes implementation; committed runtime records establish
only their named environment, operation and date. Human approval, tool discovery,
local tests and a model's completion statement are not interchangeable evidence.
Do not label a feature GA without source support, or infer account entitlement.

Use these five fields for material findings; no new issue-tracking subsystem:

| Field | Required content |
| --- | --- |
| Finding | Date, trigger, affected capability, official source and/or actual failure evidence |
| Direction | IGNORE / ADOPT / REMOVE / DOUBLE-DOWN; strategic recommendation, not implementation status |
| Verification | Target runtime/plan/version/permissions; NOT_TESTED / LIVE_VERIFIED / BLOCKED / UNRESOLVED / NOT_APPLICABLE, scoped evidence links |
| Human decision | PENDING / ACCEPTED / REJECTED / DEFERRED and short rationale |
| Outcome / next step | Implementation and acceptance links or explicit no-change result; remaining work and revisit condition |

IGNORE records no material boundary consequence; ADOPT prefers a platform primitive;
REMOVE retires an accepted PAW implementation/responsibility; DOUBLE-DOWN retains
or strengthens justified PAW domain responsibility. Separate capabilities when a
release supports both ADOPT and DOUBLE-DOWN. A human may accept a direction while
its implementation remains deferred; state both explicitly.

### REMOVE gate

Before a REMOVE decision is accepted, confirm and link evidence that:

1. the capability is available in the intended environment;
2. the actual PAW scenario has been tested;
3. reliability, permissions, failure visibility and run history are adequate;
4. domain invariants and explicit authority remain enforceable;
5. recovery, export or a viable fallback exists; and
6. there is an accepted PAW implementation/responsibility to remove.

Identify the exact replacement owner, plan/runtime/version, permission state,
scenario results, history-preserving migration and rollback where applicable.
Record concrete invalidation/revisit conditions. Removing implementation does not
automatically remove responsibility. If nothing was accepted to build, use ADOPT
with 'do not build', not REMOVE. Predictions cannot retire an accepted responsibility.

## Cadence and automation boundary

Weekly: limit the official-source scan to 15-20 minutes. Record its scoped result
below, even when there is no material candidate. Incomplete retrieval is not a
no-change result. Monthly: review boundaries only when material findings exist;
answer what changed, what platform capability can be used, what PAW can stop doing,
what remains its responsibility, and whether the thesis changes.

Conclusions are NO DRIFT, NARROW, EXPAND or REPOSITION; any may be correct.
Major relevant releases, material compatibility failures and generic feature
proposals trigger a focused review without waiting for the monthly date.

Begin with manual cycles. Future automation may read official sources/repository
and draft findings, scope and run results. A maintainer confirms them before
updating this ledger. Automation must not commit the Watch, create ADRs, change
roadmap, remove capabilities, deploy, edit tasks or change authority policy.
Do not build a news database, scheduler, dashboard or second agent framework.
No recurring scan has been created by this package.

### Weekly scan ledger

| Date | Scope | Result | Material candidates |
| --- | --- | --- | --- |

No completed weekly scans recorded. Allowed results: NO MATERIAL CHANGE,
COMPLETE - MATERIAL FINDING, INCOMPLETE. Completion means the stated source scope
was checked, not that every OpenAI change everywhere was discovered.

## 2026-09-08 current boundary review

**Trigger:** user-requested governance reconciliation after production expansion
and documented compatibility failures. **Repository baseline:** main at e196bd5.
**Human decision:** user accepted Topic A/B and authorized this bounded document
correction. **Conclusion:** NO DRIFT in the state/authority thesis; reconcile actual
expanded implementation and remove stale frozen-runtime claims. This is not a
retroactive finding that September 4-8 implementation scope stayed unchanged.

The following matrix separates official capability from PAW evidence and action.
All platform sources were consulted in the preceding September 8 review; no
new live mailbox, write, scheduler, entitlement or production-image test is claimed.

| Capability / direction | Official capability and limits | PAW evidence, retained responsibility and disposition |
| --- | --- | --- |
| Scheduling / Workspace Agents: ADOPT direction | [Tasks](https://learn.chatgpt.com/docs/automations) provides supported scheduled execution. [Agent API](https://developers.openai.com/workspace-agents/trigger-runs) describes queueing, invocation idempotency and beta run status; [access tokens](https://developers.openai.com/workspace-agents/authentication) require admin enablement. | [Daily acceptance](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md) remains pending. Agent eligibility/admin/API path and PAW scenario are UNRESOLVED, not confirmed entitlement denial. Implementation DEFERRED; revisit when access and a bounded read/write/readback/terminal-status test are available. PAW retains domain coverage, evidence, admission and receipt semantics; generic execution status does not prove these. |
| Specific hosted write failure: DOUBLE-DOWN on truthful evidence | Platform documentation cannot establish the cause of this particular refusal. | [Recovery](../mvp/JOB_TRACKER_RECOVERY_2026-09-08.md) and [block report](../mvp/JOB_TRACKER_PLATFORM_BLOCK_REPORT_2026-09-08.md) record ChatGPT scan-start refusal despite approval and exact-run NOT_FOUND. This path is BLOCKED in the recorded attempt, not proof all ChatGPT writes fail. The separate Codex observation trial used a different operation/context. Next: resolve and verify the actual path, then manual/scheduled acceptance; no workaround around refused writes. |
| Gmail adapter: retain, review for replacement | Platform connectors are preferred where the actual mixed-tool workflow works; their existence alone proves no PAW replacement. | [Reader evidence](../mvp/GMAIL_MCP_READER_2026-09-07.md) records built-in Gmail unavailable in the tested developer-MCP context; [current release](../mvp/RELEASE_HANDOFF_2026-09-08.md) includes direct reads/shared source identities. Retain the adapter and PAW evidence/coverage semantics. Revisit on compatible platform access; removal requires both accounts, complete bounded reads, stable identity, retry/coverage and current manual-use parity, with preserved history/fallback. Gmail owns original messages. |
| MCP Apps: ADOPT when suitable; keep reporting Web | [Optional UI](https://developers.openai.com/plugins/build/chatgpt-ui) provides hosted components while tools remain usable without UI. | [Core workflow](../architecture/CORE_JOB_WORKFLOW.md) retains direct reporting, diagnostics and bounded existing controls. No replacement UI acceptance exists. Human decision: keep Web, defer new generic UI; revisit a concrete user scenario, not a hosting announcement. Shared database/services are not an independent proof of all mutation or semantic correctness. |
| Plugins: ADOPT mechanism; retain Skill content | [Plugins](https://learn.chatgpt.com/docs/plugins) provides installation/distribution mechanisms. | [S0-S2 assessment](../architecture/WORKSPACE_SKILLS_S0_S2_ASSESSMENT.md) records canonical source, deterministic packaging and limited real read smokes; full platform provenance/routing/mutation acceptance remains incomplete. Keep existing artifacts; defer a thin adapter until target installation requires it. Do not duplicate sources or claim all platforms verified. |
| OAuth/CIMD: conditional ADOPT direction | [August 21 update](https://developers.openai.com/plugins/changelog) documents stable ChatGPT callbacks/CIMD subject to issuer support; [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp) separately describes shared stable CIMD as coming soon. [Auth guide](https://developers.openai.com/plugins/build/auth) retains server token-validation duties. | Current MCP uses [private Tunnel](../cloud/C2_SECURE_MCP_TUNNEL.md); Web uses [OIDC/identity linking](../mvp/S1_01_IDENTITY_RESULTS_v0.1.md) and [operations](../cloud/S1_WEB_OPERATIONS_RUNBOOK.md). [ADR-007](../adr/ADR-007-identity-auth-boundary.md) is an early scoped contract, not the whole current auth design. No CIMD migration is implemented or accepted here. Retain applicable token/scope validation, principal mapping, object access, provider authorization and admission; revisit only a concrete auth integration need. |
| Memory / structured state: DOUBLE-DOWN on demonstrated domain needs | [Memory](https://learn.chatgpt.com/docs/customization/memories) is recall support, not sole storage for required rules. | [ADR-001](../adr/ADR-001-conversation-not-system-of-record.md), [ADR-008](../adr/ADR-008-transition-admission-idempotency.md) and current services retain structured state and mutation contracts. No platform replacement is verified. Revisit if platform primitives satisfy actual object, authority, version, recovery and readback requirements; do not assume they never will. |

**Local document acceptance:** 343 local link/anchor checks passed across five
modified files; the original Watch baseline and Agent draft bodies are preserved,
and the Watch has exactly one primary index entry under active contracts. Whitespace
checks passed. Application tests and live execution were not rerun for this package.

**Outcome / next step:** governance correction complete locally; no production
adoption or REMOVE is approved by this record. Continue daily workflow acceptance. First manual weekly scan
is due by September 15. Deferred candidates close for now with the revisit
conditions above; daily compatibility investigation remains open. No new ADR,
generic state kernel, Plugin adapter or automatic scan is part of this package.

## Historical observations and conclusion

The original September 4 baseline below is retained verbatim as dated evidence.
Its GA labels, ADOPT directions, M4 triggers and 'Current boundary conclusion'
refer to that historical review only. The current contract and September 8 review
above supersede its present-tense scope/activation claims; do not execute old
M4 triggers or infer acceptance from historical ADOPT labels.

## Baseline — 2026-09-04

### Memory remains a recall layer

- **Official source:** https://learn.chatgpt.com/docs/customization/memories
- **Availability:** ELIGIBLE-PLANS
- **Workspace scenario verified:** NOT APPLICABLE
- **Category:** Persistent State
- **Affected boundary:** Authoritative domain state and durable rules
- **Change:** OpenAI describes Memory as cross-chat recall and advises keeping required guidance in checked-in documentation rather than relying on Memory alone.
- **Workspace implication:** Use Memory for context, not as the system of record for lifecycle, evidence, concurrency, or admission.
- **Decision:** DOUBLE-DOWN
- **Action now:** NONE
- **Revisit trigger:** OpenAI provides structured, addressable, versioned objects with domain validation, mutation authority, and recovery.
- **Architecture review required:** NO

### Scheduled and event-triggered tasks

- **Official source:** https://learn.chatgpt.com/docs/automations
- **Availability:** ELIGIBLE-PLANS
- **Workspace scenario verified:** NO
- **Category:** Automation
- **Affected boundary:** Generic scheduling, polling, and provider-event triggers
- **Change:** ChatGPT supports recurring tasks and eligible-plan event triggers from Gmail, Slack, and GitHub.
- **Workspace implication:** Use platform automation when verified; do not add a generic Workspace scheduler. Keep lifecycle validation, Today classification, evidence, and admission in Workspace.
- **Decision:** ADOPT
- **Secondary implication:** DOUBLE-DOWN on domain authority as more signals become available.
- **Action now:** NONE
- **Revisit trigger:** A post-M4 background workflow is accepted and passes a controlled scenario test.
- **Architecture review required:** NO

### MCP Apps embedded UI

- **Official source:** https://developers.openai.com/plugins/build/chatgpt-ui
- **Availability:** GA
- **Workspace scenario verified:** NO
- **Category:** Interaction / UI
- **Affected boundary:** Domain inspection and control surfaces
- **Change:** ChatGPT can render MCP Apps UI inline or full-screen for structured inspection, editing, confirmation, and navigation.
- **Workspace implication:** Prefer ChatGPT-hosted UI over an independent generic shell; keep underlying state and rules in Workspace and tools usable without UI.
- **Decision:** ADOPT
- **Secondary implication:** DOUBLE-DOWN on domain-specific formal surfaces where conversation is insufficient.
- **Action now:** NONE
- **Revisit trigger:** The post-M4 roadmap accepts its first domain UI slice.
- **Architecture review required:** NO

### Shared plugin ecosystem

- **Official source:** https://learn.chatgpt.com/docs/plugins
- **Availability:** GA
- **Workspace scenario verified:** NO
- **Category:** Ecosystem / Distribution
- **Affected boundary:** Packaging, installation, and distribution
- **Change:** ChatGPT and Codex share a plugin catalog; plugins can package skills, connectors, MCP servers, UI, hooks, and task templates.
- **Workspace implication:** Prefer the plugin ecosystem as the future host/distribution path; do not build a separate entry point before utility and adoption are proven.
- **Decision:** ADOPT
- **Secondary implication:** This strengthens Workspace's possible role as a reusable domain/state layer rather than a competing assistant.
- **Action now:** NONE
- **Revisit trigger:** M4 reaches CONTINUE and productization or multi-user distribution becomes an accepted objective.
- **Architecture review required:** NO

## Current boundary conclusion

**NO DRIFT**

As of 2026-09-04, platform improvements reduce the need for generic connectors,
schedulers, standalone navigation, and distribution infrastructure. They do not
replace authoritative domain state, lifecycle, provenance, explicit authority,
version history, or durable coordination.

The repository already delegates the affected generic capabilities to ChatGPT
or keeps them outside the frozen MVP. M4 requires no runtime or architecture
change.
