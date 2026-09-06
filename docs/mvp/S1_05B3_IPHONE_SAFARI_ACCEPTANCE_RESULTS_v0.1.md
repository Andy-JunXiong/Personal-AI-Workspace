# S1-05B.3 Windows-PC-OFF iPhone Safari Acceptance — Results v0.1

**Date:** 2026-09-06 (Australia/Sydney).

**Status:** PASSED. The final pending S1 Web acceptance gate — the
Windows-PC-OFF iPhone Safari direct-Web read — passed over cellular with the
Windows PC fully powered off. The deployment remains in read mode; no write,
identity, ingress, application or data change was made for this check.

## Continuity and benefits

### Upstream requirement

The
[interface requirements](JOB_SEARCH_SECONDARY_INTERFACE_REQUIREMENTS_v0.1.md)
R01/R02, R14 and R16, and acceptance scenario A10, require a saved object link
to open independently on iPhone portrait with Windows completely off, without
any local Workspace or tunnel dependency. The
[P0 plan](JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md) gate G02/G08 treats
Windows-off mobile use as a release condition.

### Current package

S1-05B.2 already passed Google identity mapping, Route 53/Caddy HTTPS ingress,
recovery, capacity and one controlled synthetic completion, then returned the
deployment to read mode. This package is the remaining human device check: open
the retained synthetic Task directly in Safari over cellular and confirm the
same terminal object, reload it, reopen the saved link, and navigate to its
application and the Today dashboard.

### Downstream enablement

This closes the pending S1 Windows-PC-OFF evidence. The only remaining S1
question is the separately authorized decision on whether an iPhone *completion*
is required (a second synthetic fixture with temporary writes). The read-only
direct-Web check and the already-passed ChatGPT Web MCP readback are now both
evidenced.

### Short-term benefits

- The saved HTTPS object link works from a cold iPhone over cellular with no
  Windows PC, local process or tunnel on the path.
- Login returned to the same object with no repetition, confirming the exact
  deep-link and identity-mapping gates hold on mobile.

### Long-term benefits

- Independent mobile entry is proven for the retained synthetic object, the
  prerequisite for the S1 operational release's Windows-off acceptance.

## Evidence

- **Windows PC:** fully powered off (not sleep, hibernate or lid-closed).
- **iPhone:** Safari over cellular; Wi-Fi off.
- **PC dependence:** none — no step required the Windows PC or a local process.
- **Login:** Google sign-in succeeded once without repetition.
- **Elapsed time:** under 2 minutes from the Task URL to application + Today.

Retained synthetic fixture (unchanged; no real data):

- Project: `8568a3c3-768a-46b6-acf2-ac85e5108710`
- Task: `976b64d1-a758-486a-a8aa-c0322e684ede`
- Title: `SYNTHETIC TEST - Complete once through Web`

Direct-Web URLs:

- Task: `https://workspace.ai-radar-lab.com/workspace/job-search/tasks/976b64d1-a758-486a-a8aa-c0322e684ede`
- Application: `https://workspace.ai-radar-lab.com/workspace/job-search/applications/8568a3c3-768a-46b6-acf2-ac85e5108710`
- Today: `https://workspace.ai-radar-lab.com/workspace/job-search/today`

Accepted terminal reference: `DONE`, record version 2, completion time
`2026-09-06T10:10:28.617Z` (20:10 Australia/Sydney). The direct-Web check
returned the same terminal object, and a reload and a reopened saved link
retained it.

## Boundary

- Read-only: `PAW_WEB_WRITES_ENABLED=false` and
  `PAW_WEB_BOOTSTRAP_ENABLED=false`; no browser write was enabled.
- No new fixture was created and no real Task was used.
- Deployment unchanged: application image `paw:9303de5`, operational source
  checkpoint `4cb9015`. Port 80 remains closed and application ports remain
  loopback-only.
- Identity links and credentials were not recreated or rotated; no secret file
  was displayed.

## Non-goals / remaining decision

- iPhone Task *completion* was not performed. OpenAI currently documents custom
  MCP apps as unavailable on mobile, so the direct-Web read and the ChatGPT Web
  MCP readback are kept as separate evidence. If strict G08 still requires a
  completion made on iPhone, a new synthetic fixture and explicit authorization
  to temporarily enable writes are required first; that procedure is recorded in
  the [S1-05B.4 iPhone completion plan](S1_05B4_IPHONE_COMPLETION_PLAN_v0.1.md).

## Verification

This is a human device acceptance, not an automated check. No repository test,
typecheck or build is changed by this evidence-only record. The prior automated
verification boundary is unchanged from
[S1-05B.2](S1_05B2_AI_RADAR_DOMAIN_INGRESS_RESULTS_v0.1.md).
