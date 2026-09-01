# System Context v0.1

```mermaid
flowchart TD
    U[User] --> C[ChatGPT]

    C --> SA[Connected Source Apps]
    SA --> G[Gmail]
    SA --> D[Drive]
    SA --> CAL[Calendar]
    SA --> O[Other Services]

    C --> WA[Personal AI Workspace App<br/>MCP / Apps SDK]
    WA --> WS[(Workspace State Store)]

    WS --> WA
    WA --> C

    WA -. optional later .-> DI[Direct Integration Layer]
    DI -. OAuth / Webhook / Polling .-> G
    DI -. OAuth / Webhook / Polling .-> D
    DI -. OAuth / Webhook / Polling .-> CAL
```

## Ownership

### ChatGPT
- interaction surface,
- general reasoning,
- cross-app orchestration,
- presentation.

### Connected Source Apps
- source-system access,
- retrieval/actions exposed to ChatGPT.

### Workspace
- Goals,
- Projects,
- Tasks,
- Resource references,
- lifecycle state,
- Actions,
- Outcomes,
- state transition history.

### External Systems
Remain authoritative for their native facts.

Example:

```text
Gmail owns the email.
Calendar owns the event.
Workspace owns the interpretation of how those facts affect the user's work.
```

## Boundary Rule

By default, Resource stores:

```text
provider
external reference
key metadata
observed facts
optional evidence snapshot
```

It does not mirror an entire external system.
