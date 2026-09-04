# OpenAI Platform Watch

**Status:** ADVISORY  
**Adopted:** 2026-09-04  
**Last reviewed:** 2026-09-04

## Purpose

Track only OpenAI and ChatGPT platform changes that could alter the product
boundary, roadmap, architecture, or distribution path of Personal AI Workspace.

This is not an AI-news log. Every entry must answer:

> What does this change alter for Personal AI Workspace?

The watch exists inside this repository because the result governs this
product's scope. It is not a separate product or intelligence pipeline.

## Governing boundary

The stable product boundary remains:

**ChatGPT owns:**

- primary interaction;
- general reasoning and generic intelligence;
- platform-provided connectors and source access;
- generic automation primitives where they are sufficiently reliable; and
- the host surface for compatible embedded UI.

**Personal AI Workspace owns:**

- authoritative domain state;
- domain lifecycle and invariants;
- provenance and evidence relationships;
- mutation authority and admission;
- version history and concurrency control;
- durable coordination;
- domain-specific operational models; and
- formal inspection and control surfaces when conversation alone is
  insufficient.

**External providers own their native facts.** Gmail, Drive, Calendar, GitHub,
and other providers remain authoritative for their own records. Workspace
stores only the minimum evidence, references, and cross-system state needed for
the domain workflow.

Implementation boundaries may move as the platform changes. The product thesis
must not drift in response to individual releases.

## M4 constraint

The active M4 feature freeze remains authoritative through the Day 28 decision
defined in
[the real-use evaluation](../dogfood/M4_REAL_USE_EVALUATION_v0.2.md).

This document is advisory only. A Platform Watch entry does not authorize:

- a runtime feature;
- a schema migration;
- a connector or scheduler;
- a new MCP tool;
- a model call;
- automatic admission;
- a change to frozen evaluation metrics; or
- retrospective rescoring of M4 evidence.

Before the Day 28 decision, only safety and correctness defects may change the
frozen runtime under the existing M4 rules.

## Scope

Record only changes in these five categories.

### A. Interaction / UI

Watch interactive and contextual UI, MCP Apps or equivalent embedded views,
full-screen and inline presentation, deep linking, navigation, and
domain-specific interface capabilities.

**Boundary question:** Can ChatGPT host the inspection, confirmation, and
navigation surface that the domain needs, while Workspace continues to own the
underlying state and rules?

### B. Persistent State

Watch Memory, Projects, structured objects, versioned objects, long-running
work state, history, recovery, export, and inspection controls.

**Boundary question:** Does the platform now provide genuinely authoritative,
structured, addressable, versioned domain state rather than helpful contextual
recall?

This is a thesis-level risk only if the platform capability can enforce domain
invariants, explicit mutation authority, concurrency, version history, durable
readback, and recovery.

### C. Automation

Watch scheduled tasks, event triggers, conditional monitoring, background
execution, recurring workflows, and agent runtime primitives.

**Boundary question:** Can Workspace delegate generic triggering and execution
without delegating domain truth, lifecycle validation, or admission authority?

Workspace Today remains a deterministic domain query and classifier. It is not
a generic scheduler.

### D. Connectors / Sync

Watch Gmail, Drive, Calendar, GitHub, browser, web, third-party apps, indexing,
sync, and provider event access.

**Boundary question:** Can ChatGPT obtain the source fact or perform the
provider-native action reliably enough that Workspace does not need a duplicate
connector layer?

### E. Ecosystem / Distribution

Watch Plugins, MCP, plugin directories, authentication, permissions,
publication, reusable workflow packaging, and monetization.

**Boundary question:** Is the OpenAI ecosystem becoming a viable distribution
and host layer for Personal AI Workspace as a domain/state product?

## Evidence and maturity

Use official OpenAI documentation or official OpenAI release notes as the
primary source. Do not make a roadmap decision from social posts, commentary,
rumours, or generic AI news.

Each entry records:

- **Availability:** ANNOUNCED, PREVIEW, ELIGIBLE-PLANS, or GA;
- **Workspace scenario verified:** YES, NO, or NOT APPLICABLE; and
- an official source URL.

An announced or preview capability may justify observation or an experiment.
It does not by itself justify removing a Workspace responsibility.

Speculation about what GPT may provide soon can influence implementation
reversibility, but cannot remove an accepted roadmap item.

## Decision labels

Each entry has one primary decision.

| Decision | Meaning |
| --- | --- |
| **IGNORE** | A major or easily confused change was reviewed and does not alter the Workspace boundary or roadmap. |
| **ADOPT** | Use the platform capability as a dependency; do not duplicate its generic implementation in Workspace. |
| **REMOVE** | Remove an already accepted Workspace responsibility or roadmap item because the platform now replaces it. |
| **DOUBLE-DOWN** | The platform change increases the importance of a Workspace-owned domain, state, evidence, authority, or coordination capability. |

When one platform change affects two different Workspace capabilities, record
one primary decision and an optional **Secondary implication**. For example:

- primary decision: ADOPT the platform event trigger;
- secondary implication: DOUBLE-DOWN on Workspace admission and lifecycle
  enforcement.

### REMOVE gate

REMOVE is deliberately harder than ADOPT. Before using it, confirm that:

1. the capability is available to the intended user and environment;
2. the relevant Workspace scenario has been tested;
3. reliability, permissions, failure visibility, and operating history are
   adequate;
4. domain invariants and explicit authority remain enforceable;
5. recovery, export, or a viable fallback exists; and
6. an accepted Workspace responsibility or roadmap item actually exists to
   remove.

If Workspace never accepted the capability, use ADOPT with a “do not build”
implication rather than claiming that something was removed.

## Operating cadence

### Weekly platform scan

Spend no more than 15–20 minutes reviewing official OpenAI sources, including:

- ChatGPT and ChatGPT Work updates;
- Memory and Projects;
- Scheduled Tasks and automation;
- Plugins, MCP, and UI;
- connectors and sync; and
- developer-platform changes that affect the Workspace integration boundary.

No entry is the normal result when nothing materially affects Workspace.

A scheduled scan may prepare a candidate assessment, but it must not
automatically modify this repository or create an ADR.

### Monthly architecture boundary review

Run only when the month contains at least one material entry. Answer:

1. What changed in GPT this month?
2. What capability did the platform absorb?
3. What can Workspace stop implementing?
4. What became easier to build?
5. What still clearly belongs to Workspace?
6. Has the thesis changed?

Record exactly one conclusion:

| Conclusion | Meaning |
| --- | --- |
| **NO DRIFT** | The thesis and Workspace-owned capability set remain unchanged. |
| **NARROW** | The Workspace-owned implementation boundary becomes smaller. |
| **EXPAND** | A platform change makes an additional Workspace-owned domain capability justified. |
| **REPOSITION** | The product thesis or ecosystem role must materially change. |

ADOPT can still result in NO DRIFT when the current architecture already
delegates that capability to ChatGPT.

### Major release review

Do not wait for the monthly review when a release introduces or materially
changes:

- authoritative structured state;
- versioned persistent objects;
- formal domain workflows;
- rich custom domain UI;
- automation or runtime primitives;
- major connector behavior; or
- plugin/app distribution, authentication, or permissions.

## Relationship to ADRs

Do not create an ADR for every platform announcement.

~~~text
OpenAI platform change
        |
        v
OpenAI Platform Watch entry
        |
        v
Evidence and impact review
        |
        v
Architecture change actually required?
        |
        +-- No --> No ADR
        |
        +-- Yes --> New ADR --> Architecture / implementation
~~~

A Platform Watch entry identifies a candidate decision. Only an accepted ADR
may change an established architecture boundary.

## New-feature ownership test

Before adding a new feature, ask:

1. Does the OpenAI platform already provide it?
2. Is it officially announced, available, and verified, or merely predicted?
3. Is it generic AI/platform capability or domain-specific operational value?
4. If GPT became ten times more capable tomorrow, would this feature still need
   authoritative state, lifecycle, evidence, authority, or coordination?
5. Can the implementation remain small and reversible until the platform
   boundary is verified?

Prefer the platform for generic reasoning, contextual recall, search,
scheduling, connectors, and chat UI.

Prefer Workspace for domain state, lifecycle, evidence, authority, version
history, cross-system coordination, deterministic domain rules, and formal
inspection or control.

## Entry template

~~~markdown
## YYYY-MM-DD — Change title

Official source:
<URL>

Availability:
ANNOUNCED / PREVIEW / ELIGIBLE-PLANS / GA

Workspace scenario verified:
YES / NO / NOT APPLICABLE

Category:
Interaction / UI | Persistent State | Automation | Connectors / Sync |
Ecosystem / Distribution

Affected Workspace boundary:
<Specific capability or accepted roadmap item>

Change:
<One sentence>

Workspace implication:
<What Workspace should stop doing, adopt, or emphasize>

Decision:
IGNORE / ADOPT / REMOVE / DOUBLE-DOWN

Secondary implication:
<Optional>

Action now:
NONE / EXPERIMENT / ADR CANDIDATE

Revisit trigger:
<Concrete condition that would justify reassessment>

Architecture review required:
YES / NO
~~~

Do not write a long news summary.

## Baseline — 2026-09-04

### 2026-09-04 — Memory remains a recall layer

Official source:
https://learn.chatgpt.com/docs/customization/memories

Availability:
ELIGIBLE-PLANS

Workspace scenario verified:
NOT APPLICABLE

Category:
Persistent State

Affected Workspace boundary:
Authoritative domain state and durable rules

Change:
OpenAI documents Memory as cross-chat recall and explicitly advises keeping
required guidance in checked-in documentation rather than relying on Memory as
the only source.

Workspace implication:
Memory can improve interaction context, but it does not replace versioned domain
objects, lifecycle invariants, evidence, concurrency, or admission authority.

Decision:
DOUBLE-DOWN

Secondary implication:
Continue to use ChatGPT context and Memory where helpful without treating them
as the system of record.

Action now:
NONE

Revisit trigger:
OpenAI exposes structured, addressable, versioned persistent objects with
domain validation, mutation authority, and durable recovery guarantees.

Architecture review required:
NO

### 2026-09-04 — Scheduled and event-triggered tasks

Official source:
https://learn.chatgpt.com/docs/automations

Availability:
ELIGIBLE-PLANS

Workspace scenario verified:
NO

Category:
Automation

Affected Workspace boundary:
Generic scheduling, polling, and provider-event triggering

Change:
ChatGPT supports recurring background tasks and, on eligible plans, event
triggers from Gmail, Slack, and GitHub.

Workspace implication:
Use ChatGPT automation for generic triggering when it proves reliable. Do not
add a generic Workspace scheduler or polling runtime. Preserve Workspace-owned
lifecycle validation, deterministic Today classification, evidence, and
admission.

Decision:
ADOPT

Secondary implication:
DOUBLE-DOWN on domain authority and observable transition handling as more
external signals become available.

Action now:
NONE

Revisit trigger:
A post-M4 workflow requires background execution and passes a controlled
Workspace scenario test.

Architecture review required:
NO

### 2026-09-04 — MCP Apps embedded UI

Official source:
https://developers.openai.com/plugins/build/chatgpt-ui

Availability:
GA

Workspace scenario verified:
NO

Category:
Interaction / UI

Affected Workspace boundary:
Domain-specific inspection and control surfaces

Change:
ChatGPT can render MCP Apps UI inline or full-screen for structured inspection,
comparison, editing, confirmation, and navigation.

Workspace implication:
Prefer ChatGPT-hosted MCP Apps UI over an independent generic application shell.
Workspace should still own the underlying state, lifecycle, evidence, and
control rules, and its tools must remain usable without UI.

Decision:
ADOPT

Secondary implication:
DOUBLE-DOWN on domain-specific formal surfaces where conversation is
insufficient.

Action now:
NONE

Revisit trigger:
The post-M4 roadmap accepts its first domain UI slice.

Architecture review required:
NO

### 2026-09-04 — Shared plugin ecosystem

Official source:
https://learn.chatgpt.com/docs/plugins

Availability:
GA

Workspace scenario verified:
NO

Category:
Ecosystem / Distribution

Affected Workspace boundary:
Packaging, discovery, installation, and distribution

Change:
ChatGPT and Codex use a shared plugin catalog, and plugins can package skills,
connectors, MCP servers, UI, hooks, and scheduled-task templates.

Workspace implication:
Treat the OpenAI plugin ecosystem as the preferred future host and distribution
path. Do not build a separate product entry point merely for discoverability
before real utility and adoption are proven.

Decision:
ADOPT

Secondary implication:
The ecosystem strengthens the possible role of Workspace as a reusable
domain/state layer rather than a competing assistant.

Action now:
NONE

Revisit trigger:
M4 reaches CONTINUE and productization or multi-user distribution becomes an
accepted objective.

Architecture review required:
NO

## Current boundary conclusion

**Conclusion: NO DRIFT**

As of 2026-09-04, platform improvements reduce the need for generic connectors,
schedulers, standalone navigation, and distribution infrastructure. They do not
replace authoritative domain state, lifecycle, provenance, explicit authority,
version history, or durable coordination.

The current repository already delegates the affected generic capabilities to
ChatGPT or keeps them outside the frozen MVP. No runtime feature or existing
architecture responsibility should be removed during M4.
