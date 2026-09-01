# ADR-006 — Integration Spike runtime and persistence

**Status:** Accepted for Spike 1A

## Decision
For Spike 1A use:
- TypeScript strict mode
- official MCP SDK
- Streamable HTTP
- SQLite
- modular monolith
- no ORM
- no UI
- no LLM gateway

## Rationale
The spike should prove durable state and ChatGPT integration with minimal infrastructure.

## Consequences

The logical components remain modules in one deployable process. SQLite is
sufficient for a single-user, single-instance continuity proof. The MCP server
does not include a model API client, external connector, scheduler, event bus,
workflow engine, or background ingestion.
