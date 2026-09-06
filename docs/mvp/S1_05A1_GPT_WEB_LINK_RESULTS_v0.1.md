# S1-05A.1 GPT-to-Web Link Results v0.1

**Status:** LOCALLY VERIFIED; HUMAN AND EXTERNAL ACCEPTANCE PENDING

**Date:** 2026-09-06 (Australia/Sydney)

## Continuity and benefits

### Upstream requirement

The user confirmed that a secondary browser interface is useful only when GPT
can take them directly to the relevant operating view. [S1-05A](S1_05A_LOCAL_OPERATIONS_RESULTS_v0.1.md)
prepared Web deployment modes, while S1-01 through S1-04 supplied the identity,
read pages and Task completion behavior. The remaining local gap was the
GPT-to-Web handoff itself.

### Current package

This package conditionally adds exact `webUrl` values to existing MCP read
results. `workspace_ping` and `workspace_get_today` advertise Today; application
listing/lookup advertises inventory and exact application pages; exact Task and
Today Task records advertise Task pages. It adds no MCP tool, database table,
write authority, public endpoint or external integration.

### Downstream enablement

This enables the S1-05B acceptance journey: ask GPT for current work, open its
returned HTTPS link on iPhone, perform one bounded synthetic action, and verify
the result in a fresh GPT conversation. A real hostname and successful external
authentication must exist before human testing starts.

### Short-term benefits

- The intended hybrid journey is now testable through the real MCP transport.
- GPT receives exact object URLs without constructing or guessing routes.
- Existing MCP clients see byte-for-byte-equivalent result shapes when Web is
  disabled, and the 13-tool discovery contract is unchanged.

### Long-term benefits

- GPT can remain the reasoning interface while deterministic inspection and
  commands move to a compact domain UI only when useful.
- Future secondary interfaces can reuse explicit, opt-in handoff links without
  coupling their availability to new MCP tools or database state.

## Delivered behavior

| MCP read | Link when Web is enabled |
| --- | --- |
| `workspace_ping` | Today entry |
| `workspace_get_today` | Today plus exact Task/application links in its sections |
| `workspace_list_job_applications` | Inventory plus exact application links |
| `workspace_find_job_application` | Exact application link for each match |
| `workspace_get_task` | Exact Task link |

The MCP server instruction tells the model that links are optional inspection or
action paths and that ChatGPT remains the primary reasoning interface. Links are
derived only from the already validated exact HTTPS `PAW_WEB_ORIGIN`; base/off
mode supplies no origin and therefore advertises no link.

## Verification

- Exact HTTPS validation rejects HTTP, credential-bearing and path-bearing origins.
- Canonical Today, inventory, application and Task URL construction passed.
- MCP transport returned all expected URLs through existing read tools.
- The transport test verified zero database changes across all link reads.
- The prior exact terminal-Task response remained unchanged with Web disabled.
- Full repository verification passed: 20 test files / 185 tests, server and
  browser typechecking, and production build.
- `git diff --check` passed.

## Human-test boundary

No human test is required yet. The operator must first complete the automated
S1-05B external setup, synthetic login/security checks, backup and recovery
preflight in the [Web operations runbook](../cloud/S1_WEB_OPERATIONS_RUNBOOK.md).
At that checkpoint development stops and explicitly asks the user to run the
recorded iPhone steps. The first human completion uses a synthetic Task, never an
existing real Job Search Task.
