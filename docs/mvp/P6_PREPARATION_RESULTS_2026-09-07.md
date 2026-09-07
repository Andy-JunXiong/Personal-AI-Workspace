# P6 preparation review — 2026-09-07

**Status:** Local preparation verified: 26 test files / 227 tests, typecheck,
production build. A01–A12 remain unexecuted; no cloud deployment or real-data
write was performed in this session.

## Continuity and benefits

### Upstream requirement

The [P6 plan](P6_ACCEPTANCE_PLAN_v0.1.md) implements the complete-journey gate
from the [interface requirements](JOB_SEARCH_SECONDARY_INTERFACE_REQUIREMENTS_v0.1.md).
Today's existing work added a bounded A04 seed and a cloud/device procedure.
This review closes local validation gaps before that procedure is used.

### Current package

- Reject malformed counts such as `1.5`, `5jobs`, and `1e2` instead of silently
  parsing their integer prefixes. The accepted range remains 1–200.
- Verify the default 106-application dataset and identical-ID replay with a
  byte-identical serialized database after replay.
- Verify an unmapped principal fails without creating identity or data.
- Correct the retained synthetic Task ID, distinguish MCP discovery from ping,
  and test A03's stale submission before refresh. Include the necessary browser
  write windows for A03 and optional browser A07 decisions.
- Identify the migration rehearsal prerequisite explicitly in Phase 0A.

No runtime schema, MCP tool, production configuration, identity, or real
application was changed. Existing uncommitted work was preserved and extended.

### Downstream enablement

Next prepare a migration-aware isolated-copy rehearsal for S1 → S2. The
existing rehearsal compares whole-database fingerprints before and after
startup and expects no change; legitimate migrations 006–008 violate that
invariant. It also requires the candidate image to already exist. Its two
images each receive a fresh backup copy, so it does not prove the previous
image can start against the newly migrated database.

The next procedure must establish expected schema additions, preservation of
pre-existing rows, integrity, no-op second startup, and previous-image startup
against the migrated copy. Then obtain the separately scoped cloud deployment
and synthetic-write authorization recorded in the P6 plan, execute the
rehearsal, deploy S2, and pass Phase 0B before A01–A12. The human iPhone and
fresh-conversation evidence remains required.

### Short-term benefits

Verified: malformed seed counts cannot silently select a different dataset;
the default dataset exceeds 100; replay and unmapped-principal rejection do
not change the database in the covered cases. The plan now exposes an actual
deployment blocker instead of prescribing an incompatible rehearsal command.

### Long-term benefits

Expected: explicit migration and rollback evidence will make future schema
releases reproducible. This benefit is not yet proven on the cloud release.

## Verification

- `npm.cmd run verify`: PASS, 26 files / 227 tests, both TypeScript checks,
  and production build.
- PowerShell blocked the `npm.ps1` shim under its execution policy; using
  `npm.cmd` completed verification without changing that policy.
- Synthetic test databases only; no cloud endpoint was contacted.

## Remaining gates

- Migration-aware copy rehearsal implementation and execution.
- Separately authorized S2 deployment and deployed-image regression smoke.
- Scenario-specific synthetic fixtures, A04 cloud paging, and A01–A12 evidence.
- iPhone portrait with the Windows PC fully off and fresh ChatGPT readback.

P6 is not complete. No scenario is marked PASS by this local preparation.
