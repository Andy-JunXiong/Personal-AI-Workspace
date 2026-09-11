# Single-application preparation context

Status: implemented and locally verified on September 11, 2026. Production
deployment and real-application acceptance remain pending.

## Continuity and benefits

### Upstream requirement

The [September 11 roadmap](../strategy/PRODUCT_SOLUTION_ROADMAP.md#r2最小-context-projection)
requires one bounded read of an application's current state, open Tasks, saved
JD and comparison, resume options, submission evidence and history limits. R1
delivered stable per-job resume IDs, but an agent still had to combine separate
reads and could silently choose the most recently edited copy.

### Current package

This package extends the existing read-only `workspace_get_project` response with
`preparationContext`; it does not add a thirty-first tool or another persistence
model. The caller supplies an exact Project ID. If one application-linked working
resume exists, its current content and record version are returned. If several
exist, the response lists bounded metadata options and requires an exact optional
`resumeVariantId` on the next read. A selected working copy remains distinct from
Drive-backed confirmation of what was submitted.

The projection reports its read time, missing materials, Resource/transition
limits and whether those histories are truncated. It reuses the sibling
`applicationProfile`, `resumeAssociations`, `openTasks`, `resources` and
`transitions` in the same result rather than duplicating JD, comparison or
confirmation bodies. The complete read is composed inside one SQLite transaction.

This package does not fetch Gmail or Drive, call a model, write business data,
select a submitted resume from recency, create a table or cache, change lifecycle
authority, enable external matching, deploy, or perform real-data acceptance.

### Downstream enablement

After production release and one real-application readback, R3 can prepare a
job/interview response from identified versions and attributable source records.
R3 still needs its own result/provenance contract. An immutable snapshot for a
PAW-exported resume that was actually submitted also remains a separate future
design; downloading or editing a working copy is not proof of submission.

### Short-term benefits

- One exact project read exposes material gaps and bounded-history warnings.
- Multiple working copies cannot be collapsed into an implicit latest-version
  choice; a mismatched candidate/other-application copy returns not found.
- The existing 30-tool surface, schema 018 and all write/authority rules stay
  unchanged.

### Long-term benefits

- A stable, versioned projection gives ChatGPT and a future second client the
  same object-level preparation input without creating a second context store.
- Separating mutable working content from attributable submission evidence keeps
  later analysis reproducible and preserves PAW's system-of-record boundary.

## Read contract

`workspace_get_project` accepts:

```json
{
  "projectId": "existing-job-application-uuid",
  "resumeVariantId": "optional-exact-application-linked-variant-uuid"
}
```

For a Job Application, the existing result now also contains:

- `preparationContext.contractVersion` and `readAt`;
- dossier availability and the exact saved profile Resource reference;
- application-linked working-resume options plus zero or one selected content
  body, its own `recordVersion` and base-source version;
- confirmed-file/version Resource references, while the sibling
  `resumeAssociations` retains the full confirmation basis;
- ordered `missingItems` for posting reference, JD, structured skill comparison,
  submitted file/version, working resume or required working-resume selection;
- returned/total/limit/truncated facts for Resources and transitions, and complete
  open-Task counts.

Non-Job Projects receive `preparationContext: null`. Existing top-level fields and
the 10-item Resource/transition limits are retained. The selected working resume
is automatically included only when exactly one application-linked option exists.
With several options, no content is returned until an exact option is supplied.

## Local verification

This is a Level 2 read-contract change under [risk-based verification](../VERIFICATION.md).
Both server and browser TypeScript checks passed. Eight affected integration files
passed, 38 tests total: the new projection cases, existing dossier and Drive
association reads, resume-variant persistence/caller behavior, MCP discovery/
transport, scoped Web identity, Workspace persistence and existing job-search
queries. Coverage includes a complete dossier, history truncation, zero-write
readback, single and multiple working copies, explicit selection, cross-target
rejection and fully missing materials.

The full suite and production build were not run locally. After publication,
GitHub `Verify` run 61 passed on Node 24 against exact runtime source commit
`2b15664b34eebd4cd6aa4a3cbf315304633ab82c`: both TypeScript checks, 423 tests
in 55 files, the production build, pinned Workspace Skill packaging and artifact
upload succeeded. This documentation-only follow-up reuses that evidence because
the runtime source is unchanged.

Migration/recovery, deployment and live-data checks were not run. No schema,
permission, dependency or build configuration changed. Production acceptance must
still verify one real application, payload usefulness and the number of tool calls/
material omissions before R2 is marked accepted.
