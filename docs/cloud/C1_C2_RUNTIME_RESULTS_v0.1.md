# Cloud C1/C2 runtime results v0.1

**Date:** 2026-09-05 (Australia/Sydney)

**Status:** C1/C2 CLOUD RUNTIME ACCEPTANCE PASSED; C3 REAL-DATA MIGRATION NOT STARTED

## Authority and deployed resources

The user explicitly authorized C1/C2 deployment within the USD 10/month MVP
budget in the active session. The deployed baseline is USD 7.80/month before
taxes, snapshots, and overages. No snapshots or other billable services were
added. This operating budget is not an AWS hard billing cap.

| Resource | Deployed configuration |
| --- | --- |
| Instance | `paw-mvp`, Sydney `ap-southeast-2a`, Ubuntu 24.04 LTS |
| Bundle | `micro_3_2`: 1 GB RAM, 2 vCPUs, 40 GB root disk, USD 7/month |
| Data disk | `paw-data`, 8 GB, same zone, USD 0.80/month |
| Disk mapping | AWS `/dev/xvdf`; observed Linux `/dev/nvme1n1` |
| Mount | ext4 at `/srv/paw`, persisted by UUID in `/etc/fstab` |
| Source revision | `4ab6daed21589d427bd416b9bf95bb7d10e88737` |
| Running application image | `paw:4ab6daed2158` |
| Transport | Pinned `tunnel-client-runtime` installed using the C2 checksum procedure |
| Database | Fresh non-production C1/C2 database; no real inventory imported |

Cloud resource IDs and endpoint details can be retrieved from the scoped
Lightsail API or console. The operational readbacks and logs are retained under
`/srv/paw/deployments`; credentials are excluded from Git and from the evidence
files. The dedicated operator SSH key is stored outside OneDrive in the local
PersonalAIWorkspace cloud operations directory.
The temporary local runtime API key transfer copy was deleted after successful
reboot verification. The live VM credential and operator SSH key are retained.

The local `runtime-instance.json` and `runtime-disk.json` receipts retain the
resource identifiers outside OneDrive. Attached disks are encrypted at rest
by default with AWS-managed keys, as documented in the
[Lightsail block storage FAQ](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-block-storage.html).

## Supported acceptance evidence

- The attached disk was verified as exactly 8 GiB, unmounted, without partitions
  or filesystem signatures before formatting. The 40 GB root disk was excluded.
- Docker Engine and Compose were installed from Docker's official Ubuntu
  repository. Docker has `RequiresMountsFor=/srv/paw` so a failed data mount
  cannot silently redirect writes onto the root disk.
- The accepted source revision built successfully on the 1 GB instance.
  Compose started the non-root container and `/healthz` reported the database
  available. The published application port is `127.0.0.1:3000`.
- The restricted Platform key grants only Tunnels Read and Use. It was
  transferred through non-echoing stdin and installed at the C2 credential
  path with mode `0600`. systemd loads it by credential-file reference.
- The tunnel service is enabled and running. Application health and tunnel
  liveness/readiness succeeded. Platform connector `workspace_ping`, Today,
  and the closed-inclusive application list returned the same fresh Workspace.
- A production MCP SDK client discovered the frozen 12-tool surface. Direct
  SQLite integrity returned `ok`; all three migrations are present. The fresh
  database contains one Principal and one Workspace, with zero Projects,
  Resources, Tasks, transitions, evidence links, or idempotency records.
- The online backup command succeeded and reported integrity `ok`. The actual
  restore script validated the backup, quarantined the previous database,
  restored the copy, and returned a healthy container. Complete JSON readback
  before and after restore matched byte-for-byte.
- A controlled candidate image added only an image metadata label to the
  accepted application image. Deploying it and rolling back to `4ab6daed2158`
  changed the running image ID as expected. Complete readback matched the
  original baseline after rollback, and the platform connector still resolved
  the same Workspace. This verifies image switching, not a schema rollback or
  a rollback between different product implementations.
- The backup timer was enabled only after a manual backup succeeded. Its next
  scheduled execution reflects 03:15 Australia/Sydney plus the configured
  random delay; retention is 14 matching database backup files.
- One full-stack idle sample showed 911 MiB total host memory with 394 MiB
  available, approximately 89 MiB for PAW, and approximately 10 MiB for the
  tunnel service. No swap was added. This is an idle observation, not a load test.

## Network and recovery observations

The Lightsail firewall permits only SSH from the operator's current IPv4 `/32`
and the AWS-managed `lightsail-connect` source alias. The latter is needed for
the authenticated browser administration path. There are no public rules for
80, 443, 3000, or 8080. External TCP probes to those four ports were unreachable;
the firewall configuration and on-host bindings are the stronger evidence
because direct operator SSH also failed on this network.

The initial empty instance could not be reached through direct operator SSH,
including after reboot and a full power cycle. Before any application was
installed, it was stopped, its empty data disk was detached, and the instance
was replaced. The same operator connection failure occurred on the replacement
without the original bootstrap script. Accordingly, the bootstrap script is
not established as the cause. AWS browser SSH succeeded, and an on-host packet
capture observed no SYN packets from the direct operator probe. The direct
network-path cause remains unresolved. Operations continued through the
authenticated AWS browser terminal. A temporary, operator-restricted port 2222
test also failed; its listener and firewall rule were removed.

The restore itself succeeded on its first execution, but its interactive
Compose subprocess consumed remaining stdin from the inline orchestration
script. Readback and rollback were then executed separately with stdin
controlled explicitly. No product defect or data discrepancy was observed.

## Authentication and whole-instance reboot acceptance

- Missing runtime credentials caused startup to exit with status 1. A separate
  invalid-key probe received `401 Unauthorized` for tunnel metadata and polling.
  The runtime retries invalid authentication; the bounded probe was terminated
  by its 15-second timeout (status 124). It did not establish a valid connection.
  The real service continued using its restricted credential.
- An actual instance reboot changed the Linux boot ID. The distinct ext4 data
  disk remounted at `/srv/paw`; Docker, the tunnel service, and the backup timer
  were enabled and active without manual recovery.
- PAW health, tunnel liveness, and tunnel readiness succeeded after reboot.
  The production SDK readback matched the pre-restore baseline byte-for-byte.
  Workspace `11ae78ce-6517-407a-88a7-e3ff12d8c665` remained unchanged through
  restore, rollback, and reboot. The connected app independently returned that
  same Workspace and empty Today collections after reboot.
- A manual invocation of the installed backup service after reboot returned
  systemd `Result=success` and `ExecMainStatus=0`. Database and backup files
  remained mode `0600`, owned by the verified deployment UID.
- Post-reboot listeners remained loopback-only on 3000 and 8080; temporary
  port 2222 was absent. An idle memory sample showed 433 MiB available.

Evidence under `/srv/paw/deployments` includes `before.json`,
`after-restore.json`, `after-rollback.json`, `after-reboot.json`, `backup.json`,
the restore/rollback/build/install logs, invalid/missing authentication logs,
and the pre-reboot boot ID. The final terminal verification emitted
`C1_C2_REBOOT_ACCEPTANCE_PASS`.

## Next gate

C1/C2 are accepted for this fresh non-production database. The current connector
therefore reads the empty cloud Workspace. Real database migration and cutover
remain a separate C3 action; the local M4 database and evaluation are unchanged.
