# Personal AI Workspace

> Working name.

## Thesis

**Build a persistent work-state layer for ChatGPT that turns conversations and external events into long-running goals, projects, tasks, actions, and outcomes.**

## Core Principle

> **Conversation is an interface, not the system of record.**

## Architecture

- **ChatGPT = primary interaction + reasoning host**
- **Workspace = persistent state + coordination**
- **Connected services = source facts + capabilities**
- **MCP / Apps SDK = integration surface**

## MVP

First domain: **Job Search**

First proof: **cross-conversation continuity**.

A recruiter message is interpreted in one ChatGPT conversation, the Job Application state is persisted in the Workspace, and a later conversation can continue from the same durable state without reconstructing prior chats.

## Spike status

Spike 1A is complete and frozen. The repository also implements the approved
local Spike 1B delta:

- a Streamable HTTP MCP endpoint at `/mcp`,
- one configured development Principal and Workspace,
- one seeded Job Application,
- separate observation, proposal, and explicit-user admission commands,
- SQLite persistence, optimistic concurrency, and command idempotency.
- one read-only exact Job Application lookup scoped to the current Workspace.

Spike 1B local implementation and automated verification are complete. Its
manual Gmail + Workspace ChatGPT platform gate remains `NOT_RUN`. Gmail remains
a ChatGPT-connected source app and is not integrated into Workspace. UI,
external connectors, background automation, and model API calls remain out of
scope.

The approved Spike 1B plan is in
[`docs/mvp/INTEGRATION_SPIKE_1B_PLAN_v0.1.md`](docs/mvp/INTEGRATION_SPIKE_1B_PLAN_v0.1.md).

### Local setup

```text
npm install
npm run seed
npm run dev
```

The seeded Project ID is printed by `npm run seed`. Use `/healthz` for a basic
health check and `/mcp` with MCP Inspector or a ChatGPT development connection.

### Verification

```text
npm run verify
```

Local tests prove domain, persistence, idempotency, and MCP protocol behavior.
They do not prove ChatGPT Developer mode, Secure MCP Tunnel, write-confirmation,
or cross-conversation behavior; those require separate manual ChatGPT evidence.
