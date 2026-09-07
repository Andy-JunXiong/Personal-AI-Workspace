# P6 Acceptance Plan — Complete A01–A12 Journey v0.1

**Date:** 2026-09-07 (Australia/Sydney).

**Execution update:** S2 `da0a879` is deployed after successful migration and
rollback rehearsal. Automated Phase 0B passes; authenticated browser smoke
awaits the user. No P6 cloud fixture or A01–A12 scenario has run. See the
[runtime evidence](P6_RUNTIME_RESULTS_2026-09-07.md). Historical preparation
and authorization notes below are superseded by this execution update.

**Status:** PLAN — not yet executed. This records the separately authorized
procedure for the full P6 acceptance run (A01–A12) over the complete
recommendation-to-application journey. It is the remaining S1/S2 release gate;
no scenario has been run yet.

**Revision 2 (2026-09-07):** incorporated release review feedback — added a
deployed-image regression smoke (Phase 0B), scenario-isolated mutation
fixtures, a bounded synthetic bulk-seed command for a real cloud A04 >100
validation, and an up-front evidence matrix. The A04 >100 boundary is now a
cloud/device/path-level requirement, not an automated-test substitution.

**Revision 4 (2026-09-07):** user authorized execution of steps 1–4, including
cloud deployment and planned synthetic acceptance writes. The
[migration-aware rehearsal](../cloud/S2_MIGRATION_REHEARSAL_2026-09-07.md)
is implemented and locally verified (27 files / 233 tests); cloud execution
and all A01–A12 evidence remain pending.

**Revision 3 (2026-09-07):** local verification passes 26 files / 227 tests.
Strict count validation, the default 106-row replay, and unmapped-principal
no-write behavior are covered. Deployment remains pending a migration-aware
copy rehearsal; the existing unchanged-database rehearsal is not sufficient
for the S1-to-S2 schema upgrade. See the
[preparation review](P6_PREPARATION_RESULTS_2026-09-07.md).

## Continuity and benefits

### Upstream requirement

The
[Job Search Secondary Interface requirements](JOB_SEARCH_SECONDARY_INTERFACE_REQUIREMENTS_v0.1.md)
sections 6–7 define twelve acceptance scenarios (A01–A12) and gate P6:
"Verify the complete mobile and cross-conversation journey and dogfood it …
only then call the first product increment complete." S1-01 through S1-05B.3 and
S2-01 through S2-03 are locally verified and the S1 surface is deployed on
`workspace.ai-radar-lab.com`, but S2 (candidates, application linking and
recommendation-run recording) is still local-only and no A01–A12 scenario has
been executed against the deployed surface.

### Current package

This plan turns the twelve acceptance scenarios into an ordered, fixture-backed
execution procedure. It adds a bounded synthetic bulk-seed command
(`scripts/seed-p6-a04.ts`) for the A04 >100 validation, and defines the one
deployment prerequisites (migration-aware rehearsal and deploying the S2 data layer), the scenario-isolated
synthetic fixtures, the exact MCP/Web/device steps, the pass condition per
scenario, and the up-front evidence matrix. It adds no runtime migration, MCP
tool, or application write path.

### Downstream enablement

A full A01–A12 pass is the definition of done for the first product increment.
Until then the increment is not complete; S2-01/02/03 remain local-only and the
S1 surface remains an intermediate release. A partial pass leaves only the
failed scenarios outstanding.

### Short-term benefits

- Each scenario is traced to its requirements and to the automated test that
  already proves its deterministic server behavior, so a human knows what is
  already proven versus what the cloud/device run must still demonstrate.
- Mutation scenarios each own a dedicated fixture, so terminal-task, version,
  idempotency and one-time-link semantics cannot leak across scenarios.
- The seed command is provably narrow (prefix-only, bounded, idempotent,
  no observations), so the A04 >100 dataset can be created and replayed without
  touching real or previously recorded records.

### Long-term benefits

- A reproducible acceptance procedure becomes the reusable template for the
  post-release dogfood and for future domain interfaces, preserving the
  authority, privacy, and audit boundaries the S1/S2 slices established.

## How to read this plan

Each scenario block lists, in order:

- **Covers** — the requirements from section 3 of the requirements document.
- **Already proven locally** — the automated test that proves the deterministic
  server behavior; the cloud/device run verifies the human-facing layer only.
- **Cloud/device steps** — the concrete MCP, Web and device actions.
- **Pass condition** — the observable result that makes the scenario pass.

This split mirrors the existing acceptance evidence: automated tests prove
domain, persistence, privacy and idempotency; the cloud/device run proves login,
cross-entry continuity, mobile usability and the live data path.

## Preconditions (must already hold)

These passed on 2026-09-06 and are unchanged by this plan:

- Host `workspace.ai-radar-lab.com` on Route 53 + Lightsail static IPv4; Caddy
  on public IPv4 TCP 443 only; application listeners loopback `127.0.0.1:3000-3001`.
- Google identity link maps the reviewed account to the existing cloud Workspace.
- Backup/restore, image rollback, database-copy rehearsal, and the 90-second
  capacity sample all passed.
- The retained S1-05B synthetic fixture (Project
  `8568a3c3-768a-46b6-acf2-ac85e5108710`, Task
  `976b64d1-a758-486a-a8aa-c0322e684ede`) is `DONE` and must not be re-mutated.

## Phase 0A — Deploy the S2 release candidate (separately authorized prerequisite)

S2-01/02/03 (migrations `006_job_candidates.sql`,
`007_candidate_links.sql`, `008_recommendation_runs.sql`; candidates, linking,
recommendation runs) are local-only. A07/A08/A11 cannot run until this code is
deployed. This is a **release-candidate deployment**, not an ordinary deploy;
it changes the Web router, the auth allowlist, browser JS and MCP discovery, so
Phase 0B regression evidence is required before any acceptance scenario runs.

1. Build and verify the accepted S2 commit locally:

   ```bash
   npm ci
   npm run verify          # 26 files / 227 tests
   chmod +x deploy/cloud/*.sh
   ```

2. Create a consistent backup before the image change:

   ```bash
   ./deploy/cloud/backup.sh
   ```

3. **Required prerequisite: migration-aware isolated-copy rehearsal.** Follow
   the [S2 release procedure](../cloud/S2_MIGRATION_REHEARSAL_2026-09-07.md),
   using the implemented `--s2-upgrade` mode. Build
   the candidate image before rehearsal, without switching the live container.
   The existing `rehearse-database-copy.sh` requires both images to exist and
   rejects any schema/content change during startup. Passing an S1 backup to
   the S2 image would therefore fail on the expected 006–008 migrations.
   Do not use that command as the S2 migration gate or bypass its checks.

   Prepare and verify an isolated-copy procedure that applies the S2 migrations,
   proves all pre-existing table rows are preserved, checks integrity and the
   exact expected schema additions, verifies a second S2 startup makes no
   changes, and starts the previous image against the migrated copy to assess
   rollback compatibility. Keep the original backup untouched. Record the
   candidate image tag and evidence before proceeding to step 4. This
   migration-aware procedure is now implemented; its cloud execution remains
   outstanding.

4. Deploy the S2 image and return to read mode:

   ```bash
   # Select the exact rehearsed image following the S2 release procedure.
   # Do not rebuild with deploy.sh after rehearsal.
   sudo ./deploy/cloud/web-mode.sh read
   sudo ./deploy/cloud/web-ingress-health.sh
   npm run web:check -- --origin https://workspace.ai-radar-lab.com --writes off
   ```

5. Confirm the three S2 migrations applied through a database read and tool
   discovery is 21 through MCP `tools/list`; use ChatGPT `workspace_ping` to
   confirm the existing Workspace identity. Synthetic refers to the fixture
   data, not a separate Workspace. Confirm the original 12-tool
   contracts are unchanged.

Stop if any of these fails. Do not proceed to fixtures or scenarios.

## Phase 0B — Deployed-image regression smoke

The S2 image is a new binary. Before running A01–A12, prove it did not break
already-accepted S1 capability. This is a smoke, not a re-run of S1-05B
recovery/capacity.

Through the isolated synthetic ChatGPT connection (MCP):

- `workspace_ping` returns the existing Workspace ID and `database: available`.
- Tool discovery is 21 and the original 12 tools keep their input/output shapes.
- `workspace_get_today` returns the deterministic Today for the existing
  Workspace (timezone/date unchanged).
- `workspace_list_job_applications` (active and `includeClosed`) matches the
  known counts and ordering.
- `workspace_get_task` resolves the retained S1-05B Task with the accepted
  `DONE`, version 2 and completion time.
- `workspace_list_job_candidates` and `workspace_get_job_candidate` return empty
  / NOT_FOUND (no S2 data yet) without error.
- `workspace_list_recommendation_runs` returns an empty list without error.

Through the browser (signed-out → login):

- `https://workspace.ai-radar-lab.com/workspace/job-search/today` returns 401
  signed-out, then the signed-in Today page renders.
- `/workspace/job-search/applications` renders the existing inventory.
- `/workspace/job-search/jobs` renders the (empty) Jobs view.

**Pass condition:** all reads succeed with unchanged S1 state, and no S1
regression is observed. A failure here blocks the entire P6 run.

## Phase 1 — Scenario-isolated synthetic fixtures

Mutation scenarios must own their own mutable object. Terminal tasks, record
versions, idempotency keys, candidate versions and one-time links cannot be
reused across scenarios. Every write is explicitly user-authorized with a
unique idempotency key and an `authorityReference` of the form `P6 <scenario>`.

### Isolated mutation fixtures

| Fixture | Purpose | Created via |
| --- | --- | --- |
| App-A01 | A01 saved-link/ownership | `workspace_create_job_application` |
| Task-A03 | A03 concurrency/stale-write | `workspace_create_task` on its own application |
| Task-A06 | A06 completion | `workspace_create_task` |
| Task-A09 | A09 double-submit/lost-response | `workspace_create_task` |
| Task-A10 | A10 iPhone completion | `workspace_create_task` |
| App-A05-High | A05 undated `HIGH` + blocked overdue | `workspace_create_task` (two Tasks) |
| App-A05-Gap | A05 application-without-open-task | `workspace_create_job_application` (no Task) |
| App-A02 | A02 observation + proposal | `workspace_record_observation` + `workspace_propose_transition` (not admitted) |
| App-A04-History | A04 >10 history entries | 11 `workspace_record_observation` NOTE rows (+ admitted APPLIED) |
| Cand-A07-Save | A07 SAVE | `workspace_record_candidate` |
| Cand-A07-Dismiss | A07 DISMISS | `workspace_record_candidate` |
| Cand-A08 | A08 duplicate + link | `workspace_record_candidate` matching an existing application |
| App-A08 | A08 linking target / duplicate match | `workspace_create_job_application` |
| Run-A11-Complete | A11 truthful empty run | `workspace_record_recommendation_run` (`COMPLETE`, empty) |
| Run-A11-Failed | A11 failed source | `workspace_record_recommendation_run` (`FAILED`, `UNKNOWN`) |
| Run-A11-Unknown | A11 unacknowledged delivery | `workspace_record_recommendation_run` (`COMPLETE`, `UNKNOWN`) |

All titles/companies carry the `SYNTHETIC TEST - P6` prefix. Record each
returned ID and `recordVersion`. Do not use a real application and do not reuse
the retained S1-05B fixture.

### A04 bulk dataset (>100 applications)

Use the bounded synthetic seed command (built in this package):

```bash
sudo docker compose -f deploy/cloud/compose.yaml -f deploy/cloud/compose.web.yaml \
  exec --no-TTY paw node dist/scripts/seed-p6-a04.js \
  --db /app/data/workspace.db --authority-reference "P6 A04 acceptance"
```

This creates 106 `SYNTHETIC TEST - P6-A04 Company NNN` applications through the
same service authority/idempotency path as MCP. It is prefix-only, bounded
(default 106, max 200), idempotent on replay, writes no observations/candidates/
links/tasks, outputs the created IDs, and fails closed on a missing database or
unmapped principal. `scripts/seed-p6-a04.ts` is covered by
`tests/integration/seed-p6-a04.test.ts` (narrow policy, idempotency, bound and
fail-closed checks).

The A04 >100 boundary is **not** satisfied by the automated test alone. The
seed dataset must be created and paged on the deployed surface.

## Phase 2 — Acceptance execution

### A01 — Signed-out saved link → login → same object; wrong account denied

- **Covers:** R01, R02.
- **Already proven locally:** `web-auth-transport.test.ts`, `web-identity.test.ts`.
- **Cloud/device steps:** Open App-A01's saved application link in Safari while
  signed out; complete Google login; confirm it returns to App-A01. In a
  separate browser session with a different Google account, confirm the same
  link is denied (no data access) and a guessed object ID returns a
  non-enumerating 404.
- **Pass condition:** Login returns to the exact authorized App-A01; a different
  account or a guessed ID provides no data.

### A02 — Observation and proposal without admission

- **Covers:** R03.
- **Already proven locally:** `real-lifecycle-m3.test.ts`.
- **Cloud/device steps:** Open App-A02's detail page; confirm the NOTE
  observation and the `INTERVIEWING` proposal appear with their source/inference
  labels and that App-A02's lifecycle is still `APPLIED` with unchanged
  lifecycle version.
- **Pass condition:** Evidence/proposal are labeled; canonical lifecycle is
  unchanged.

### A03 — Cross-entry freshness and stale-write protection

- **Covers:** R04, R12, R15.
- **Already proven locally:** `job-search-queries.test.ts` (cursor/version
  invalidation), `task-service.test.ts` (concurrency).
- **Cloud/device steps:** In a bounded write window, open Task-A03's detail
  in the browser. Through ChatGPT MCP update the same Task (for example,
  priority → `HIGH`). Without refreshing the browser, submit completion with
  its stale version: a `409` conflict must appear without overwriting the Task.
  Then refresh and confirm the MCP change appears. Return Web to read mode.
- **Pass condition:** Refresh shows the ChatGPT change; a stale write is rejected,
  not silently applied.

### A04 — Over 100 applications and over ten history entries

- **Covers:** R05, R06.
- **Already proven locally:** `job-search-queries.test.ts` (106 applications,
  31 history entries, paging/coverage/dedup), `seed-p6-a04.test.ts`.
- **Cloud/device steps:** Run the Phase 1 seed command to create 106 synthetic
  applications. Add 11 NOTE observations to App-A04-History. In the browser,
  page through the inventory and App-A04-History's evidence/history: every page
  reports a truthful total and coverage, no row is duplicated, and records
  remain reachable past the frozen 100-row legacy cap.
- **Pass condition:** Paging/coverage is truthful on the deployed surface and
  records are reachable without duplicates. The automated test is supporting
  evidence only; it does not replace this cloud validation.

### A05 — Deterministic Today reasons and the task-gap group

- **Covers:** R07.
- **Already proven locally:** `today-query-service.test.ts`.
- **Cloud/device steps:** Open `/workspace/job-search/today`. The undated `HIGH`
  Task and the past-due `BLOCKED` Task on App-A05-High appear in "Needs
  attention" with their reasons (`HIGH_PRIORITY`, `OVERDUE` + `BLOCKED`); a task
  with overlapping reasons is counted once. App-A05-Gap appears only in
  "Applications without open tasks", not as an inferred deadline.
- **Pass condition:** Deterministic reasons match MCP `workspace_get_today`; the
  gap group is separate; overlapping reasons do not inflate the count.

### A06 — Complete a task and read back in a fresh conversation

- **Covers:** R06, R08, R15.
- **Already proven locally:** `synthetic-completion-verification.test.ts`,
  `task-service.test.ts`.
- **Cloud/device steps:** Within a bounded write window, complete Task-A06
  through the browser. Verify `DONE` + completion time + version in the detail
  view, reload, and reopen the saved link. In a fresh ChatGPT conversation call
  `workspace_get_task({ taskId })` and confirm the same `DONE`, completion time,
  version, Project ID and HTTPS `webUrl`. Return Web to read mode.
- **Pass condition:** Web and fresh ChatGPT `workspace_get_task` agree exactly;
  the completed record survives reload and a new conversation.

### A07 — Save one candidate, dismiss another, then run recommendations again

- **Covers:** R09, R10.
- **Already proven locally:** `job-candidate.test.ts`.
- **Cloud/device steps:** Save Cand-A07-Save and dismiss Cand-A07-Dismiss
  (browser Jobs view or MCP `workspace_decide_candidate`). Record a new
  recommendation run (`workspace_record_recommendation_run`) that re-presents
  both. Confirm the decisions persist, the saved/dismissed candidates are not
  re-labeled as newly discovered, and neither save/dismiss created an
  application or admitted a lifecycle change.
- **Pass condition:** Decisions persist and survive re-recording; recommendations
  do not reverse them and create no application.

### A08 — Record an actual application and link a candidate without duplication

- **Covers:** R11.
- **Already proven locally:** `job-candidate.test.ts` (link dedup/idempotency).
- **Cloud/device steps:** From ChatGPT, call `workspace_create_job_application`
  for Cand-A08's company/role. If it returns `POSSIBLE_DUPLICATE`, the user
  explicitly selects the existing App-A08. Link Cand-A08 to the selected
  application via `workspace_link_job_candidate`. Retry the same link intent;
  confirm no duplicate application or link is created.
- **Pass condition:** Duplicate resolution applies; the link succeeds once;
  retry does not duplicate the application or the link.

### A09 — Double-submit or lost response resolves to a single execution

- **Covers:** R08, R12, R13.
- **Already proven locally:** `idempotency.test.ts`, `task-service.test.ts`.
- **Cloud/device steps:** Replay the exact Task-A09 completion intent (same
  idempotency key) and confirm it returns the stored response with zero
  additional database changes and no duplicate audit row. Optionally simulate a
  lost response by re-reading the Task and re-submitting the same intent key.
- **Pass condition:** Same intent executes once; retry/readback resolves
  uncertainty; a changed payload conflicts and user input is retained.

### A10 — iPhone portrait with Windows completely off

- **Covers:** R14, R16.
- **Already proven locally:** S1-03/S1-04 synthetic Chrome at 390px/320px.
- **Cloud/device steps:** Fully power off the Windows PC (not sleep/lid-closed).
  On iPhone Safari over cellular (Wi-Fi off), open Today, filter the inventory,
  save/dismiss a candidate, complete Task-A10 (within a bounded write window),
  and read back the completed record in a fresh ChatGPT conversation. No step
  may depend on the Windows PC, and core actions must require no horizontal
  table scrolling.
- **Pass condition:** Direct open, filtering, save/dismiss, completion and fresh
  readback all pass on iPhone portrait with Windows off. (This subsumes the
  separately recorded S1-05B.4 iPhone completion if that gate has not yet run.)

### A11 — Source failure or unacknowledged delivery is recorded truthfully

- **Covers:** R10, R13.
- **Already proven locally:** `recommendation-run.test.ts`.
- **Cloud/device steps:** Record Run-A11-Complete (`COMPLETE`, empty items),
  Run-A11-Failed (`FAILED`, empty), and Run-A11-Unknown (`COMPLETE`,
  `UNKNOWN` delivery). Read all three back (`workspace_get_recommendation_run`):
  the failed run is not reported as "no new jobs"; the unknown-delivery run is
  not reported as "delivered"; the complete empty run is a truthful empty result.
- **Pass condition:** Coverage/delivery statuses are truthful; no false
  "no jobs" or "delivered" claim.

### A12 — ChatGPT opens an object and the UI returns its context reference

- **Covers:** R01, R15.
- **Already proven locally:** `web-auth-transport.test.ts` (context-copy route).
- **Cloud/device steps:** From ChatGPT, read App-A01 or its Task and follow the
  HTTPS `webUrl` through login to the same object. In the UI, use "Copy context
  for ChatGPT" and confirm it returns a short question plus the exact object ID;
  verify the selectable-text fallback works without host SDK globals, then use
  the copied reference in a fresh conversation to retrieve fresh state.
- **Pass condition:** Correct object resolves; fresh state is retrieved; the
  copyable fallback works.

## Phase 3 — Evidence matrix (record as you go)

Complete one row per scenario immediately after it runs; do not batch at the
end. This matrix is the authoritative PASS/PARTIAL/FAIL ledger.

| Scenario | Fixture | Entry | Mutation | Expected authoritative state | Evidence | Result |
| --- | --- | --- | --- | --- | --- | --- |
| A01 | App-A01 | Safari | No | Same authorized application; wrong account denied | readback + denial | PASS/FAIL |
| A02 | App-A02 | ChatGPT + Web | No | Proposal labeled; lifecycle unchanged | proposal + project readback | PASS/FAIL |
| A03 | Task-A03 | ChatGPT + Web | Yes | Version conflict protected | MCP + Web logs | PASS/FAIL |
| A04 | 106 seeded + App-A04-History | Web | scoped | Truthful paging past 100 / 10 | pagination readback | PASS/FAIL |
| A05 | App-A05-High + App-A05-Gap | Web + MCP | No | Deterministic reasons; gap separate | Today readback | PASS/FAIL |
| A06 | Task-A06 | Web + ChatGPT | Yes | DONE + time + version agree | `workspace_get_task` | PASS/FAIL |
| A07 | Cand-A07-Save / -Dismiss | MCP/Web | Yes | Decisions persist | candidate readback | PASS/FAIL |
| A08 | Cand-A08 + App-A08 | MCP | Yes | Exactly one application/link | project + candidate readback | PASS/FAIL |
| A09 | Task-A09 | Web/MCP | Yes | Single execution | idempotency readback | PASS/FAIL |
| A10 | Task-A10 + candidate | iPhone Safari | Yes | Windows-off completion + readback | device evidence | PASS/FAIL |
| A11 | Run-A11-* | MCP | scoped | FAILED / UNKNOWN / COMPLETE truthful | run readback | PASS/FAIL |
| A12 | App-A01 / Task | ChatGPT + Web | No | Context copy resolves | context-copy readback | PASS/FAIL |

## Phase 4 — Evidence freeze / release decision

Only a 12/12 full PASS permits writing:

```text
P6 COMPLETE — Job Search first product increment complete
```

Any PARTIAL/FAIL leaves the increment incomplete and lists only the failed
scenarios as the remaining work. After a full PASS, stop adding Job Search
feature work and enter real-use dogfood; do not start ranking, resume/JD
scoring, additional domains, more Web edit controls, a scheduler, or an
autonomous agent before that dogfood runs.

## Cross-cutting boundaries

- Keep Web in read mode (`PAW_WEB_WRITES_ENABLED=false`) except for a bounded
  window during browser mutation checks (A03/A06/A09/A10, and A07 if using
  browser decisions). Return to read mode immediately after each.
- Do not mutate a real application, the retained S1-05B fixture, identity links,
  credentials, or bootstrap; do not expose ports 80/3000/3001 publicly.
- All writes are explicitly user-authorized with a unique idempotency key and a
  short `authorityReference`; no model inference performs admission or linking.
- A candidate link never creates an application; duplicate resolution is the
  user's decision.
- The A04 seed command is the only bulk write; it is prefix-only and never
  touches observations, candidates, links, tasks, or non-synthetic rows.

## Stop conditions

Escalate to the human (do not "fix" silently) if:

- any Phase 0A deployment/rehearsal step or Phase 0B smoke check fails;
- a health check, `web:check`, backup, or capacity sample fails;
- a wrong-account denial, CSRF/origin rejection, or a secret/identity issue is
  suspected;
- two consecutive completion attempts fail or smoke checks remain failing;
- any step would require a destructive operation (data deletion, down migration,
  live database restore).
