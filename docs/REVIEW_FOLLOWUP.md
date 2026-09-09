# Repository review follow-up

**Decision date:** 2026-09-08. **Status:** Historical review follow-up.
September 9 successor: filtered manual/website recovery passed, the retained
daily task is enabled, and the first actual scheduled result remains pending.
See [daily acceptance](mvp/DAILY_WORKFLOW_ACCEPTANCE.md) and the
[current release](architecture/APPLICATION_RESUME_ASSOCIATIONS.md).
The separate repository description/topics proposal below has not been applied
or rechecked by the end-of-day source-publication task; Git fetch/push access is
independent of that earlier GitHub CLI metadata-authentication result.

## Continuity and benefits

The user requested execution of the external review follow-up after local checks
confirmed contradictory historical README/M4 statements and the missing daily
acceptance evidence. This package rewrites the current entry point, retires the
frozen evaluation without rescoring it, defines a prospective integrated protocol,
indexes the documentation and consolidates the next operational gate.
It enables maintainers to proceed from one current boundary and an explicit
acceptance checklist. Immediate verification covers link/index completeness and
preservation of original M4 text. The expected long-term benefit is traceable
evaluation and less contradictory handoff material. No runtime code, schema,
deployment, mailbox content, business data or task configuration was changed.

## Delivered changes

- [README](../README.md) retains the thesis and principle, updates architecture,
  distinguishes production from locally verified and proposed work, and replaces
  the old Spike status narrative with current state and historical links.
- [M4 v0.3](dogfood/M4_REAL_USE_EVALUATION_v0.3.md) retires the active v0.1/v0.2
  experiment, retains original evidence and thresholds, and defines a new
  not-yet-started cohort. No retrospective experiment success or failure is claimed.
- [INDEX](INDEX.md) records active contracts, historical evidence and unimplemented
  proposals. Partial delivery is labeled explicitly. The development standard
  requires entries for future docs and dated evaluation records.
- [Daily acceptance](mvp/DAILY_WORKFLOW_ACCEPTANCE.md) records a live read-only
  service/scan-ledger check and separates manual, scheduled and sustained-use gates.
  The release handoff, core workflow and kickoff link to the current decisions.

## Verification and remaining limits

Local document verification passed 403 link/anchor checks across 15 changed/new
Markdown files. The index covers all 111 docs/evaluation Markdown documents
(excluding the index itself), plus the two operating policy files. All three
original M4 document bodies are preserved exactly after their retirement notices.
`git diff --check` passed. Application tests were not rerun for this documentation-only
package; 291 and 327 remain attributed historical test results.

At 19:48 Sydney, live Workspace reads confirmed database availability and only
one historical PARTIAL manual scan, no checkpoints and no processing streams.
The current context has no ChatGPT scheduler management interface. The task
switches, production image and any support reply were not fetched. No fresh
manual scan or scheduled execution was attempted, and recovery is not claimed.

## GitHub repository metadata

Prepared description:

> Persistent work-state layer for ChatGPT: evidence-backed job tracking, durable MCP operations, and a shared reporting website.

Prepared topics: `chatgpt`, `mcp`, `typescript`, `sqlite`, `job-search`,
`workflow-automation`, `evidence-provenance`, `self-hosted`.

Remote application is pending: the installed GitHub CLI's repository query
returned HTTP 401 (Requires authentication). The available GitHub connector
tools do not expose repository description/topic mutation. This is an
authentication/capability limitation, not an automatic approval rejection.
After restoring CLI authentication, apply and read back:

```powershell
gh repo edit Andy-JunXiong/Personal-AI-Workspace --description "Persistent work-state layer for ChatGPT: evidence-backed job tracking, durable MCP operations, and a shared reporting website." --add-topic "chatgpt,mcp,typescript,sqlite,job-search,workflow-automation,evidence-provenance,self-hosted"
gh repo view Andy-JunXiong/Personal-AI-Workspace --json description,repositoryTopics
```

Topics describe project scope; automation is still explicitly pending operational
acceptance in the README. The user subsequently authorized committing and pushing
this documentation package. Source publication does not deploy a release, change
production data or activate either scheduled task.

## AI Radar reuse disposition

Retain one canonical source for each design until a second consumer proves an
extraction boundary. Shared modules are deferred behind daily workflow acceptance.

| Source | Reusable part | Limit before extraction |
| --- | --- | --- |
| [ADR-012](adr/ADR-012-job-search-intelligence-boundary.md) and [intelligence architecture](architecture/JOB_SEARCH_INTELLIGENCE_ARCHITECTURE_v1.md) | Immutable analysis, input manifests, versioned taxonomy, successor links, review modes | Proposed design, not a verified implemented intelligence ledger; AI Radar integration was not inspected |
| [ADR-009](adr/ADR-009-cross-app-evidence-handoff.md) | Provider-native source authority, minimized evidence and separation of observation from admission | Its Spike-specific prohibition on a Workspace Gmail connector is historical, not a reusable current deployment rule |
| [Logical fingerprint](../deploy/cloud/database-logical-fingerprint.mjs) | Read-only deterministic table/schema/content fingerprint | Requires SQLite and better-sqlite3; migrations intentionally alter the fingerprint, and views/triggers/index definitions are outside its table-only digest |
| [Synthetic completion verifier](../deploy/cloud/verify-synthetic-completion.mjs) | State/audit/idempotency verification and replay with zero data delta | Not portable as-is: hard-coded PAW fixture, task/project schema and WorkspaceService dependency; opens a writable connection and invokes a mutation-capable replay path |
| [Cloud deployment scripts](../deploy/cloud) | Service isolation, ingress, backup and rollback patterns | Parameterize paths, domains, secrets, runtime and retention only after checking both actual deployments; no shared infrastructure changes here |

The next operational milestone remains a complete bounded manual scan and a
correlated real scheduled execution, then prospective observation under v0.3.
