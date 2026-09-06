# S1-05A Local Operations Results v0.1

**Status:** LOCALLY VERIFIED OPERATIONS CONTRACT; NOT DEPLOYED

**Date:** 2026-09-06 (Australia/Sydney)

## Continuity and benefits

### Upstream requirement

The [S1-05 package](JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md) follows
[S1-04 completion](S1_04_TASK_COMPLETION_RESULTS_v0.1.md): browser completion is
locally safe, but it had no staged container exposure, independent HTTPS tunnel
service, deployment health probe or fail-closed rollback sequence.

### Current package

S1-05A supplies the local operations contract and
[runbook](../cloud/S1_WEB_OPERATIONS_RUNBOOK.md): base/read/write Compose modes,
loopback publication, read-only secrets, hardened tunnel templates, health
checks, rollback guards and automated configuration assertions. No external
account, hostname, tunnel, OAuth client, cloud runtime, real database or user
identity was accessed.

### Downstream enablement

The next package is S1-05B external acceptance: bind reviewed provider details,
run isolated synthetic HTTPS/login checks, rehearse recovery on a database copy,
then request separate authority for a writes-off real deployment. All public,
real-account, Safari/iPhone and Windows-off release gates remain pending.

### Short-term benefits

- Verified the existing MCP deployment remains the no-secret, Web-off default.
- Verified browser reads and writes require separate reviewed overlays.
- Verified the Web secret is mounted read-only and port 3001 is host-loopback only.
- Verified the tunnel cannot route to MCP and unmatched ingress returns 404.
- Verified rollback commands reject a still-active Web tunnel.

### Long-term benefits

- Deployment of application code no longer grants browser mutation authority.
- Web incidents can be contained while ChatGPT continuity remains available.
- Future Web commands can reuse staged transport/authority controls and the same
  non-destructive schema rollback policy.

## Delivered artifacts

| Area | Result |
| --- | --- |
| Container | Image declares ports 3000/3001; base Compose explicitly disables Web and writes. |
| Staging | Read overlay exposes only `127.0.0.1:3001`; write overlay changes only write authority. |
| Secrets | Google client secret is a read-only Web-only bind; tunnel uses a systemd credential. |
| Tunnel | Separate dynamic-user service, automatic restart, pinned-update policy and 404 ingress fallback. |
| Health | Signed-out local page must return 401 plus no-store, CSP and nosniff; no public health route added. |
| Recovery | Web-off and image rollback refuse while the public tunnel remains active. |
| Tests | Static deployment contracts and Git Bash syntax checks added. |

## Verification

- Focused deployment/config tests: 7 passed.
- Git Bash `-n`: all four relevant shell scripts passed.
- Repository `git diff --check`: passed.
- Full repository verification: 19 test files / 182 tests, server/browser
  typechecking and production build passed.

## Boundaries and remaining risk

The current Windows host cannot exercise Linux systemd, `/srv/paw`, Docker
Compose against `/etc/paw`, Cloudflare egress, Google OIDC or VM restart. The
templates are therefore locally verified contracts, not operational evidence.
The exact supported `cloudflared` version, account plan/cost, hostname and OAuth
registration must be bound and reviewed at S1-05B execution time. No production
or real-data claim follows from this package.
