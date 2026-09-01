# Project Kickoff — Personal AI Workspace v0.1

## Status

**CHATGPT-NATIVE SPIKE 1A = COMPLETE**

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
- [ ] MVP implementation plan
- [ ] MVP build
- [ ] E2E evidence

## Immediate Next Step

**Hold at the completed Spike 1A boundary. Review the verified results and make
a separate scope decision before beginning Spike 1B or broader MVP work.**
