# Cloud Always-On MVP — C0 Readiness Review

**Date:** 2026-09-05 (Australia/Sydney)  
**Branch:** `cloud/always-on-mvp`  
**Base:** `main` at `7850ae3`  
**Decision:** CONDITIONAL GO

## Scope

C0 validates whether the frozen Personal AI Workspace runtime can move to a
small always-on cloud host without changing Job Search behaviour. It does not
provision AWS resources, migrate the real database, add tools, add domains, or
change the M4 product freeze.

The branch starts from the merged `main` because it contains the current M4
dogfood evidence and the OpenAI Platform Watch documentation. The immutable
M1, M2, and M3 tags remain untouched.

## Deployment decision

Use one AWS Lightsail Linux instance in `ap-southeast-2`, initially the 1 GB
plan, with an encrypted 8 GB attached disk for Workspace data. Run the existing
Docker image and OpenAI `tunnel-client` as automatically restarted services.

```text
ChatGPT on any device
        |
        v
OpenAI-hosted private tunnel endpoint
        ^
        | outbound HTTPS only
        |
Lightsail VM
  tunnel-client -> 127.0.0.1:3000/mcp
                         |
                         v
                    PAW container
                         |
                         v
               /app/data/workspace.db
                         |
                         v
             /srv/paw/data on encrypted disk
```

This private-tunnel design deliberately replaces the original public reverse
proxy design for the single-user MVP. Do not open ports 80, 443, or 3000. If
Secure MCP Tunnel is unavailable to the user's account, C1 must stop and a
separate OAuth-backed public-ingress decision is required.

OpenAI documents that Secure MCP Tunnel is outbound-only, can connect a private
MCP server to ChatGPT developer mode, and requires a continuously running
`tunnel-client`. It is suitable for private use, not public app distribution:
<https://developers.openai.com/api/docs/guides/secure-mcp-tunnels>.

## Readiness findings

| Area | Evidence | C0 result |
| --- | --- | --- |
| Runtime | Node 24, TypeScript, Express, Streamable HTTP MCP | Ready |
| MCP surface | Frozen 12-tool surface remains covered by transport tests | Ready |
| Health | `/healthz` returns `200` with database availability | Ready |
| Persistence | `PAW_DB_PATH` is already the database boundary; Docker uses `/app/data/workspace.db` | Ready |
| SQLite | WAL, foreign keys, 5-second busy timeout, transactional migrations | Ready |
| Startup | Existing data is opened in place; missing schema migrations are applied; startup does not delete data | Ready |
| Container | Existing multi-stage Dockerfile is suitable; persistent `/app/data` is declared | Ready, cloud runtime test pending |
| Authentication | `/mcp` has no application HTTP authentication; configured principal is development-only | Blocker for public ingress |
| Private transport | Tunnel association and runtime key can provide the external access boundary without public ingress | Account validation pending |
| Backup | SQLite online backup API produced a consistent copy; restored copy passed `PRAGMA integrity_check` | Ready for operational script in C1 |
| Real data | The authoritative Windows database is intentionally outside Git and is not present in this environment | Migration pending C3 |

`userConfirmed`, authority references, and observe/propose/admit separation are
domain mutation controls. They are not network authentication and must never be
used as a substitute for an ingress security boundary.

## Verification evidence

- `npm run verify`: PASS
- Test files: 12 passed
- Tests: 129 passed
- TypeScript typecheck: PASS
- Production build: PASS
- Local `/healthz`: `{"status":"ok","database":"available"}`
- Restart readback: the same Workspace ID was returned before and after a
  process restart against the same database
- Bare Node process RSS at idle: approximately 76 MiB
- SQLite backup restore: `PRAGMA integrity_check = ok`; all three migrations
  and the Workspace record were present
- Tracked production database files: none

The Linux verification run exposed one portability defect in the existing
Windows-style `%LOCALAPPDATA%` path test. C0 normalizes configured backslashes
on non-Windows hosts. This changes no domain contract and makes the existing
cross-platform configuration test pass on the Linux deployment platform.

Docker image build and container memory were not measured in this execution
environment because it has no Docker daemon. The 1 GB plan retains ample room
for the measured Node process, the operating system, Docker, and
`tunnel-client`. Do not downgrade to 512 MB until the complete C1 stack is
measured on Lightsail.

## Persistence and backup boundary

- Attach the encrypted disk independently of the instance root disk.
- Mount it at `/srv/paw` and bind `/srv/paw/data` to container `/app/data`.
- Keep `/srv/paw/backups` outside the container writable layer.
- Use SQLite's online backup API for scheduled database-consistent backups.
- Verify each backup with `PRAGMA integrity_check` before retention cleanup.
- Use Lightsail disk snapshots as a secondary recovery layer, not as the only
  database backup mechanism.
- Never commit the database, WAL files, backups, tunnel key, or environment
  file to Git.

At the time of this review, AWS lists the 1 GB public-IPv4 Linux bundle at
USD 7/month, 8 GB block storage at USD 0.80/month, and snapshots at USD
0.05/GB-month: <https://aws.amazon.com/lightsail/pricing/>. The expected MVP
total is approximately USD 8-9/month without a load balancer, managed database,
NAT Gateway, domain, or public TLS proxy.

## C1 entry gates

C1 may provision infrastructure only after all of the following are true:

1. The user's Platform account shows Tunnel settings and can create a
   `tunnel_id` with Read, Manage, and Use permissions.
2. The target ChatGPT workspace can be associated with that tunnel.
3. AWS access to `ap-southeast-2` and the recurring spend are explicitly
   available for this deployment.
4. No public ingress rule for PAW is introduced.

## C1 acceptance target

Using a fresh or copied non-production database:

1. Lightsail reboots.
2. The PAW container and `tunnel-client` restart automatically.
3. The same database and Workspace identity remain available.
4. Local `/healthz` succeeds.
5. ChatGPT developer mode calls `workspace_ping` through the private tunnel.
6. Ports 80, 443, and 3000 remain unreachable from the public internet.

Real database migration remains gated to C3 after C1 and C2 evidence passes.
