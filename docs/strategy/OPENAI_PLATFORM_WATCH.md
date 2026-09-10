# OpenAI Platform Watch

**Status:** ACTIVE GOVERNANCE CONTRACT AND MAINTAINED STRATEGY LEDGER; findings are advisory until human disposition.
**Adopted:** 2026-09-04. **Current boundary review:** 2026-09-08.
**Review owner:** repository maintainer.
**Last completed weekly scan:** 2026-09-10 manual baseline, scoped evidence below; findings await human disposition.
**Next review:** weekly delta scans after the September 10 scoped scheduled acceptance; revisit material events sooner.

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
| 2026-09-10 | September 1–10 release summaries across ChatGPT/Codex, API and Plugin UI; five current boundary references; pinned GitHub main plus disclosed local production evidence | COMPLETE - MATERIAL FINDING (manual); recommendations PENDING | W20260910-01 through W20260910-04 |

Allowed results: NO MATERIAL CHANGE,
COMPLETE - MATERIAL FINDING, INCOMPLETE. Completion means the stated source scope
was checked, not that every OpenAI change everywhere was discovered.

## Directional reporting update — 2026-09-10

### Continuity and benefits

Jun requested architectural comparison and directional insight instead of a
release-note digest. This update changes the existing Skill, report reference and
weekly prompt: compare OpenAI evidence, PAW implementation/plans and prior
judgments; lead with choices, tradeoffs and falsifiable next steps. It adds no
new taxonomy or automatic decision authority. The immediate benefit is a
decision-oriented rewrite below; the next gate is reasoning-quality review of
the first scheduled report under this revision. The earlier execution/retrieval
acceptance still applies to unchanged mechanics, not to the revised report quality.
Longer-term value is better investment and ownership decisions, including changing
PAW's thesis when contrary evidence warrants it. PAW report ingestion/display
remains a separate unimplemented product increment.

### 首份报告：方向与架构判断（重写）

这是对 9 月 10 日既有扫描的重新分析，**不是一次新的扫描**。
平台事实仍使用原报告的来源和 `2026-09-10T05:50:14Z` cutoff；
PAW 扫描基线仍为 `40b1bf8d115c54951b2b27a0c809c285609304f3`，
生产补充仍为此前人工确认的发布记录。PR #20 后续合并只说明 Watch
执行层已进入仓库，不构成其他产品能力的新验收。下列判断均为建议。

**方向判断：NO DRIFT，但开发投入应优先连接分析与实际决策。**
这次材料支持继续使用平台的通用执行能力，并保留有场景证据支撑的
PAW 领域责任；不足以证明 PAW 所有现有实现都应该保留。

1. **把平台执行作为默认选择，把 PAW 的投入落在可靠的工作结果上。**
   对比：官方调度/插件能力与本次真实只读 Watch 成功，说明这个场景
   已能借助平台运行；PAW 原有的申请、证据、覆盖和准入要求则不能由
   “任务完成”状态证明。相比此前只知道工具可用，现在多了实际执行证据。
   建议：Watch 继续使用平台调度，暂不自建通用调度或插件管理；
   下一步验证真实 Job Tracker 的写入、回执与回读，之后再判断可替代范围。
   代价与反证：依赖平台会受权限、可观测性和恢复能力约束；
   若目标工作流反复无法无交互完成，或无法核对结果，应重新比较一个
   有限的自有执行适配方案。反过来，平台若能证明相同领域契约与恢复能力，
   PAW 的保留范围也应缩小。不能把“保留领域状态”当永久答案。
   依据：[实际定时对照](#actual-scheduled-acceptance--september-10)、
   [原发现 W01](#one-minute-report)和[官方调度边界](https://learn.chatgpt.com/docs/automations)。
   此处的投资优先级是 PAW 推断，不是官方结论。

2. **交互架构按工作场景划分，暂不开展整套简历 UI 迁移。**
   对比：MCP Apps 提供会话内 UI，但用户已经在简历网页中验证了排版、
   区域排序和快速定位。原来“等一个具体场景”的复核条件已出现，
   并不等于替代 UI 已经更好。建议继续保留当前编辑器，把会话内 UI
   的试验限定在职位比较或建议确认等独立场景；该试验仍需单独决定。
   替代方案是将简历完整搬入会话，收益可能是少切换页面，代价是重做
   精细编辑、版本/顺序保持和预览导出验收。
   推翻条件：用同一简历和同一组编辑任务验证，如果会话 UI 能保留这些
   能力，并在实际操作中减少步骤和返工，才考虑逐步迁移；当前尚未测过。
   依据：原定时报告 F1、[简历合同](../architecture/RESUME_EDITOR.md)、
   [官方 UI 边界](https://developers.openai.com/plugins/build/chatgpt-ui)。
   简历合同的仓库版本与后续人工生产补充须按原报告分开理解。

3. **下一项产品增量建议是 PAW 中的“报告到决策”，而非更多扫描。**
   对比：扫描与报告送达已在 ChatGPT 跑通，但本次用户反馈表明，
   用户预期在 PAW 查看影响和做决定；当前 PAW 尚无报告展示入口。
   这暴露的是交付与决策连接缺口，不是缺少另一套分析或调度系统。
   建议优先准备一个小范围方案：在“今天”提示新报告，查看架构判断、
   来源及待决定事项，并保留人工决定与原证据的关联。
   替代方案是只在 ChatGPT 阅读，开发成本更低，但跨会话回看决定更依赖
   对话历史。数据如何进入 PAW、谁能写入及如何去重仍需先定义；
   本次没有实现页面、存储、写工具或新的批准流程。
   验证条件：用一份真实报告走通查看、理解建议和回看决定；
   如果用户在 ChatGPT 已能稳定完成且不再需要 PAW 入口，应缩减这一增量。
   依据：本次用户关于展示位置和 insight 的反馈，以及现有
   [任务报告](https://chatgpt.com/scheduled/6aa245ff60688191aee442beb3a181a1)。
   这是产品建议，不是已采纳的路线图。

**本轮待决定：** 是否优先进入“报告到决策”的方案设计。
通用调度开发和整体 UI 迁移目前没有足够证据成为优先项；没有 REMOVE 建议。

### Evidence and disposition appendix

| Finding | Direction | Verification | Human decision | Outcome / next step |
| --- | --- | --- | --- | --- |
| Insight 1, W20260910-01 revisited after the actual Watch trial; PAW domain-contract judgment linked to W04 | ADOPT for platform execution; retain the separately recorded DOUBLE-DOWN recommendation for attributable PAW evidence | LIVE_VERIFIED only for the read-only Watch run; Job Tracker business writes UNRESOLVED | PENDING for broader adoption or implementation | Bound the next Job Tracker acceptance; keep the distinct owners and their reversal conditions above |
| Insight 2, scheduled F1; concrete resume scenario versus optional conversational UI | ADOPT only as the previously proposed bounded UI evaluation | NOT_TESTED for replacement UI; historical user acceptance belongs to the existing Web | PENDING | Compare the same editing task before any migration; preserve current Web meanwhile |
| W20260910-05, user feedback on report location and decision usefulness; NEW product follow-up | DOUBLE-DOWN on traceable domain decisions, with a small PAW entry point proposed | NOT_TESTED for report ingestion/display and decision-history workflow | PENDING; permission to improve report requirements does not approve this product increment | Define the smallest report/decision flow and its access/provenance contract before implementation; reconsider if ChatGPT alone meets the user need |

W20260910-03 (API error classification) remains a technical follow-up in this
appendix. No production outage, strategic urgency or accepted retry change is
inferred. Plugin version details, all eight sources, failed Markdown reads and
the repository/production evidence remain in the original scan below. Rewriting
this summary does not advance a cutoff or create another COMPLETE scan.

Editorial checks: every main insight compares platform or delivery evidence with
PAW, names a concrete choice and alternative, and includes a bounded reversal
condition. API detail no longer occupies the main summary. Missing-source and
no-material-change behavior remain explicit in the Skill. The new scheduled
reasoning quality is NOT_TESTED until an actual revised run is reviewed.

## Execution layer v1 — 2026-09-10

### Continuity and benefits

Jun authorized operationalizing this existing contract after reviewing the proposed
procedure and feedback. The new [repo-local Watch Skill](../../.agents/skills/openai-platform-watch/SKILL.md)
and its [run reference](../../.agents/skills/openai-platform-watch/references/run.md)
provide retrieval, baseline, delta and reporting steps. This foreground development
session may prepare artifacts and a platform-task trial; that authorization does
not turn later Watch runs into repository writers. Existing governance, taxonomy
and the Job Search capability set remain intact.

The immediate deliverable is the first source-grounded report below. It identifies
actionable execution and compatibility questions, including repository/production
drift. The next gate is genuine clock-triggered retrieval and report parity in
ChatGPT; continuous operation is not established by a manual success. Expected
long-term benefit is better build/adopt/reposition decisions from repeatable,
bounded evidence. No service, database, MCP tool, scheduler, dashboard, application
deployment or business-data mutation is introduced.

### Manual weekly run 1

- **Run type:** manual development trial; the new Skill was supplied locally.
  Skill SHA-256: `ee8f9dc6ec4576324ccf99400e990ae39b1bc872495cfcb28473fc2b938c786f`;
  run-reference SHA-256: `022fa0a133f5384f151bc881e149dbc34e34b1674eea75bd83ed05bca54f7266`.
- **GitHub baseline:** `main` resolved through the GitHub connector to
  [`40b1bf8d115c54951b2b27a0c809c285609304f3`](https://github.com/Andy-JunXiong/Personal-AI-Workspace/commit/40b1bf8d115c54951b2b27a0c809c285609304f3).
  Watch, core workflow, resume architecture and Skill release manifest were read
  at that exact SHA; relevant API-client code was read there too.
- **Local baseline:** HEAD `2a9e1691feabeba8b2c9717c947fc3e2f2ec6442`, with existing
  uncommitted application/document changes. These were not treated as GitHub main.
- **Last confirmed production:** `resume-rail-20260910-r1` at `2026-09-10T04:56:34Z`,
  from the preceding deployment/readback and user acceptance in this session;
  not a new production probe by Watch. The supplement is the local
  `docs/architecture/RESUME_EDITOR.md` gutter-navigation release record, absent
  from the pinned GitHub version of that file.
  Runtime manifest SHA-256: `a2540ec700a513f8f51f6e661cf833534531916dbdc93535dfc0ef8ed4397ffb`.
  Local release-record SHA-256 at scan: `387060cf877a33347e73bdd2f4657eed9ea7dc93a4b8f6f1e7cb0f76407a64c7`.
- **Known difference:** GitHub's resume record describes `resume-editor-20260909-r3`.
  The later UI, spacing and ordering work is in the disclosed local/deployment
  evidence. Cloud readers must report this limitation, not infer those features
  are absent from production. The newer GitHub README restructuring was preserved.
- **Previous completed weekly scan:** NONE. The September 8 targeted findings are
  comparison history, not a completed weekly cutoff.
- **Official scope:** September 1–10 dated release summaries, plus current boundary
  pages listed below. This establishes a recent baseline, not an exhaustive history.
- **Result:** COMPLETE - MATERIAL FINDING for this declared manual scope.
- **Official-source retrieval cutoff:** `2026-09-10T05:50:14Z` (15:50 Sydney).
  This is the next eligible delta cutoff after maintainer review; no prior
  successful weekly cutoff existed.
- **Strategy disposition:** PENDING for all new findings; no adoption or removal
  decision is inferred from Jun's permission to implement the Watch procedure.

### One-minute report

1. **W20260910-01 — REVISIT_TRIGGERED / ADOPT:** Test a read-only cloud Watch using
   GitHub plus official sources. Interactive pinned GitHub reads work here;
   unattended access and report quality still require actual scheduled acceptance.
2. **W20260910-02 — CHANGED / ADOPT:** Native plugin distribution and refresh are
   progressing. Keep one Skill source and test the exact target surface before
   adding a packaging adapter. CLI fixes do not establish a ChatGPT write fix.
3. **W20260910-03 — NEW / ADOPT:** Review the API client's treatment of newly
   differentiated rate/overload errors when improving manual-mail reliability.
   Propose a mocked error/retry test before changing behavior.
4. **W20260910-04 — REVISIT_TRIGGERED / DOUBLE-DOWN:** Preserve traceable repository
   and production evidence. Reconcile the release documentation in its own
   development change; a cloud Watch must disclose the current mismatch.

**Boundary conclusion: NO DRIFT, advisory.** No verified replacement currently
justifies removing an accepted PAW responsibility. Platform distribution remains
an opportunity to validate. A future scenario may justify NARROW, EXPAND or
REPOSITION; this run does not lock in the thesis.

### Evidence and proposed next steps

**W20260910-01 — Read-only Watch execution**

- **Finding:** Current [Scheduled Tasks documentation](https://learn.chatgpt.com/docs/automations)
  describes cloud tasks using accessible tools/context; local folders require a
  different runtime. The user-requested Watch is a new read-only scenario that
  reopens the September 8 deferred scheduling direction.
- **Direction:** ADOPT.
- **Verification:** UNRESOLVED for ChatGPT unattended Watch. GitHub connector reads
  of the pinned repository passed in this interactive Codex session; the account's
  Scheduled page was visible. Neither proves scheduled connector parity.
- **Human decision:** PENDING for runtime acceptance; procedure development accepted.
- **Outcome / next step:** Test a fixed-source, fixed-repository one-off scheduled
  report, then a weekly prompt. Infer only a Watch execution benefit. The Job
  Tracker's business-write acceptance remains a separate scenario and gate.

**W20260910-02 — Plugin and host evolution**

- **Finding:** The [ChatGPT/Codex changelog](https://learn.chatgpt.com/docs/changelog)
  records remote-marketplace CLI management in 0.153.0 (September 3) and plugin
  refresh improvements in 0.154.0 (September 9). Its OAuth-refresh fix explicitly
  does not automatically replay rejected calls. Current
  [plugin documentation](https://learn.chatgpt.com/docs/plugins) describes shared
  distribution with surface-specific availability.
- **Direction:** ADOPT, continuing the September 8 distribution direction with
  changed platform evidence.
- **Verification:** NOT_TESTED for this new governance Skill's target installation
  and unattended loading. Existing Job Search packaging is a different capability.
- **Human decision:** PENDING for an adapter; existing single-source direction retained.
- **Outcome / next step:** Pin the Watch procedure for a cloud trial. Add only an
  adapter required by demonstrated installation needs. No entitlement assumption,
  platform upgrade, generic plugin manager or inference that Job Tracker is fixed.

**W20260910-03 — API error fidelity**

- **Finding:** The September 2 [API changelog](https://developers.openai.com/api/docs/changelog)
  distinguishes `429/slow_down` and `503/server_is_overloaded`, with conditional
  `Retry-After` guidance. PAW's
  [pinned manual-mail client](https://github.com/Andy-JunXiong/Personal-AI-Workspace/blob/40b1bf8d115c54951b2b27a0c809c285609304f3/src/gmail/providers.ts#L143)
  uses Responses and maps non-OK responses to coarse errors without inspecting
  those codes or headers in this method.
- **Direction:** ADOPT.
- **Verification:** NOT_TESTED against those responses; code inspection only.
- **Human decision:** PENDING.
- **Outcome / next step:** PAW inference: distinguish the new provider failure
  categories when a bounded reliability change is authorized. Check outer retry
  ownership, cancellation and duplicate-write protection before implementing any
  retry. Test with mocked 429/503 responses; do not send mail or paid model calls.

**W20260910-04 — Repository and production evidence mismatch**

- **Finding:** The pinned GitHub resume record predates the separately confirmed
  production release described in the run header. This is a PAW change/revisit
  trigger, not an OpenAI announcement or a proof that production is unhealthy.
- **Direction:** DOUBLE-DOWN on attributable architectural and deployment evidence.
- **Verification:** LIVE_VERIFIED only for the interactive pinned GitHub read;
  production release evidence is reused from 04:56 UTC and user acceptance.
- **Human decision:** PENDING for reconciliation work beyond this Watch package.
- **Outcome / next step:** Keep both versions in every affected report. Reconcile
  source and release records through the development workflow, preserving today's
  user edits and GitHub's README changes. Revisit when those records are published.

### Coverage and unchanged findings

| Source actually read | Scope/result |
| --- | --- |
| [ChatGPT/Codex changelog](https://learn.chatgpt.com/docs/changelog) | September 1–9 release summaries through CLI 0.154.0; Codex changelog URL redirects here. Editing/mobile/model-picker changes do not by themselves change PAW ownership. |
| [API changelog](https://developers.openai.com/api/docs/changelog) | September 1–8 entries. Cache diagnostics, Astra controls and image releases screened; no model migration, image workflow or cache instrumentation is currently accepted by this report. |
| [Plugin UI changelog](https://developers.openai.com/plugins/changelog) | Latest entry August 21; CIMD remains PREVIOUSLY_REPORTED with issuer conditions, not a new September change. |
| [Scheduled Tasks](https://learn.chatgpt.com/docs/automations) | Current cloud/local context and run-access conditions; feeds W20260910-01. |
| [Plugins](https://learn.chatgpt.com/docs/plugins) | Current distribution/surface constraints; feeds W20260910-02. |
| [Memories](https://learn.chatgpt.com/docs/customization/memories) | PREVIOUSLY_REPORTED recall/rules distinction; no verified domain-record replacement. |
| [Optional MCP UI](https://developers.openai.com/plugins/build/chatgpt-ui) | PREVIOUSLY_REPORTED optional UI; current web editor remains accepted, replacement scenario NOT_TESTED. |
| [Workspace Agent triggers](https://developers.openai.com/workspace-agents/trigger-runs) | PREVIOUSLY_REPORTED trigger contract; API cannot retrieve the agent response, beta status is not domain acceptance. No API integration proposed for this small Watch. |

The `.md` variant of the Scheduled Tasks page returned an unsupported-content-type
error; its HTML page was successfully read. No required source remains missing.
These results do not claim every official post, PR or undocumented change was read.
The prior Gmail adapter and identity conditions stay open with their recorded
revisit gates; no new replacement evidence was found in this scope.

### Verification and runtime handoff

The bundled Skill validator could not start because its Python environment lacks
PyYAML; this is not reported as a passing check. Frontmatter, references, unchanged
release manifest and realistic procedure cases are checked separately in the
development session. No application tests, deployment or business writes are
needed for the Skill/report-only package. Actual scheduled acceptance and the
retrieval cutoff are appended after the runtime attempt; they are not implied by
the completed manual report.

The independent publication branch is `codex/openai-watch-execution-v1`, based
on the pinned GitHub main and reviewed as [draft PR #20](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/20).
It contains only the two Skill files, this Watch update and its existing index
entry; the GitHub README restructuring and all local UI work are preserved.
The fixed procedure version for cloud parity is
`40966964468a0dbe9f2fecc0068280482c0d0cb7`, while the PAW comparison baseline remains
`40b1bf8d115c54951b2b27a0c809c285609304f3`. This is a development trial, not an
installed plugin or an accepted merge into main.

Local validation passed for the two plain-scalar frontmatter fields, name/length
bounds, 20 local file references and the byte-normalized unchanged Job Search
release manifest. Both published Skill files were fetched at the fixed trial SHA
through the GitHub connector and matched their local UTF-8 contents exactly.
Whitespace checks passed. The separate bundled-validator dependency failure
above remains disclosed.

Procedure walkthrough (manual reasoning checks, not extra application tests):
an unchanged CIMD announcement maps to PREVIOUSLY_REPORTED; a PAW-only production
change triggers re-review; a missing required source returns INCOMPLETE without
advancing the cutoff; ADOPT/NOT_TESTED/DEFERRED does not become IGNORE; instructions
inside a retrieved source do not authorize writes. The actual baseline run also
exercised repository/production separation and new-fact versus inference reporting.
Scheduled parity remains the independent behavioral check.

An isolated packaging smoke copied the current Skills into a temporary Git
fixture and ran the unchanged packager. After normalizing Windows CRLF in that
fixture to its committed LF bytes, it passed and produced exactly the two existing
Job Search packages; Watch was not included. The initial byte mismatch concerned
an unchanged existing Skill, not the new procedure. No packaging implementation
or source-repository Git metadata was changed.

The authorized setup session created one one-off ChatGPT Work task,
**OpenAI Platform Watch — 验收**, for September 10 at 15:56 Australia/Sydney.
Its [setup conversation](https://chatgpt.com/c/6aa245c5-ccdc-83ec-b6bb-86d22bb88c47)
and a separate Scheduled-page editor confirmed the title, 15:56 time, both pinned
SHAs, eight-source reference, cutoff, disclosed production supplement and read-only
restrictions. No other task was changed. The creation acknowledgement alone was
not counted as acceptance; the actual result and comparison follow.

### Actual scheduled acceptance — September 10

The [one-off task and full delivered report](https://chatgpt.com/scheduled/6aa245ff60688191aee442beb3a181a1)
were observed first as running and then completed, without using Run now. The
clock trigger was 15:56 Australia/Sydney; the report records retrieval from
05:56–06:00 UTC and was inspected in the foreground at 06:02–06:04 UTC.
It returned COMPLETE - MATERIAL FINDING. Its reported Skill blob SHAs
`65ccedad77a930691e7c5595a02aa6940ab0859b` and
`1415214e8ef946786c75fe03cadc7bcb3bf6538e` match the independently fetched files.
It retained both specified commit SHAs and the manual run's release cutoff.

The scheduled runner correctly left parity NOT_TESTED because it had not been
given the manual report. The following comparison is the foreground developer's
subsequent acceptance evidence, not a claim made by the scheduled runner itself.

| Acceptance gate | Observed result and limit |
| --- | --- |
| Retrieval | Report delivered with all eight required official sources covered. Failed searches and Markdown fallback reads were disclosed; corresponding HTML reads completed the declared coverage. No mandatory source remained missing. |
| Repository baseline | Full fixed PAW SHA and separate trial-Skill SHA retained; matching Skill blobs reported. Local production supplement remained separate from GitHub evidence. |
| Delta | Existing Memory, CIMD and agent-trigger boundaries remained previously reported. Plugin/API changes and PAW-only revisit conditions were distinguished. |
| Reasoning | Platform availability was not treated as PAW acceptance. All proposals remained PENDING; no REMOVE recommendation or automatic replacement followed. |
| Governance | Delivered artifact is a read-only report; it reports no repository, Workspace, production or task mutations. This does not constitute an audit of every platform-internal action. |
| Scheduled parity | PASS for core material conclusions at the same baseline/window, with the correspondence and additions below. This is one observed run, not a reliability history. |

Manual W20260910-02 corresponds to scheduled F3 (native plugin/client changes),
and W20260910-03 to F4 (API error classification). Both preserve target verification
as outstanding. Manual W20260910-04 is explicitly preserved in the scheduled
production-evidence appendix, although not promoted to a separate finding.
For W20260910-01, the scheduled execution now supplies the missing evidence for
this read-only Watch scenario; scheduled F2 explicitly refuses to extend that
success to the unresolved Job Tracker write/receipt workflow. Both runs reach
NO DRIFT as an advisory boundary conclusion and retain current domain authority.

The scheduled report additionally proposes F1, revisiting MCP Apps for the now
concrete resume scenario, and F2, reconciling September 9 manual-mail acceptance
with older Watch wording. These are useful additional review candidates, not
contradictory replacement decisions: existing Web remains and daily write
acceptance remains unresolved. They remain PENDING; neither is accepted for
implementation by this execution check. F3 calls the latest plugin change NEW
where the manual report says CHANGED; the substantive recommendation agrees,
but future reports should link this existing finding and use CHANGED for a
material update to it, or PREVIOUSLY_REPORTED if unchanged.

Execution-quality acceptance is scoped to the six gates above. The manual baseline
and this comparison establish `2026-09-10T05:50:14Z` as the reviewed execution
cutoff for subsequent delta scans; strategic decisions remain PENDING. No M4
observation period or Job Tracker business-write acceptance is activated.
### Weekly operation

**OpenAI Platform Watch — 每周** is enabled in the existing ChatGPT Work
[task conversation](https://chatgpt.com/c/6aa245c5-ccdc-83ec-b6bb-86d22bb88c47),
every Tuesday at 09:00 Australia/Sydney, first run September 15. The saved task
editor independently showed weekly / Tuesday / 09:00 / September 15, an enabled
Pause control, and the complete six-part prompt. The completed one-off task and
all unrelated tasks were retained.

Each run resolves fresh main once and uses the fixed procedure commit above.
Until a newer reviewed scan is available in main, it explicitly reads the
reviewed execution record at `9a4e047e496e5f3b0d780536f9bfdb61e8bfebf8`; that
development-branch record is never presented as main. It retains the reviewed
cutoff, uses accessible task history only for deduplication, reports review
backlog or missing history, and proposes a new cutoff without writing the ledger.
This pins the usable procedure while PR #20 awaits merge. Updating that pin is
foreground maintenance, not authority granted to a Watch run.

The report is delivered to this ChatGPT task conversation as a one-minute Chinese
summary with an evidence appendix. Scheduled recurrence is configured, but its
first weekly result and longer-term reliability have not yet been observed.

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
