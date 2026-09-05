# S1-01 — Local identity implementation and verification

**Date:** 2026-09-05 (Australia/Sydney).

**Status:** Local implementation and synthetic verification passed. Real Google
login, public authentication acceptance and deployment remain pending.

**Authority:** [Approved local S1 exception](S1_LOCAL_SCOPE_DECISION_2026-09-05.md).

## Implemented behavior

- `openid-client` 6.8.8 handles Google discovery and authorization-code login
  with PKCE, state, nonce, issuer/audience/expiry checks and explicit ID-token
  signature verification. The lockfile adds `oauth4webapi` 3.8.8 and updates the
  shared `jose` dependency to 6.2.12 as required by this client.
- A separate optional web listener binds to `127.0.0.1`, defaults off, enforces
  a fixed HTTPS host/origin and contains login, callback, session and CSRF-checked
  logout routes. No MCP or administration route is mounted on it.
- Unlinked identities receive no application session. Bootstrap is separately
  disabled by default. When enabled, verified claims produce a ten-minute pending
  reference for explicit local administration. Email equality never links users.
- Migration 004 adds identity links, atomic link/revocation audit and bounded
  pending identity records. Existing identity/Workspace/project rows are retained.
  Original migration files are unchanged.
- The operator command requires an existing external database and exact existing
  owner/Workspace target. Link creation, pending consumption and audit are atomic.
  Reassignment/reactivation of an existing link is refused.
- Sessions use random opaque Secure/HttpOnly/SameSite cookies. Only session-ID
  hashes and minimal identity metadata are held in process memory. Logout,
  inactivity/absolute expiry and link revocation invalidate access. Sessions do
  not survive process restart. OAuth tokens are neither exposed nor persisted.
- WorkspaceService accepts an immutable request identity alongside the legacy
  configured-identity adapter. Reads recheck ownership. Request-scoped services
  cannot initialize identities; WEB contexts reject legacy business mutations,
  including retries, until the separate S1 completion/audit package is implemented.
- Web-enabled startup resolves the existing identity rather than creating one.
  Invalid web configuration closes that surface while an existing MCP identity
  can still start. Provider-discovery failure cannot open the web listener.

The provider adapter and local administration command are trusted boundaries;
clients cannot supply a principal, Workspace or development grant to the web API.
This is a single-user association mechanism, not multi-user sign-up.

## Verification evidence

`npm.cmd run verify` passed with **17 files / 153 tests**, plus TypeScript checking
and production build. Existing 130 tests remain passing; 23 new tests cover
identity, protocol, HTTP, configuration and startup behavior.

| Area | Observed evidence |
| --- | --- |
| Existing state | Association resolves the original Workspace and preserves project readback and identity counts. |
| Operator boundary | Wrong target/actor, expired/reused pending reference and reassignment are rejected. CLI inspect/link/revoke passed on an external synthetic database; a missing database is not created. |
| Atomicity | Injected audit failure rolls back association and pending consumption. |
| Protocol | Synthetic HTTPS provider metadata and signed RSA ID tokens exercise the real OIDC library and token/JWKS processing, including PKCE-bound code exchange. |
| Rejection | Wrong issuer, audience or nonce, expired token, unverified email and forged signature issue neither session nor pending association. Missing browser cookie, duplicate state, replay, cancellation and expired login are rejected. |
| Sessions | Rotation invalidates the prior session; process-local state, inactivity and absolute lifetime hold; revocation is observed on the next request. |
| HTTP | Cookie flags, no-store, canonical-host checks, safe return routes, CSRF/origin enforcement and aggregate rate limits passed. Public MCP, health, admin and business-write paths are absent. |
| Isolation | Project/Today reads are ownership-scoped; another Workspace's data is denied; forged development mutation inputs cannot use the WEB context. |
| Startup | A local subprocess preserved MCP health with invalid web configuration. A web-enabled empty synthetic database retained zero principals/Workspaces and refused startup. |
| Compatibility | MCP discovery remains at 12 tools. Existing inventory/task/lifecycle/idempotency, persistence, backup and transport regressions pass. Backup verification recognizes migration 004. |

The initial transport harness tried overriding Host with Node fetch, which
rewrote that header and encountered the server's rejection. The harness now uses
Node's HTTP client to send the canonical host over loopback. Application host
validation was retained. No real provider credential or job-search data was used.

## Local operation

On Windows, use `npm.cmd` where execution policy blocks `npm.ps1`. Run
`npm.cmd run verify` for synthetic verification; fixtures create/clean their own
databases under the system temporary directory outside Git/OneDrive.

For later manual Google testing, use a separately prepared synthetic database
outside Git/OneDrive with an initialized synthetic principal. Set an explicit
`PAW_DB_PATH`; do not use the retained real-data default path. Configure:

```dotenv
PAW_WEB_ENABLED=true
PAW_WEB_WRITES_ENABLED=false
PAW_WEB_BOOTSTRAP_ENABLED=true
PAW_WEB_ORIGIN=https://<reviewed-test-hostname>
PAW_WEB_PORT=3001
PAW_GOOGLE_CLIENT_ID=<web-client-id>
PAW_GOOGLE_CLIENT_SECRET_FILE=<absolute-private-file>
```

These are examples, not executed public setup. Google registration and HTTPS
ingress remain separately reviewed. The callback is `/auth/google/callback`.
`/auth/start` starts login; an unlinked verified identity receives a pending ID.
The operator must inspect it and compare the verified account with the intended
user before linking. On the private host, after a build:

```text
node dist/scripts/web-identity-admin.js inspect --db <synthetic-db> --pending <id>
node dist/scripts/web-identity-admin.js link --db <synthetic-db> --pending <id> --principal <existing-principal> --workspace <existing-workspace>
```

Disable bootstrap and repeat login. `/api/v1/session` verifies the original
Workspace using the browser cookie. The script's `revoke` action takes `--db`,
`--issuer`, `--subject`, `--principal` and `--workspace`. Inspection output is
private operational data and must not enter Git or public logs.

## Limitations and next package

- Pending login transactions/sessions are in memory. Pending verified identities
  are database rows so another operator process can inspect them. They expire
  logically after ten minutes and are pruned on startup/authentication activity;
  consumption deletes them atomically. This refines P0's ephemeral-storage
  wording. Backups may retain these minimized claims under backup retention;
  no OAuth token is stored in them.
- Re-linking a revoked account is unavailable to avoid reviving old sessions.
  Account recovery needs a separate explicit administrative procedure.
- Object return paths are validated and retained, but pages are not mounted yet.
  Following a successful callback currently reaches 404; this does not satisfy
  S1a direct-object acceptance. S1-02/S1-03 supply queries and pages.
- The web listener is not published by Docker/Cloudflare. No real Google account,
  domain, public TLS endpoint or iPhone session was used. Synthetic provider
  injection exists only in tests and cannot be enabled through runtime config.
- Migration/backup regressions do not establish cloud rollback acceptance.
  Production image changes, real-database migration and business writes are
  unperformed. Browser completion/audit and the new exact-task MCP read remain
  future S1 packages; no S2 candidate/digest feature is implemented.

**Next local package:** S1-02 authorized bounded queries and terminal-task
readback, under the already approved local S1 scope. Cloud publication continues
to require its separate review. M4 real-use metrics are unchanged.
