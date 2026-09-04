# Cloud C1/C2 deployment preflight — 2026-09-05

**Status:** LOCAL CONTAINER PREFLIGHT PASSED; AWS PROVISIONING NOT STARTED

This is the historical pre-provisioning record. Deployment and C1/C2 cloud
acceptance subsequently passed in the same session; see the
[runtime results](C1_C2_RUNTIME_RESULTS_v0.1.md) for current status.

## AWS discovery and proposed resources

Read-only AWS Lightsail queries succeeded using the existing local `default`
profile with explicit configuration-file paths. Initial implicit-profile
failures were local configuration visibility failures, not proof of invalid
AWS credentials. No credential values or account identifiers are recorded here.

At initial discovery, Sydney had no Lightsail instances or attached disks. The API reported
all three Sydney availability zones available, and the following target is
available:

| Item | Proposed value |
| --- | --- |
| Instance name | `paw-mvp` |
| Region / zone | `ap-southeast-2` / `ap-southeast-2a` |
| Blueprint | `ubuntu_24_04` |
| Bundle | `micro_3_2`, Linux, 1 GB RAM, 40 GB root disk |
| Instance price | USD 7/month, confirmed by `get-bundles` |
| Separate data disk | `paw-data`, 8 GB, same zone, mounted at `/srv/paw` |
| Data disk price | USD 0.80/month |
| Baseline | USD 7.80/month before snapshots, taxes, or overages |
| Budget | Existing USD 10/month MVP baseline gate |
| Ingress | SSH restricted to operator IP; MCP and tunnel health on loopback |
| Initial database | Fresh non-production C1/C2 database |

[AWS pricing](https://aws.amazon.com/lightsail/pricing/) was rechecked on
2026-09-05: block storage is USD 0.10/GB-month with an 8 GB minimum; snapshots
are USD 0.05/GB-month. Snapshot retention must fit the existing budget.
The budget is an operating constraint, not an AWS hard billing cap.

The user explicitly authorized the proposed deployment and USD 10/month budget
in the active session on 2026-09-05, satisfying the C0 recurring-spend gate. The
existing tunnel association is supported by the C2 record; installation of a
Restricted runtime key with Tunnels Read + Use and actual cloud connectivity
remain pending. The [official tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
confirms outbound HTTPS operation and the Read + Use runtime permissions.
Real data migration remains gated on complete C1/C2 runtime acceptance.

## Container blockers found and repaired

1. The Dockerfile omitted `tsconfig.build.json`, although `npm run build`
   invokes it. Copy both TypeScript configurations into the build stage.
2. The original application working directory `/app` contained the configured
   `/app/data/workspace.db`, which violates the existing database path boundary.
   Move application code to `/opt/paw` in both stages; retain the published
   data and backup mounts under `/app`. No application policy is weakened.
3. An actual Linux Docker build failed installing `better-sqlite3` because
   `node-gyp` could not find Python. Install Python, make, and g++ only in the
   build stage; compile dependencies there, prune development dependencies,
   and copy the resulting production modules to the runtime stage.

The product code, database schema, and frozen 12-tool contract are unchanged.

## Validation evidence

- Existing local baseline: typecheck, all 130 tests in 13 files, and production
  build passed during this session before the Docker-only corrections.
- Corrected Linux amd64 image build: passed with Node 24.20.0 and Docker
  Engine 28.4.0. Local image tag: `paw:cloud-preflight-20260905`.
- Base image resolved to
  `node:24-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e`.
- Fresh isolated named Docker volumes were used; no real database was opened.
- Container health and `/healthz`: passed. Published port bound only to
  `127.0.0.1`; read-only root filesystem, dropped capabilities, no-new-privileges,
  non-root UID 1000, and `unless-stopped` restart policy were inspected.
- Runtime contains no Python, make, g++, Vitest, or TypeScript installation at
  the checked standard executable/package paths.
- MCP discovery returned exactly 12 tools; `workspace_ping` and
  `workspace_get_today` succeeded against the fresh database. Today used
  `2026-09-05` / `Australia/Sydney` and returned empty work collections.
- SQLite integrity returned `ok`, and all three migrations were present.
- A graceful container restart preserved the Workspace identity; a new MCP
  client independently read it back after restart.
- The online backup command succeeded. A standalone read-only reopen returned
  integrity `ok` and Workspace rows identical to the live database. The backup
  file mode was `0600`, with no backup sidecars.
- One idle Docker sample reported 32.79 MiB under a 512 MiB container limit.
  This is not full-stack VM sizing evidence or a load test.
- The temporary container and its two synthetic volumes were removed after
  validation. The local image is retained for review; it includes uncommitted
  Docker corrections and must not be represented as the original main commit.
- AWS instance reboot, persistent attached-disk mount, application rollback,
  host restore, full-stack memory, private tunnel authentication, and ChatGPT
  acceptance: pending. Local Docker results cannot satisfy those cloud gates.

The image was built with `docker build --tag paw:cloud-preflight-20260905 .`.
Runtime checks used the image's production MCP SDK and SQLite module through
`docker exec`, with assertions on health, tool count, identity, integrity, and
backup permissions. This local check exercised equivalent container hardening
flags; the actual Linux Compose/systemd and attached-disk procedures still
require their own C1/C2 execution.

## Next execution sequence

1. Obtain explicit authorization for the proposed recurring AWS spend if not
   already provided in the active session.
2. Create the named instance and disk, restrict SSH, and prepare the verified
   empty disk following C1. Keep PAW ports inaccessible publicly.
3. Deploy an accepted revision containing the Docker corrections and validate
   fresh-database identity, backup/restore, rollback, and host reboot.
4. Install the C2 pinned tunnel runtime and the Restricted credential directly
   on the VM, then validate authentication failure, readiness, private ChatGPT
   readback, and reboot recovery.
5. Record actual C1/C2 runtime evidence before proposing C3 real-data migration.
