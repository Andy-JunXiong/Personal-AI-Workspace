# Risk-based verification

Status: active repository guidance for choosing local verification scope.
The [AGENTS.md](../AGENTS.md) entrypoint summarizes this policy; the
[targeted-verification Skill](../.agents/skills/targeted-verification/SKILL.md)
provides the procedure. This document owns the detailed levels and matrix.

## Continuity and benefits

Jun's request to reduce unnecessary full-suite testing follows the September 10
[UI corrections](mvp/TODAY_AND_JOBS_2026-09-10.md): narrow changes expanded into
unrelated tests, environment troubleshooting and release attempts. This package
adds agent guidance, not a runtime verification framework. It enables the next
small change to use bounded checks while retaining existing CI and release gates.
Immediate verified outcomes are discoverable guidance, valid references and a
structurally valid Skill. Reduced iteration time is an expected benefit to assess
in subsequent work, not a measured result of this documentation change.
Longer term, recorded behavioral claims and reusable evidence should reduce
redundant work without duplicating Workspace business state or authority in Skills.

## Choose by impact, not file count

| Level | Actual change | Default evidence |
| --- | --- | --- |
| 0 | Non-runtime docs, comments, prose or formatting | Diff review; referenced paths/commands where relevant. No application tests. |
| 1 | Isolated helper/parser/error handling or one component | Directly affected tests; relevant lint/type checks when useful. For layout, inspect the affected rendered view and relevant widths. |
| 2 | Component behavior, MCP input/output, shared type, persistence or business rule | Affected unit and integration tests, including affected callers and relevant type checks. |
| 3 | Schema/migration, authority, cross-cutting protocol/infrastructure, build/test configuration, broad dependency change or actual release | Broader regression/full suite as justified; retain all applicable release gates. |

Classify the behavior, not the filename: a one-line shared validator may be Level
3; a layout stylesheet is not non-runtime documentation. Skill prose can change
procedure routing and deserves structural/behavioral review. An isolated MCP
implementation is not automatically a shared-contract change. Inspect its callers.

## Full-suite gate and escalation

Use the full suite only for an explicit user request, actual release/RC preparation,
shared contracts spanning multiple components, schema/migration, authority or
permission changes, test/build infrastructure changes, broad dependency impact,
unexpected cross-component failures, or impact that cannot be bounded confidently.
Record which concrete finding opens the gate before expanding. These conditions
allow broad validation; they do not require every available acceptance exercise.
Start with relevant checks when the risk is bounded. Start broad only when the
change is already clearly cross-cutting or the applicable gate requires it.

Do not independently add deployment, a release tag, a dependency upgrade, or an
infrastructure repair to a small task and then use that expanded scope to justify
the full suite. A routine wording edit to release notes remains Level 0; preparing
an actual release candidate retains the full release requirement.

The existing [CI workflow](../.github/workflows/verify.yml) still runs
`npm run verify` and packages pinned Workspace Skills. Actual release validation
still includes the full suite, both type checks and build, plus applicable
backup/recovery, migration and public acceptance checks in the existing runbooks.
This policy grants no deployment or production-data authority. Reuse trustworthy
results for the same release inputs where the applicable gate allows it; identify
their source rather than claiming that CI evidence was run locally.

If a targeted check fails, first distinguish a changed-code failure from an
environment problem or established unrelated failure. Investigate the narrow
cause; widen only when evidence links it to other components. Keep relevant
failures visible. Do not skip a required gate or fix unrelated infrastructure
merely to turn an optional broad run green.

## Repository test matrix

These are starting points, not checklists. Select files or test names exercising
the changed claim, and follow actual imports/callers when the map is insufficient.

| Change | Starting evidence |
| --- | --- |
| README/docs | Diff and affected references; no M1/M2/M3 runtime suites. |
| Skill procedure | Frontmatter, routing, links and realistic decision examples; applicable existing `tests/unit/*-skill.test.ts` only for the Skill changed. Packaging checks only if packaging changes. |
| Website layout/copy | Affected desktop/narrow view; relevant `web-auth-transport.test.ts` cases if controls/routes change. No lifecycle suite for CSS alone. |
| Isolated parser/helper | Tests using that helper; e.g. `gmail-message-body.test.ts` for message-body parsing. |
| MCP implementation/schema | Affected service tests and relevant `mcp-transport.test.ts` contract/caller cases. |
| Business/lifecycle rule | Relevant `job-application-lifecycle.test.ts`, `real-lifecycle-m3.test.ts`, or `task-service.test.ts` cases. |
| SQLite persistence | Relevant `workspace-service.test.ts` / `idempotency.test.ts` cases and the affected business flow. |
| Migration | Corresponding migration-verification test and affected integration/regression; preserve copy-recovery requirements for release. |
| Authority/admission | Affected identity/transport/state tests and broader regression as justified by shared callers. |
| Actual release/RC | Full `npm run verify` and applicable release runbook gates. |

Unit files are under `tests/unit/`; other named files are under
`tests/integration/`. Locate exact names with `rg --files tests` and callers with
`rg` before choosing a command. A narrowly scoped test can use Vitest's `-t` filter:

```text
npx vitest run tests/integration/today-query-service.test.ts
npx vitest run tests/integration/web-auth-transport.test.ts -t "serves candidate reads"
```

On Windows PowerShell use `npm.cmd` / `npx.cmd` when `.ps1` launchers are blocked.
The repository has server and browser TypeScript configurations; select the
relevant configuration when useful. Do not invent a file-level TypeScript check
that drops project compiler settings. `npm run typecheck` runs both configurations;
`npm run verify` additionally runs the entire test suite and build.

## Stop and reuse evidence

Stop once the changed behavior has been exercised, directly affected checks pass,
relevant contracts are validated, and no unresolved evidence suggests broader
regression. Test availability, spare time, or a desire for extra reassurance is
not a reason to continue.

Keep a compact working record: behavioral claim, affected inputs, check, result,
and any unresolved finding. Reuse passing results while their code, dependencies,
relevant configuration and fixtures remain unchanged. After a new edit, rerun
only checks it can invalidate. A resumed turn or a docs-only follow-up does not
invalidate prior runtime results. Do not create a new database, service or
verification framework to maintain this record; normal task notes are sufficient.
Separate pre-existing changes from this task, but include their real interaction
if they affect the code being changed. Do not repeat another worker's sufficiently
evidenced checks without conflicting findings or invalidated inputs.

## Reporting

Keep the report proportional to the work. Use these three fields, combining them
into a sentence for small changes:

- **Validation:** actual command/check and PASS/FAIL, with the behavioral scope.
- **Not run:** broader suite and the concrete reason it was unnecessary.
- **Residual risk:** specific unverified behavior or pending gate; if none is
  identified, say so within this change's scope rather than guaranteeing no risk.

## Policy-package validation — 2026-09-10

This documentation/procedure package is Level 0 with Skill structural checks.
Diff review and `git diff --check` passed. A one-off Python standard-library check
validated the Skill's two plain-scalar frontmatter fields, name/description bounds,
10 local links and named test-file references. The bundled `quick_validate.py`
could not run because its Python environment lacks PyYAML; that check is not
reported as passing, and no dependency was installed just for this package.

A manual decision walkthrough checked docs-only, UI, isolated parser, shared
schema, authority and release cases against the policy: narrow changes stay
bounded, real shared risks can expand, and actual release gates remain required.
A docs-only follow-up reuses prior runtime evidence. This checks the written
procedure; consistent agent behavior and time savings await subsequent tasks.

Application tests, type checks, build and deployment were not run: no application,
test infrastructure, shared runtime contract or release input changed in this
package. Existing application edits and their prior verification remain separate.
