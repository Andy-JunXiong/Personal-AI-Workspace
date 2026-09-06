# S1 Job Search Web Operations Runbook v0.1

**Status:** S1-05B.2 local operations contract; Route 53/Caddy is the selected
AI Radar domain path, but external setup and acceptance are not completed.

## Continuity and benefits

### Upstream requirement

The [S1 P0 technical plan](../mvp/JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md)
requires a loopback-only Web listener, separately managed HTTPS ingress, staged
browser-write enablement, and recovery evidence. The original provider was
Cloudflare Tunnel. The user subsequently chose to reuse the existing
Route 53-managed `ai-radar-lab.com` domain instead of purchasing another domain.

### Current package

This package supplies a deployable three-mode contract (`off`, `read`, `write`),
read-only Google secret injection, local Web health checks, mutually exclusive
Cloudflare Tunnel and Route 53/Caddy ingress templates, and fail-closed rollback
instructions. The selected path serves only `workspace.ai-radar-lab.com` on
public TCP 443; ports 80, 3000 and 3001 remain closed publicly. It does not change
Route 53, allocate a static IP, change a firewall, create an OAuth client, link an
identity or write Workspace data.

### Downstream enablement

This enables S1-05B: reviewed synthetic HTTPS login/read acceptance, followed by
database-copy recovery rehearsal and a separately authorized real deployment
with writes initially off. G01, G02, G05, G06 and G08 external/device evidence
remains pending.

### Short-term benefits

- The MCP-only deployment remains the default and needs no new Web secret.
- Read and write exposure can be selected without editing the application image.
- Local probes verify signed-out isolation and security headers without adding a
  public `/healthz` route.
- Ingress-active checks prevent an operator from stopping Web or rolling back an
  image in the wrong order.
- Reusing the AI Radar zone removes a second domain registration while keeping
  the applications on separate hostnames.

### Long-term benefits

- The same application and SQLite database can support ChatGPT and mobile Web
  entry through separately controlled transports.
- Explicit release modes provide a reusable pattern for later browser commands
  without granting them automatically when code is deployed.
- Isolated credentials and retained schema make incident containment independent
  of MCP availability and destructive database rollback.

## Runtime contract

| Mode | Compose files | Browser listener | Completion | Public ingress |
| --- | --- | --- | --- | --- |
| `off` | `compose.yaml` | Disabled | Disabled | Both providers must be stopped |
| `read` | base + `compose.web.yaml` | `127.0.0.1:3001` | Disabled | Exactly one provider after preflight |
| `write` | base + Web + `compose.web-writes.yaml` | `127.0.0.1:3001` | Enabled | Same accepted provider only |

All modes keep MCP at `127.0.0.1:3000`. Cloudflare mode adds no public VM
firewall rules. The selected Route 53/Caddy mode permits only public IPv4 TCP
443; it keeps port 80 closed and never publishes 3000 or 3001. Do not run both
ingress services. Cloudflare's final ingress rule must remain `http_status:404`.

## 1. Bind external decisions

Before installing anything externally, record and approve:

- exactly one approved ingress provider and hostname, including its cost and
  security-boundary change;
- for Route 53/Caddy, `workspace.ai-radar-lab.com`, one attached Lightsail static
  IPv4 and a 443-only firewall rule;
- a dedicated Google Web OAuth client whose callback is
  `https://<host>/auth/google/callback`;
- the one Google identity that may be linked to the existing Workspace;
- a reviewed, supported `caddy` or `cloudflared` package version;
- the accepted application image and a database-copy rehearsal target.

Do not paste OAuth or tunnel secrets into chat, Git, command arguments or logs.
Creating accounts, DNS, tunnels or billable resources requires separate user
authorization.

## 2A. Install Cloudflare configuration (alternative path)

Update `/etc/paw/paw.env` from `paw.env.example`. The example `PAW_WEB_ORIGIN`
and client ID must be replaced. Keep bootstrap false except during the bounded
first-link procedure.

```bash
sudo install -d -o root -g root -m 0700 /etc/paw/secrets
sudoedit /etc/paw/secrets/google-client-secret
sudo chown 1000:1000 /etc/paw/secrets/google-client-secret
sudo chmod 0400 /etc/paw/secrets/google-client-secret

sudo cp deploy/cloud/web-tunnel.env.example /etc/paw/web-tunnel.env
sudo cp deploy/cloud/web-tunnel.yml.example /etc/paw/web-tunnel.yml
sudo chown root:root /etc/paw/web-tunnel.env /etc/paw/web-tunnel.yml
sudo chmod 0640 /etc/paw/web-tunnel.env
sudo chmod 0644 /etc/paw/web-tunnel.yml
sudoedit /etc/paw/web-tunnel.env
sudoedit /etc/paw/web-tunnel.yml
```

`PAW_WEB_HOST`, `PAW_WEB_ORIGIN`, the ingress hostname and `httpHostHeader` must
name the same exact host. The application secret bind is present only in Web
mode. Verify that UID 1000 is the image's non-root `node` identity before using
the commands above; `web-mode.sh` fails closed on another owner or mode. The
Cloudflare credential must be for this tunnel only, not the account
certificate that can manage other tunnels.

Install the explicitly reviewed `cloudflared` version from Cloudflare's official
package repository, verify `cloudflared --version`, and prevent unattended
version movement. Cloudflare currently supports releases within one year of its
latest version, so re-review the pin during maintenance rather than tracking
`latest`. Follow the official [download](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/)
and [Linux service](https://developers.cloudflare.com/tunnel/advanced/local-management/as-a-service/linux/)
documentation at execution time.

Install the dedicated tunnel credential and unit:

```bash
sudoedit /etc/paw/secrets/cloudflare-web-tunnel.json
sudo chown root:root /etc/paw/secrets/cloudflare-web-tunnel.json
sudo chmod 0600 /etc/paw/secrets/cloudflare-web-tunnel.json
sudo cp deploy/cloud/systemd/paw-web-tunnel.service /etc/systemd/system/
sudo systemctl daemon-reload
```

Do not enable the service yet.

Run the fail-closed binding preflight before starting read mode. It checks exact
hostname/origin/ingress agreement, placeholder removal, OAuth client shape,
secret ownership and modes, disabled bootstrap and browser writes, the 404
fallback, an inactive tunnel service, and `cloudflared` ingress validity. It
prints no credential content.

```bash
sudo ./deploy/cloud/web-binding-preflight.sh
```

Save its non-secret output with the private release evidence. A failure blocks
publication; do not bypass it by starting the service manually.

## 2B. Install Route 53/Caddy configuration (selected path)

This path reuses the AI Radar zone without changing the AI Radar application or
its `app` and `api` records. The DNS record, static IP attachment and firewall
change are AWS writes. Perform them only through the separately authorized AWS
operator path; this repository package does not make those changes.

1. Allocate one static IPv4 in `ap-southeast-2` and attach it to `paw-mvp`.
2. Add a Route 53 `A` record for `workspace.ai-radar-lab.com` pointing only to
   that address. Do not use the apex, `app` or `api` records.
3. Add one Lightsail IPv4 firewall rule for TCP 443. Keep 80, 3000, 3001 and
   8080 closed and do not add an AAAA record.
4. Install a reviewed Caddy package version. Its package may auto-start the
   generic `caddy.service`; stop and disable that service before continuing.

Install the reviewed provider files without adding secrets to the Caddy
environment:

```bash
sudo systemctl disable --now caddy.service
sudo install -o root -g root -m 0644 deploy/cloud/caddy/Caddyfile /etc/caddy/paw.Caddyfile
sudo install -o root -g root -m 0640 deploy/cloud/web-ingress.env.example /etc/paw/web-ingress.env
sudo install -o root -g root -m 0644 deploy/cloud/systemd/paw-web-ingress.service \
  /etc/systemd/system/paw-web-ingress.service
sudoedit /etc/paw/web-ingress.env
sudo systemctl daemon-reload
```

Replace the documentation IPv4 and ACME email. Update `/etc/paw/paw.env` so
`PAW_WEB_ORIGIN=https://workspace.ai-radar-lab.com`; install the dedicated
Google secret as described above. Keep base Web, writes and bootstrap flags
false. The Caddy service has a dynamic identity, a private certificate state
directory, no admin API and no request access log. It uses TLS-ALPN-01 on 443;
HTTP-01 and automatic port-80 redirects are disabled.

## 3. Start read mode first

Build and verify the accepted commit locally, deploy its MCP-only base, then
select read mode:

```bash
npm ci
npm run verify
chmod +x deploy/cloud/*.sh
./deploy/cloud/deploy.sh <accepted-image-tag>
sudo ./deploy/cloud/web-mode.sh read
sudo ./deploy/cloud/web-health.sh
```

Expected host listeners are loopback-only on 3000 and 3001. `web-health.sh`
sends the canonical Host header and requires the signed-out Today page to return
401 with `no-store`, CSP and `nosniff`. It does not make an external request.
The Web process binds `0.0.0.0` only inside its isolated container so Docker can
forward traffic to it; the Compose host publication remains
`127.0.0.1:3001:3001`. Never publish the host side on all interfaces.

For the alternative Cloudflare path, validate and start only the tunnel:

```bash
cloudflared tunnel --config /etc/paw/web-tunnel.yml ingress validate
sudo systemctl enable --now paw-web-tunnel.service
sudo ./deploy/cloud/web-tunnel-health.sh
```

For the selected Route 53/Caddy path, wait until DNS resolves only to the
attached static IPv4, then validate and start only the HTTPS ingress:

```bash
sudo ./deploy/cloud/web-route53-preflight.sh
sudo systemctl enable --now paw-web-ingress.service
sudo ./deploy/cloud/web-ingress-health.sh
```

From a separate network, verify HTTPS only for the selected hostname. Requests
for `/mcp`, `/healthz`, guessed objects, wrong hosts and the fallback ingress
must not expose MCP, health data or another Workspace.

Run the privacy-bounded external checker from the accepted build. It does not
follow the Google redirect or retain the login Cookie:

```bash
npm run web:check -- --origin https://<reviewed-hostname> --writes off
```

All five checks must pass. Keep the JSON result with private operational
evidence, not in Git when the hostname itself is private.

With read mode active, call `workspace_ping`, `workspace_get_today`,
`workspace_list_job_applications` and `workspace_get_task` through an isolated
synthetic ChatGPT connection. Each relevant result must contain an HTTPS
`webUrl` for the configured host; off mode must contain none.

## 4. Link the existing identity

For the first reviewed login only, set `PAW_WEB_BOOTSTRAP_ENABLED=true`, restart
read mode, and attempt login. Inspect the returned pending ID on the private VM:

```bash
docker compose -f deploy/cloud/compose.yaml -f deploy/cloud/compose.web.yaml \
  exec --no-TTY paw node dist/scripts/web-identity-admin.js inspect \
  --db /app/data/workspace.db --pending <pending-id>
```

Compare the verified identity with the approved account. Link it only to the
existing principal and Workspace using the same tool's `link` action. Then set
bootstrap false, rerun `sudo ./deploy/cloud/web-mode.sh read`, and verify the
original Workspace and
inventory. Never put the inspection output in repository evidence.

## 5. Enable completion only after read acceptance

Create and integrity-check a backup before changing mode:

```bash
./deploy/cloud/backup.sh
sudo ./deploy/cloud/web-mode.sh write
sudo ./deploy/cloud/web-ingress-health.sh  # selected Route 53/Caddy path
npm run web:check -- --origin https://<reviewed-hostname> --writes on
```

Use only a synthetic acceptance Task until real-write authorization is explicit.
Verify browser completion, reload, exact `workspace_get_task` readback, audit,
duplicate retry and unchanged unrelated rows. Measure concurrent MCP reads, Web
reads/login/completion and backup on the 1 GB VM; record latency, peak memory,
OOM events and restart count.

After the synthetic Task detail is open but before completing it, start the
bounded host sampler in SSH and perform the authorized completion plus fresh MCP
readback during its window:

```bash
sudo ./deploy/cloud/sample-web-capacity.sh 90
```

The sampler creates one concurrent consistent backup, repeatedly checks the
signed-out HTTPS boundary and MCP health, samples container/host memory, and
fails on request errors, restart drift or a new OOM event. It never invokes the
completion endpoint and receives no MCP or OAuth credential. The operator must
still record the authenticated browser result and exact fresh MCP Task readback.

After returning Web to read mode, verify the exact approved synthetic fixture,
terminal state, single Web audit and single idempotency record. The verifier
replays the original intent through the application service and requires the
stored response with zero database changes and no duplicate audit:

```bash
sudo ./deploy/cloud/verify-synthetic-completion.sh <synthetic-task-id>
```

The verifier refuses to run while writes or bootstrap are enabled, has no
network or published ports, and rejects any Task that is not the named S1-05B
synthetic fixture. This administrative replay does not replace the subsequent
fresh ChatGPT `workspace_get_task` readback.

## 6. Recovery and rollback

Before enabling browser writes, rehearse current-image and previous-image startup
against separate copies of a named, integrity-checked backup. This command does
not publish ports or replace the live database. Each temporary container has no
network, a read-only root filesystem, a 384 MiB memory limit and a private copy
of the backup. The command fails if either image is unhealthy, database
integrity fails or any logical schema/row content changes during startup:

```bash
sudo ./deploy/cloud/rehearse-database-copy.sh \
  workspace-YYYYMMDDTHHMMSSZ.db <current-image-tag> <previous-image-tag>
```

Use the active image tag and the immediately preceding accepted image, both by
immutable local tag. The script obtains only the configured development
principal fields from the running container; it does not copy MCP or OAuth
credentials into the isolated containers. Keep the non-sensitive pass summary
with private release evidence. Only an incident decision may restore the live
database.

Contain the browser surface without interrupting MCP:

```bash
sudo systemctl disable --now paw-web-tunnel.service
# Or, for the selected Route 53/Caddy path:
sudo systemctl disable --now paw-web-ingress.service
sudo ./deploy/cloud/web-mode.sh off
./deploy/cloud/health.sh
```

`web-mode.sh off` refuses to proceed while either Web ingress is active. Image
rollback also refuses while either service is active and always starts the base
MCP-only Compose contract:

```bash
./deploy/cloud/rollback.sh <known-good-image-tag>
```

Retain migrations 004 and 005. Before using an older image, prove old-image/new-
schema startup and legacy idempotency replay on an isolated database copy. If
that fails, keep the current image with Web off. Database restore is a separate
incident decision and must reconcile all intervening business writes.

## S1-05B evidence checklist

- [x] Current cost, hostname, OAuth client, identity and selected ingress version approved
- [x] Static IPv4 is attached; Route 53 changes only `workspace`; public firewall permits only 443
- [ ] Direct-origin exposure risk is accepted; `/auth` throttling, monitoring and ingress-stop rehearsal are recorded
- [x] `web-route53-preflight.sh` passes before the first read-mode publication
- [x] Exactly one of `paw-web-ingress.service` and `paw-web-tunnel.service` is active
- [x] Google HTTPS login reaches the linked original Workspace and named synthetic fixture
- [x] Public hostname exposes no MCP, health, admin or fallback origin
- [x] `web:check --writes off` passes before identity linking
- [x] Read mode survives application and VM restart
- [x] Backup, restore-copy and image compatibility rehearsal pass
- [x] Capacity sample passes alongside MCP and backup
- [x] Reviewed real deployment starts with writes off
- [x] Synthetic completion and fresh ChatGPT readback pass before real writes
- [x] `web:check --writes on` passes before the authorized completion test
- [ ] iPhone Safari direct-link/completion and Windows-off evidence pass

## When to request human testing

Do not ask the user to test while hostname, OAuth, ingress, identity mapping,
security rejection, backup or synthetic readback is incomplete. Those machine
prerequisites passed on 2026-09-06 and the deployment was returned to read mode;
the remaining Windows-PC-OFF iPhone check explicitly requires human testing.

OpenAI's current [MCP app documentation](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt)
states that custom MCP apps are not available on mobile. Do not assume that the
iPhone ChatGPT app can perform the MCP half of this gate. Use iPhone Safari for
the direct Web/device-independence evidence and retain the already-passed fresh
ChatGPT Web `workspace_get_task` readback as separate cross-entry evidence.

The next human test is limited to:

1. Confirm Web writes and identity bootstrap remain disabled, then shut down the
   Windows PC completely and disable Wi-Fi on the iPhone.
2. In iPhone Safari over cellular data, open the retained exact synthetic Task
   `webUrl`, complete Google login and verify the expected `DONE` state.
3. Reload and reopen the saved link, then navigate back to the linked application
   and dashboard without relying on the Windows PC.
4. If the strict G08 requirement still calls for a new completion performed on
   iPhone, prepare a new clearly labeled synthetic Task and obtain separate
   explicit authorization before enabling another bounded write window.

Record elapsed time, confusing steps, login repetitions and whether the browser
was faster than reading the same state in conversation. Do not use or mutate a
real Task, and do not reuse the completed fixture for another mutation.
