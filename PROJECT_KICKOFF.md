# Project Kickoff — Personal AI Workspace v0.1

## Status

**CHATGPT-NATIVE SPIKE 1A = COMPLETE**

**SPIKE 1B = DESIGNED, NOT IMPLEMENTED, PLATFORM GATE NOT RUN**

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
- [ ] Spike 1B implementation
- [ ] Spike 1B manual ChatGPT cross-app platform gate
- [ ] MVP implementation plan
- [ ] MVP build
- [ ] E2E evidence

## Immediate Next Step

**Review and approve the documented Spike 1B plan. If approved, implement only
the narrow Job Application lookup delta, then run the manual Gmail -> ChatGPT ->
Workspace platform gate. Do not add a Gmail connector or broader MVP scope.**
