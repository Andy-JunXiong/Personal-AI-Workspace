# Cloud Always-On MVP — C1 Runtime Runbook

**Status:** REPOSITORY IMPLEMENTED; AWS RUNTIME EVIDENCE PENDING

**Target:** AWS Lightsail, `ap-southeast-2`

**Budget gate:** USD 10/month maximum for the MVP baseline

Local Linux container preflight and the concrete AWS resource proposal are
recorded in [the 2026-09-05 preflight](C1_C2_PREFLIGHT_2026-09-05.md). It repaired
image build and startup blockers and verified synthetic container persistence
and backup. AWS runtime acceptance remains pending.

## C1 boundary

C1 provisions and validates one always-on Docker runtime with persistent
SQLite storage. It does not migrate the real database and does not publicly
expose MCP. Secure ChatGPT connectivity is the C2 gate.

No lifecycle, Task, Today, evidence, idempotency, concurrency, authority, or
MCP tool contract changes are authorized by this runbook.

## Resources to create

| Resource | Configuration | Expected monthly cost |
| --- | --- | ---: |
| Lightsail instance | Sydney, Ubuntu 24.04 LTS, Linux public-IPv4 1 GB plan | USD 7.00 |
| Attached disk | 8 GB, encrypted by Lightsail, same availability zone | USD 0.80 |
| Disk snapshots | Bounded retained snapshots | Approximately USD 0.05/GB-month |

Do not create a load balancer, managed database, static IP, CDN, NAT Gateway,
DNS zone, or TLS proxy. Current prices must be rechecked immediately before
provisioning: <https://aws.amazon.com/lightsail/pricing/>.

## Network boundary

- Do not add public firewall rules for ports 80, 443, or 3000.
- Restrict SSH port 22 to the user's current public IP wherever practical.
- The PAW container publishes port 3000 only on host loopback:
  `127.0.0.1:3000`.
- C2 `tunnel-client` will require outbound HTTPS to `api.openai.com:443`.
- SQLite is accessible only as a host file on the attached disk.

## 1. Prepare the attached disk

Use `lsblk -f` to identify the newly attached empty disk. Do not copy the
example device name without checking the actual instance.

```bash
lsblk -f
sudo mkfs.ext4 /dev/REPLACE_WITH_NEW_DISK
sudo mkdir -p /srv/paw
sudo mount /dev/REPLACE_WITH_NEW_DISK /srv/paw
sudo blkid /dev/REPLACE_WITH_NEW_DISK
```

Add the reported UUID to `/etc/fstab`, then prove the mount survives:

```bash
sudo umount /srv/paw
sudo mount -a
mountpoint /srv/paw
```

Create runtime directories for the Ubuntu user and the container's `node`
user. Both normally use UID 1000 on this target; verify with `id` before
changing ownership.

```bash
sudo mkdir -p /srv/paw/data /srv/paw/backups /srv/paw/deployments
id
sudo chown -R 1000:1000 /srv/paw
sudo chmod 700 /srv/paw/data /srv/paw/backups /srv/paw/deployments
```

## 2. Install Docker and source

Install Docker Engine and the Compose plugin using Docker's current Ubuntu
instructions: <https://docs.docker.com/engine/install/ubuntu/>. Enable Docker
at boot and allow the deployment user to run it only if that local privilege
is intentionally accepted.

```bash
sudo systemctl enable --now docker
sudo mkdir -p /opt/paw
sudo chown "$(id -u):$(id -g)" /opt/paw
git clone https://github.com/Andy-JunXiong/Personal-AI-Workspace.git /opt/paw
cd /opt/paw
git fetch --tags origin
git checkout <accepted-C1-commit>
```

## 3. Install application configuration

The current single-user principal is safe only behind the private transport
boundary. Choose a stable private subject; do not use an email address or put
the tunnel runtime API key in this file.

```bash
sudo mkdir -p /etc/paw
sudo cp deploy/cloud/paw.env.example /etc/paw/paw.env
sudo chmod 600 /etc/paw/paw.env
sudoedit /etc/paw/paw.env
```

Required values:

```dotenv
PAW_TIME_ZONE=Australia/Sydney
PAW_DEV_PRINCIPAL_ISSUER=openai-secure-mcp-tunnel
PAW_DEV_PRINCIPAL_SUBJECT=<stable-random-private-value>
PAW_DEV_WORKSPACE_NAME=Personal AI Workspace
PAW_BACKUP_RETENTION_COUNT=14
```

## 4. First deployment

The deployment script refuses to run if `/srv/paw` is not a mounted disk. It
builds an immutable local image tag from the checked-out commit, starts the
container with automatic restart, and records the active tag on the persistent
disk.

```bash
cd /opt/paw
chmod +x deploy/cloud/*.sh
./deploy/cloud/deploy.sh
./deploy/cloud/health.sh
```

Confirm that Docker reports the container as healthy and that public port 3000
was not published:

```bash
docker compose -f deploy/cloud/compose.yaml ps
docker port paw-paw-1
curl --fail http://127.0.0.1:3000/healthz
```

The expected port mapping is `127.0.0.1:3000`, never `0.0.0.0:3000` or
`[::]:3000`.

## 5. Scheduled consistent backups

The application backup command uses SQLite's online backup API, validates the
copy with `PRAGMA integrity_check`, writes with mode `0600`, and retains only
the latest `PAW_BACKUP_RETENTION_COUNT` matching backup files. It does not
delete unrelated files.

Run and inspect one backup before enabling the timer:

```bash
./deploy/cloud/backup.sh
ls -l /srv/paw/backups
```

Install the daily systemd timer:

```bash
sudo cp deploy/cloud/systemd/paw-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now paw-backup.timer
systemctl list-timers paw-backup.timer
```

## 6. Reboot and persistence test

```bash
sudo reboot
```

After reconnecting:

```bash
cd /opt/paw
./deploy/cloud/health.sh
docker inspect --format '{{.RestartCount}}' paw-paw-1
mountpoint /srv/paw
```

Record the Workspace ID before and after reboot through a local MCP
`workspace_ping` call. The ID and database content must match.

## Application update

Do not deploy a moving branch name. Fetch and inspect an accepted commit, then
build that exact checkout:

```bash
cd /opt/paw
git fetch origin
git checkout <accepted-commit-sha>
npm ci
npm run verify
./deploy/cloud/deploy.sh
```

The database remains on `/srv/paw/data` and is not replaced by the image.

## Application rollback

List retained local images and select a previously known-good tag:

```bash
docker image ls paw
./deploy/cloud/rollback.sh <known-good-image-tag>
```

Application rollback never rolls back the database schema or replaces the
database file. A schema-incompatible future release requires its own migration
and rollback decision.

## Database restore test

Use only a filename listed in `/srv/paw/backups`. The restore script first
validates the backup, stops PAW, moves the current database and WAL sidecars to
a timestamped quarantine directory, installs the backup, and restarts PAW.

For C1 acceptance, perform this on the non-production C1 database:

```bash
./deploy/cloud/restore.sh workspace-YYYYMMDDTHHMMSSZ.db
./deploy/cloud/health.sh
```

The restore is recoverable because the previous files remain under
`/srv/paw/restore-quarantine/<timestamp>/`. Do not run the restore against the
real database until the C3 migration and acceptance procedure authorizes it.

## C1 evidence checklist

- [ ] Instance and encrypted disk identifiers recorded
- [ ] `/srv/paw` survives reboot as a distinct mounted disk
- [ ] Container runs as non-root with a read-only root filesystem
- [ ] Only `127.0.0.1:3000` is published
- [ ] `/healthz` succeeds locally
- [ ] Same Workspace ID before and after container restart
- [ ] Same Workspace ID before and after instance reboot
- [ ] Online backup succeeds and reports integrity `ok`
- [ ] Restore test succeeds against the non-production database
- [ ] Previous application image rollback succeeds
- [ ] Measured total memory fits the 1 GB plan with safe headroom
- [ ] Ports 80, 443, and 3000 are unreachable publicly

C1 is not complete until the runtime evidence above is recorded. Repository
configuration alone is not acceptance evidence.
