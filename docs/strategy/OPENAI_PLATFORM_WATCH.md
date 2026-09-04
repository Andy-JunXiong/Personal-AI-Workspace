# OpenAI Platform Watch

**Status:** ADVISORY  
**Adopted:** 2026-09-04  
**Last reviewed:** 2026-09-04

## Purpose

Track only OpenAI and ChatGPT platform changes that could alter the product
boundary, roadmap, architecture, or distribution path of Personal AI Workspace.

This is not an AI-news log. Every entry must answer:

> What does this change alter for Personal AI Workspace?

The watch belongs in this repository because it governs this product's scope.
It is not a separate project or intelligence pipeline.

## Stable product boundary

**ChatGPT owns:**

- primary interaction, general reasoning, and generic intelligence;
- platform connectors and source access;
- generic automation primitives where sufficiently reliable; and
- the host surface for compatible embedded UI.

**Personal AI Workspace owns:**

- authoritative domain state, lifecycle, and invariants;
- provenance, evidence relationships, and mutation authority;
- version history, concurrency control, and durable coordination;
- domain-specific operational models; and
- formal inspection and control surfaces where conversation is insufficient.

External providers own their native facts. Workspace stores only the minimum
references, evidence, and cross-system state needed for the domain workflow.

Implementation boundaries may move. The thesis must not drift in response to
individual releases.

## M4 constraint

The feature freeze remains authoritative through the Day 28 decision in
[M4 Real Use Evaluation](../dogfood/M4_REAL_USE_EVALUATION_v0.2.md).

This document is advisory only. An entry does not authorize a runtime feature,
schema migration, connector, scheduler, MCP tool, model call, automatic
admission, metric change, or retrospective M4 rescore. Before Day 28, only
safety and correctness defects may change the frozen runtime under the existing
M4 rules.

## Watch scope

| Category | Watch | Boundary question |
| --- | --- | --- |
| **Interaction / UI** | Interactive UI, MCP Apps, inline/full-screen views, deep links, navigation | Can ChatGPT host the domain inspection and control surface while Workspace owns state and rules? |
| **Persistent State** | Memory, Projects, structured/versioned objects, long-running state, recovery/export | Is this authoritative domain state or only contextual recall? |
| **Automation** | Scheduled tasks, event triggers, monitoring, background agents | Can generic triggering be delegated without delegating domain truth or admission? |
| **Connectors / Sync** | Gmail, Drive, Calendar, GitHub, browser, indexing, sync | Can ChatGPT use provider-native facts/actions without a duplicate Workspace connector? |
| **Ecosystem / Distribution** | Plugins, MCP, auth, permissions, publishing, packaging, monetization | Can the OpenAI ecosystem host and distribute Workspace as a domain/state product? |

A state capability threatens the thesis only when it supports addressable
structured objects, domain invariants, explicit mutation authority, version
history or concurrency, durable readback, and recovery.

Workspace Today remains a deterministic domain query and classifier. It is not
a generic scheduler.

## Evidence and maturity

Use official OpenAI documentation or official release notes as the primary
source. Do not change the roadmap from social posts, commentary, rumours, or
generic AI news.

Every entry records:

- **Availability:** ANNOUNCED, PREVIEW, ELIGIBLE-PLANS, or GA;
- **Workspace scenario verified:** YES, NO, or NOT APPLICABLE; and
- the official source URL.

An announcement may justify observation or an experiment. It does not justify
removing a Workspace responsibility. Predictions may influence implementation
reversibility, but cannot remove an accepted roadmap item.

## Decision labels

Each entry has one primary decision.

| Decision | Meaning |
| --- | --- |
| **IGNORE** | A major or easily confused change was reviewed and does not alter the boundary or roadmap. |
| **ADOPT** | Use the platform capability; do not duplicate its generic implementation. |
| **REMOVE** | Remove an accepted Workspace responsibility or roadmap item because the platform replaces it. |
| **DOUBLE-DOWN** | The change increases the value of a Workspace-owned domain, state, evidence, authority, or coordination capability. |

If one release affects two different capabilities, add a short **Secondary
implication**. Example: ADOPT a platform event trigger; DOUBLE-DOWN on Workspace
admission and lifecycle enforcement.

### REMOVE gate

Use REMOVE only after confirming:

1. the capability is available in the intended environment;
2. the Workspace scenario has been tested;
3. reliability, permissions, failure visibility, and run history are adequate;
4. domain invariants and explicit authority remain enforceable;
5. recovery, export, or a viable fallback exists; and
6. an accepted Workspace responsibility actually exists to remove.

If Workspace never accepted the capability, use ADOPT with “do not build,” not
REMOVE.

## Cadence

### Weekly platform scan

Spend at most 15–20 minutes on official ChatGPT, Memory/Projects, automation,
Plugins/MCP/UI, connector, and developer-platform updates.

No entry is the normal result. A scheduled scan may draft a candidate finding,
but must not modify the repository or create an ADR automatically.

### Monthly architecture boundary review

Run only when the month contains a material entry. Answer:

- What changed?
- What did the platform absorb?
- What can Workspace stop implementing?
- What became easier?
- What still belongs to Workspace?
- Has the thesis changed?

Record one conclusion:

| Conclusion | Meaning |
| --- | --- |
| **NO DRIFT** | Thesis and Workspace-owned capability set remain unchanged. |
| **NARROW** | Workspace-owned implementation scope becomes smaller. |
| **EXPAND** | A platform change justifies an additional Workspace-owned capability. |
| **REPOSITION** | The thesis or ecosystem role must materially change. |

ADOPT can still result in NO DRIFT when the current architecture already
delegates that capability.

### Major release review

Review immediately when OpenAI materially changes authoritative structured
state, versioned objects, formal domain workflows, rich custom UI, automation
runtime, major connectors, or plugin distribution/authentication.

## Relationship to ADRs

Platform change → Platform Watch → impact review → ADR only if the architecture
must change → implementation.

A Watch entry is a candidate decision. Only an accepted ADR may change an
established architecture boundary.

## New-feature ownership test

Before adding a feature, ask:

1. Does the OpenAI platform already provide it?
2. Is it officially announced, available, and verified, or only predicted?
3. Is it generic platform capability or domain-specific operational value?
4. If GPT became ten times more capable, would authoritative state, lifecycle,
   evidence, authority, or coordination still be required?
5. Can implementation remain small and reversible until verified?

Prefer the platform for generic reasoning, recall, search, scheduling,
connectors, and chat UI. Prefer Workspace for domain state, lifecycle, evidence,
authority, version history, deterministic domain rules, coordination, and
formal inspection/control.

## Entry template

~~~markdown
## YYYY-MM-DD — Change title

Official source: <URL>
Availability: ANNOUNCED / PREVIEW / ELIGIBLE-PLANS / GA
Workspace scenario verified: YES / NO / NOT APPLICABLE
Category: Interaction / UI | Persistent State | Automation |
  Connectors / Sync | Ecosystem / Distribution
Affected Workspace boundary: <specific capability or roadmap item>

Change: <one sentence>
Workspace implication: <one or two sentences>
Decision: IGNORE / ADOPT / REMOVE / DOUBLE-DOWN
Secondary implication: <optional>
Action now: NONE / EXPERIMENT / ADR CANDIDATE
Revisit trigger: <concrete condition>
Architecture review required: YES / NO
~~~

Do not write a long news summary.

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
