# S1-05B.4 iPhone Completion Plan v0.1

**Date:** 2026-09-06 (Australia/Sydney).

**Status:** PLAN — not yet executed. This records the separately authorized
procedure for completing one Task on iPhone to satisfy strict G08 acceptance.
The Windows-PC-OFF iPhone Safari **read** already passed
([S1-05B.3](S1_05B3_IPHONE_SAFARI_ACCEPTANCE_RESULTS_v0.1.md)); this plan is the
additional *completion* performed on iPhone.

## Continuity and benefits

### Upstream requirement

Acceptance scenario A10 and requirements R08/R16 require a supported browser
mutation to work on iPhone portrait with Windows completely off. The
[P0 plan](JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md) gate G08 treats an iPhone
*completion* as the strict form of that evidence, distinct from the read-only
direct-Web check.

### Current package

S1-04 delivered atomic browser Task completion with actor-attributed audit and
idempotent replay; S1-05B.2 proved it once on the cloud desktop path and then
returned the deployment to read mode. This plan adds a second, clearly labeled
synthetic fixture and a bounded write window so the same completion can be
performed from iPhone Safari over cellular.

### Downstream enablement

A pass here closes the strict G08 interpretation and leaves only the full P6
acceptance run (A01–A12) as the S1/S2 release gate. A failure does not change
the already-passed S1-05B.3 read evidence.

### Short-term benefits

- Proves the browser completion control is reachable and usable on iPhone over
  cellular with no Windows PC or local process on the path.
- Reuses the already-accepted completion audit/idempotency invariant rather than
  introducing a new mutation.

### Long-term benefits

- Establishes device-independent *write* acceptance, the final piece of the
  Windows-off mobile runtime requirement for the Web surface.

## Verification-script constraint

`deploy/cloud/verify-synthetic-completion.sh` is hardcoded to the retained
desktop fixture (title `SYNTHETIC TEST - Complete once through Web`, company
`PAW Synthetic Acceptance`, role `S1-05B Browser Completion Fixture`, version 2)
and must not be reused for this new fixture. Verification for the iPhone fixture
therefore uses fresh ChatGPT `workspace_get_task` readback plus optional direct
database audit inspection.

## Procedure

### Phase 1 — Create the fixture (PC on, read mode)

```bash
cd /opt/paw
sudo ./deploy/cloud/web-ingress-health.sh
sudo docker exec paw-paw-1 sh -c 'printf "WRITES=%s\nBOOTSTRAP=%s\n" "$PAW_WEB_WRITES_ENABLED" "$PAW_WEB_BOOTSTRAP_ENABLED"'
```

Both must be `false`. Then create the Task through ChatGPT MCP
`workspace_create_task`:

| Field | Value |
| --- | --- |
| `projectId` | `8568a3c3-768a-46b6-acf2-ac85e5108710` |
| `title` | `SYNTHETIC TEST - Complete on iPhone` |
| `taskKind` | `OTHER` |
| `priority` | `LOW` |
| `userConfirmed` | `true` |
| `authorityReference` | `S1 iPhone completion fixture` |

Record the returned Task ID (`NEW_TASK_ID`) and `recordVersion` (expected 1).

### Phase 2 — Open a bounded write window

```bash
./deploy/cloud/backup.sh
sudo ./deploy/cloud/web-mode.sh write
sudo ./deploy/cloud/web-ingress-health.sh
npm run web:check -- --origin https://workspace.ai-radar-lab.com --writes on
```

`web:check --writes on` must pass, then shut the Windows PC down immediately.

### Phase 3 — Complete on iPhone (Windows off, cellular, Wi-Fi off)

Open in Safari over cellular:

```
https://workspace.ai-radar-lab.com/workspace/job-search/tasks/<NEW_TASK_ID>
```

Complete Google login, tap `标记为已完成`, verify `已完成` plus completion time
and version 2, then reload and reopen the saved link.

### Phase 4 — Return to read mode (PC on)

```bash
cd /opt/paw
sudo ./deploy/cloud/web-mode.sh read
sudo ./deploy/cloud/web-ingress-health.sh
sudo docker exec paw-paw-1 sh -c 'printf "WRITES=%s\nBOOTSTRAP=%s\n" "$PAW_WEB_WRITES_ENABLED" "$PAW_WEB_BOOTSTRAP_ENABLED"'
```

Confirm `WRITES=false` and a passing ingress health check.

### Phase 5 — Verify (read-only)

In a fresh ChatGPT conversation call `workspace_get_task({ taskId: NEW_TASK_ID })`
and confirm `DONE`, `recordVersion = 2`, a present `completedAt`, the expected
`projectId` and the HTTPS `webUrl`. Optionally inspect the completion audit and
idempotency rows directly on the database.

## Boundary

- Do not mutate the retained desktop fixture Task `976b64d1…` or any real Task.
- Keep the write window to this one synthetic completion; return to read mode
  immediately.
- Do not change the hardcoded verifier script, identity links, credentials or
  bootstrap; do not expose ports 80, 3000 or 3001.
- The deployment image and source checkpoint remain unchanged.

## Evidence to record after execution

Sydney date/time; VM health and `WRITES`/`BOOTSTRAP` values before and after;
the new Task ID and versions; completion time; PC power state; cellular and
Wi-Fi state; login count; elapsed time; whether any step depended on the Windows
PC; the fresh ChatGPT readback; and a final `PASS` or `FAIL`.
