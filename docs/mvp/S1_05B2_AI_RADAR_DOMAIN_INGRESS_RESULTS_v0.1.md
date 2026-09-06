# S1-05B.2 AI Radar Domain Ingress Results v0.1

**Status:** Route 53/Caddy release package implemented and locally verified;
AWS, DNS, TLS and public acceptance are pending.

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

This enables AWS operator binding: attach a static IPv4, add only the
`workspace` Route 53 record, permit only TCP 443, install the accepted package,
start read mode and run external HTTPS checks. Google client creation, identity
linking, recovery/capacity rehearsal, synthetic completion and iPhone acceptance
remain pending.

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
