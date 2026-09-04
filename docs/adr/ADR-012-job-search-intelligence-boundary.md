# ADR-012 — Evidence-first Job Search Intelligence boundary

**Status:** Proposed for post-M4 implementation

**Date:** 2026-09-04

## Context

The verified MVP owns durable Job Application lifecycle and Task state, while
Gmail and other connected apps remain authoritative for their native records.
Real use also needs job-description recovery, submitted-resume identification,
skill aggregation, match assessment, and spreadsheet reporting.

Putting those values directly into one spreadsheet row would mix source facts,
inference, durable state, and presentation. Allowing scheduled model output to
write canonical state would also weaken the existing evidence and admission
boundaries.

## Decision

Adopt the target architecture in
[`JOB_SEARCH_INTELLIGENCE_ARCHITECTURE_v1.md`](../architecture/JOB_SEARCH_INTELLIGENCE_ARCHITECTURE_v1.md)
as the post-M4 design baseline.

The decision has five parts:

1. Model postings, resume artifacts and application-resume relationships,
   normalized skills, evidence-backed requirements/capabilities, immutable
   analysis runs, match assessments, and proposed change sets separately.
2. Keep provider-native facts authoritative in their providers. Workspace owns
   canonical cross-system work state and the versioned intelligence ledger.
   Google Sheets is a review and projection surface, not a competing system of
   record.
3. Route ingestion through scan, observation, extraction, identity resolution,
   proposal, review, idempotent apply, and readback verification. Confidence
   never grants authority.
4. Derive skill demand, coverage, recurring gaps, and watch signals from
   versioned evidence. Keep exact and inferred populations visibly separate.
5. Make analytical output append-only and reproducible through source IDs,
   fingerprints, input manifests, taxonomy/ruleset versions, successor links,
   and recorded admission authority.

## Safety boundary

The initial target operating mode is `DRY_RUN`, then `REVIEW_REQUIRED`.
Lifecycle changes, application identity, submitted-resume claims, and other
material changes require explicit user approval. Any future deterministic
automation requires a separate accepted ADR and explicit opt-in.

This ADR does not modify the active M4 runtime. It authorizes no schema
migration, MCP tool, connector, scheduler, model call, or automatic write.

## Consequences

### Positive

- A match score can be explained and reproduced.
- Source facts, inference, and canonical state remain distinguishable.
- Multiple resume and JD versions can coexist without overwriting history.
- Aggregates can exclude weak evidence instead of presenting false precision.
- Spreadsheet reporting can evolve without owning business truth.

### Costs

- The post-M4 implementation needs more entities and explicit reconciliation.
- Provider identity and expired-page handling require careful adapters.
- Taxonomy and scoring rules need version governance.
- Append-only analysis increases storage, though stored source content remains
  minimized.

## Alternatives rejected

### Make Google Sheets the system of record

Rejected because cell edits do not provide the required lifecycle authority,
optimistic concurrency, immutable evidence relationships, or reproducible
analysis history.

### Store the latest score directly on Project

Rejected because a single mutable score hides which JD, resume, taxonomy,
ruleset, and model/configuration produced it.

### Treat high model confidence as write authority

Rejected because confidence concerns evidential certainty, not permission.

### Implement direct Gmail/Drive background ingestion during M4

Rejected because it would invalidate the active feature-frozen evaluation and
expand privacy and operational scope before the M4 decision.
