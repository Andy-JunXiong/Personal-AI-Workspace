# Project Kickoff — Personal AI Workspace v0.1

## Status

**CHATGPT-NATIVE SPIKE 1A = COMPLETE**

**SPIKE 1B = COMPLETE — FUNCTIONAL AND PRIVACY GATES SUPPORTED**

## Thesis

> Build a persistent work-state layer for ChatGPT that turns conversations and external events into long-running goals, projects, tasks, actions, and outcomes.

## Architecture Position

```text
ChatGPT = Interface + General Reasoning + Orchestration
Workspace = Persistent Work State + Coordination
Connected Services = Source Facts + Capabilities
MCP / Apps SDK = Bridge
```

## Current Architecture Decision

**MVP is ChatGPT-native and continuity-first.**

The Workspace will not initially rebuild Gmail/Drive/Calendar connectors. The first proof uses ChatGPT's available connected-app surface plus the custom Workspace app where supported.

## Phase Gates

- [x] Project thesis
- [x] Problem / non-goals
- [x] System boundary
- [x] Architecture Review v0.1
- [x] Logical Architecture v0.1
- [x] State/Event Flow v0.1
- [x] State Model v0.1 proposed
- [x] State Model review
- [x] ChatGPT Integration Spike — local and manual ChatGPT-native Spike 1A verified
- [x] Spike 1B architecture review and smallest-scope design
- [x] Spike 1B implementation
- [x] Spike 1B functional ChatGPT cross-app E2E
- [x] Spike 1B fresh-DB privacy/data-minimization rerun
- [x] Spike 1B final verification
- [x] Real Job Search MVP implementation plan approved with M1/M2/M3 gates
- [ ] MVP build — M1 duplicate-protection smoke gate FAILED / DEFECT FOUND; local fix verified, fresh-DB platform retest pending
- [ ] E2E evidence

## Immediate Next Step

**Spike 1B remains frozen at `spike-1b-cross-app-verified-v0.1`. Execute the
approved Real Job Search MVP one slice at a time. Do not begin M2 until M1 has
passed its duplicate-protection platform retest and received a readiness
decision.**
