# ADR-007 — Identity and authentication boundary

**Status:** Accepted for Spike 1A

## Decision
Domain identity uses a principal mapped to a workspace.

Spike 1A uses one configured development principal.

Do not build login, RBAC, OAuth administration, or user-management UI for Spike 1A.

Public or multi-user access requires a proper authentication boundary later.

The configured identity is `(issuer, subject)` and maps to exactly one
Workspace. It is suitable only for a private development connection. A public
endpoint containing private data or write tools requires a separately approved
authentication design. Production OAuth can later map token claims to the same
Principal model without changing the Workspace domain.
