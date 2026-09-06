# S1 Job Search Web Operations Runbook v0.1

**Status:** S1-05A local operations contract; external setup and acceptance are
not authorized or completed.

## Continuity and benefits

### Upstream requirement

The [S1 P0 technical plan](../mvp/JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md)
requires a loopback-only Web listener, separately managed Cloudflare Tunnel,
staged browser-write enablement, and recovery evidence. The
[S1-04 result](../mvp/S1_04_TASK_COMPLETION_RESULTS_v0.1.md) proves the local
completion contract but deliberately leaves the browser surface unpublished.

### Current package

This package adds a deployable three-mode contract (`off`, `read`, `write`),
read-only Google secret injection, local Web health checks, an isolated
Cloudflare Tunnel service template, and fail-closed rollback instructions. It
does not create a tunnel, DNS record, OAuth client, public hostname, subscription,
cloud resource, identity link, or real-data write.

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
- Tunnel-active checks prevent an operator from starting Web or image rollback
  in the wrong order.

### Long-term benefits

- The same application and SQLite database can support ChatGPT and mobile Web
  entry through separately controlled transports.
- Explicit release modes provide a reusable pattern for later browser commands
  without granting them automatically when code is deployed.
- Isolated credentials and retained schema make incident containment independent
  of MCP availability and destructive database rollback.

## Runtime contract

| Mode | Compose files | Browser listener | Completion | Tunnel |
| --- | --- | --- | --- | --- |
| `off` | `compose.yaml` | Disabled | Disabled | Must be stopped |
| `read` | base + `compose.web.yaml` | `127.0.0.1:3001` | Disabled | May be started after local health |
| `write` | base + Web + `compose.web-writes.yaml` | `127.0.0.1:3001` | Enabled | May remain active after acceptance |

All modes keep MCP at `127.0.0.1:3000`. Do not add public VM firewall rules for
80, 443, 3000 or 3001. Cloudflare is allowed to reach only the Web listener;
its final ingress rule must remain `http_status:404`.

## 1. Bind external decisions

Before installing anything externally, record and approve:

- an owned Cloudflare-managed hostname and account-specific recurring cost;
- a dedicated Google Web OAuth client whose callback is
  `https://<host>/auth/google/callback`;
- the one Google identity that may be linked to the existing Workspace;
- a reviewed, supported `cloudflared` package version;
- the accepted application image and a database-copy rehearsal target.

Do not paste OAuth or tunnel secrets into chat, Git, command arguments or logs.
Creating accounts, DNS, tunnels or billable resources requires separate user
authorization.

## 2. Install private configuration

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

Validate tunnel configuration before publication:

```bash
cloudflared tunnel --config /etc/paw/web-tunnel.yml ingress validate
sudo systemctl enable --now paw-web-tunnel.service
sudo ./deploy/cloud/web-tunnel-health.sh
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
sudo ./deploy/cloud/web-tunnel-health.sh
npm run web:check -- --origin https://<reviewed-hostname> --writes on
```

Use only a synthetic acceptance Task until real-write authorization is explicit.
Verify browser completion, reload, exact `workspace_get_task` readback, audit,
duplicate retry and unchanged unrelated rows. Measure concurrent MCP reads, Web
reads/login/completion and backup on the 1 GB VM; record latency, peak memory,
OOM events and restart count.

## 6. Recovery and rollback

Contain the browser surface without interrupting MCP:

```bash
sudo systemctl disable --now paw-web-tunnel.service
sudo ./deploy/cloud/web-mode.sh off
./deploy/cloud/health.sh
```

`web-mode.sh off` refuses to proceed while the Web tunnel is active. Image
rollback also refuses while that service is active and always starts the base
MCP-only Compose contract:

```bash
./deploy/cloud/rollback.sh <known-good-image-tag>
```

Retain migrations 004 and 005. Before using an older image, prove old-image/new-
schema startup and legacy idempotency replay on an isolated database copy. If
that fails, keep the current image with Web off. Database restore is a separate
incident decision and must reconcile all intervening business writes.

## S1-05B evidence checklist

- [ ] Current cost, hostname, OAuth client, identity and `cloudflared` version approved
- [ ] `web-binding-preflight.sh` passes before the first read-mode publication
- [ ] Isolated synthetic HTTPS login reaches the original synthetic Workspace
- [ ] Public hostname exposes no MCP, health, admin or fallback origin
- [ ] `web:check --writes off` passes before identity linking
- [ ] Read mode survives application and VM restart
- [ ] Backup, restore-copy and image compatibility rehearsal pass
- [ ] Capacity sample passes alongside MCP and backup
- [ ] Reviewed real deployment starts with writes off
- [ ] Synthetic completion and fresh ChatGPT readback pass before real writes
- [ ] `web:check --writes on` passes before the human completion test
- [ ] iPhone Safari direct-link/completion and Windows-off evidence pass

## When to request human testing

Do not ask the user to test while hostname, OAuth, tunnel, identity mapping,
security rejection, backup or synthetic readback is incomplete. Once every
machine-verifiable item above through the writes-off real deployment has passed,
stop development and explicitly notify the user that human testing is required.

The first human test is limited to:

1. In ChatGPT on iPhone, ask for today's Workspace work and open the returned
   `webUrl`.
2. In Safari, complete Google login, inspect the expected synthetic application,
   and complete one clearly labeled synthetic Task.
3. With the Windows PC off, open a fresh ChatGPT conversation and verify the same
   Task ID is `DONE` with the expected completion time and parent application.

Record elapsed time, confusing steps, login repetitions and whether the browser
was faster than completing the same intent in conversation. Do not use or mutate
a real Task until this bounded human gate passes and separate authority is given.
