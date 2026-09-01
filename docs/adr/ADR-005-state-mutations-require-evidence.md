# ADR-005 — Durable state mutations require attributable evidence

**Status:** Accepted

## Decision
Observation, proposal, validation, admission authorization, and state mutation are separate concepts.

Model inference alone is not admission authority.

Admission requires either:
1. explicit user authority, or
2. an explicitly enumerated deterministic rule.

For externally-derived changes, the transition must reference evidence/provenance.

Proposal Validation and Admission Authorization are separate decisions:

```text
Proposal
  -> structural and lifecycle validation
  -> valid proposal
  -> admission authorization
  -> admitted durable mutation
```

A valid proposal does not authorize its own admission. Evidence proves that an
observation was recorded; evidence presence alone does not prove the model's
interpretation of it.

For Spike 1A, runtime lifecycle admission uses a separate development-only
explicit-user assertion. The only deterministic rule is
`SPIKE_FIXTURE_IMPORT`, which initializes the seeded Project at `APPLIED` and
cannot admit a runtime lifecycle edge. No general policy engine is introduced.

The admission record stores the authority type and an attributable reference.
