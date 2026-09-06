# S1-05B.2 AI Radar Domain Ingress Results v0.1

**Status:** Route 53/Caddy read-only publication, Google identity mapping and
database-copy recovery rehearsal passed on 2026-09-06. Capacity, synthetic
completion, cross-entry readback and iPhone acceptance remain pending.

## Continuity and benefits

### Upstream requirement

[S1-05B.1](S1_05B1_EXTERNAL_BINDING_PREFLIGHT_RESULTS_v0.1.md) established that
the connected Cloudflare account has no Zone or Tunnel. The user identified the
existing AI Radar domain as an alternative and authorized development after
`ai-radar-lab.com` was confirmed to use Route 53 with independent `app` and
`api` production hostnames.

### Current package

This package adds a second, mutually exclusive ingress provider for
`workspace.ai-radar-lab.com`: a hardened Caddy service on the existing Lightsail
VM, a 443-only Caddyfile, Route 53/static-IP configuration contract, fail-closed
preflight, live HTTPS health check and ingress-aware mode/rollback guards. It
does not modify AI Radar, Route 53, Lightsail networking, Google OAuth, external
TLS state, identity links or Workspace data.

### Downstream enablement

This enables the capacity and controlled synthetic-completion gate on the
accepted read-only deployment. Browser writes remain disabled until a named
synthetic Task, backup, concurrent-load measurement and exact MCP readback are
authorized and prepared. iPhone acceptance remains downstream of those checks.

### Short-term benefits

- The project can reuse an already-owned domain without changing AI Radar UI,
  routes, `app` DNS or `api` DNS.
- Port 80 and application ports remain closed; Caddy exposes only 443 and sends
  traffic to `127.0.0.1:3001`.
- Provider drift, DNS mismatch, unsafe modes, stale installed files, public
  application listeners and sensitive route exposure now fail a release check.

### Long-term benefits

- AI Radar and Personal AI Workspace share a domain asset while retaining
  separate hostnames, runtimes, authentication and rollback boundaries.
- The provider-neutral Web mode contract allows ingress replacement without
  changing the application or SQLite persistence model.

## Accepted residual risk before publication

The direct Route 53/Caddy path does not add a CDN edge, managed WAF or edge
DDoS absorption in front of the Lightsail origin. The application already
limits aggregate `/auth` requests to 30 per minute and does not trust forwarded
client IP headers, but that control is not volumetric network protection. Before
publication, the operator must explicitly accept this exposure, enable resource
and availability monitoring, and rehearse `systemctl disable --now
paw-web-ingress.service` as the containment action.

## Delivered controls

- `deploy/cloud/caddy/Caddyfile`: exact-host HTTPS, TLS-ALPN-01, no port-80
  redirect, no admin API, no request access log, loopback upstream only.
- `deploy/cloud/systemd/paw-web-ingress.service`: dynamic identity, isolated
  certificate state, only `CAP_NET_BIND_SERVICE`, systemd hardening.
- `deploy/cloud/web-route53-preflight.sh`: exact zone/host/origin/IP checks,
  DNS agreement, configuration identity, disabled writes/bootstrap and private
  application listeners.
- `deploy/cloud/web-ingress-health.sh`: valid local TLS path, signed-out 401 and
  security headers, `/mcp`/`/healthz`/`/admin` rejection, no port 80 and no
  public application ports.
- Mode and image rollback refuse to run while either ingress provider is active.

## Verification boundary

Static deployment-contract tests, full typechecking, repository tests, build
and diff checks are required for acceptance. This Windows environment has no
Linux shell or Caddy binary, so `bash -n`, `caddy validate`, systemd hardening,
certificate issuance, DNS, firewall and HTTPS checks must run on the accepted
Ubuntu VM before publication can pass.

No human product test is requested until read-only external checks, Google
identity mapping, recovery evidence and synthetic readback have passed.

## VM rollout finding

The first read-mode VM run exposed a provider-selection defect before public
HTTPS was started: the shared Web health script still assumed the Cloudflare
environment filename. The corrected contract discovers exactly one readable
provider environment from the Route 53 and Cloudflare alternatives and fails
when neither or both exist. This keeps the providers mutually exclusive while
allowing the selected Route 53 path to pass the same application health gate.

The next VM check confirmed the Web process answered inside the container while
the host-side loopback publication reset connections. The application had bound
only the container loopback address, which Docker's forwarding path cannot
reach. The corrected runtime keeps local development on `127.0.0.1`, permits
only the Docker overlay to bind the container interface, and preserves the host
publication at `127.0.0.1:3001`.

The first systemd start then failed closed before binding port 443 because the
dynamic service identity was told to reopen the root-only ingress environment
file during Caddy validation. systemd had already loaded that file through the
unit's `EnvironmentFile` directive. Removing the redundant Caddy `--envfile`
argument preserves the private file boundary while supplying the same validated
variables to both pre-start validation and the running process.

The following start failed closed because the non-secret Caddyfile was beneath
the deliberately non-traversable `/etc/paw` application configuration
directory. Rather than weaken that directory, the reviewed Caddyfile now uses
the package-standard `/etc/caddy/paw.Caddyfile` location. Application settings
and credentials remain under the restricted `/etc/paw` boundary.

## External read-only acceptance

The accepted external binding uses a Lightsail static IPv4, an authoritative
Route 53 `A` record for only the `workspace` hostname and a public firewall rule
for only IPv4 TCP 443. Caddy `v2.11.4` is package-held; its generic service is
disabled and the dedicated ingress service is active. Port 80 is closed and the
MCP/Web application ports remain published only on host loopback.

The privacy-bounded external release checker passed all five writes-off checks
before and after identity linking: signed-out policy, public route isolation,
write-mode isolation, OAuth start/PKCE/session contract and unsafe-return
rejection. Direct external probes also returned 404 for MCP, health and guessed
administration routes. Application restart and a complete VM reboot preserved
MCP, Web and ingress health.

The reviewed Google test identity first reached the expected unlinked 403. A
short-lived Pending ID was inspected only on the VM, the verified email and
existing MCP Workspace target were separately confirmed, and the association
was written with its audit event. Bootstrap was disabled immediately afterward.
A fresh browser login then rendered the original Workspace in read mode. No
identity value or Workspace content is retained in this evidence.

The post-link backup `workspace-20260906T094539Z.db` passed SQLite integrity and
contained migrations 001 through 005. Commit `e54e083` added a fail-closed
database-copy rehearsal. On the VM, active image `9303de5` and preceding image
`520b14b` each became healthy against a private copy with no network or host
ports. Both retained the same 13-table/183-row logical fingerprint before and
after startup and passed integrity verification; sampled container memory was
34.81 MiB and 34.9 MiB respectively. The live database and container were not
modified, and the HTTPS ingress health check passed immediately afterward.
