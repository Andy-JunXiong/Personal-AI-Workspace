# Repository guidance

Read [current status](README.md#current-state--2026-09-10), the applicable
[core workflow](docs/architecture/CORE_JOB_WORKFLOW.md), and the required
[development standard](docs/DEVELOPMENT_CONTINUITY_STANDARD.md). Preserve existing
user edits and distinguish local verification from production acceptance.

## Verification

Use **minimum sufficient evidence**, based on the actual impact of the change.
Available validation is not required validation. Before running checks, inspect
the task's diff, identify affected callers/contracts, and state briefly what needs
verification. Follow [docs/VERIFICATION.md](docs/VERIFICATION.md) for levels and
the test matrix; use the repository
[targeted-verification Skill](.agents/skills/targeted-verification/SKILL.md) when
selecting or revising the verification scope.

- Docs-only: diff and relevant references. Local code: directly affected checks.
  Shared behavior: affected component and caller checks.
- Full-suite gate: explicit user request, actual release/RC preparation, shared
  contracts spanning components, schema/migration, authority boundaries,
  test/build infrastructure, broad dependency impact, unexpected cross-component
  failures, or impact that remains unbounded after focused inspection. State the
  concrete trigger. A trigger permits broader checks; release requirements remain
  mandatory. Do not turn a small fix into release preparation to justify testing.
- Stop when the changed behavior and affected contracts have sufficient passing
  evidence and no unresolved finding suggests broader regression risk.
- Reuse successful evidence for unchanged code, dependencies and relevant
  configuration. Repeat only checks invalidated by later edits or new findings.
  A documentation follow-up does not invalidate runtime results.
- Report checks actually run, why broader checks were omitted, and specific
  residual risks. Never describe unrun checks as passed.

Keep existing tests, CI gates, release validation and business/permission contracts
intact. This guidance changes verification selection, not application behavior.
