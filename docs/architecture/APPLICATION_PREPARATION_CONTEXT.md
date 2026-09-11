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

## Repeatable MCP read check — September 11 follow-up

### Continuity and benefits

The pending R2 real-application gate above requires measured tool calls and
visible omissions. The new [read-check script](../../scripts/check-application-preparation.ts)
performs one `workspace_get_project` invocation against a supplied MCP endpoint
and exact application ID. This enables the release operator to capture the same
read evidence locally and after deployment. It does not deploy, write application
data, fetch sources or assess the quality of a preparation answer. Reusing one
check makes version selection and missing-material evidence repeatable across
clients; production usefulness and second-client acceptance remain unproven.

```text
node --import tsx scripts/check-application-preparation.ts --endpoint https://host/mcp --project-id UUID
node --import tsx scripts/check-application-preparation.ts --endpoint https://host/mcp --project-id UUID --resume-variant-id UUID
```

Use an already authorized bearer token in `PAW_MCP_BEARER_TOKEN` when the endpoint
requires it. The script does not acquire or refresh credentials. HTTPS is required
except on loopback; credentials in URLs and redirects are rejected. It can also
run as `node dist/scripts/check-application-preparation.js` after a normal build.

The JSON report includes the read time, elapsed milliseconds, serialized MCP
result size in UTF-8 bytes, missing items, working-copy IDs/versions, submitted
resume status and returned/total/truncated history counts. It omits resume/JD
bodies, file names and source text. `toolCalls: 1` counts the business-tool
invocation, not MCP initialization or transport requests. Two separate invocations
to resolve a choice cost two tool calls; comparisons across runs must retain both
reports and account for intervening data changes.

`readContractPassed` means the measured response fields satisfy the expected R2
shape and requested identity/explicit selection. It is not a full payload audit
or a completeness claim. Missing materials and unresolved choices remain visible
successful reads. `realApplicationUsefulness: NOT_ASSESSED` requires a separate
human review against the real application's known materials before acceptance.
An old server without R2 or an invalid selection fails rather than recording a
pass. Failure output omits potentially private transport error content.

Validation: `npm run typecheck` passed. The three existing preparation-context
integration tests passed; the two new read-check integration tests passed against
a local HTTP MCP server, exercising unresolved/explicit selection, report content
minimization, invalid-ID failure, unchanged SQLite `total_changes()` and rejection
of a pre-R2 response. Initial checker typing and a test-template URL were corrected
before the passing results. No runtime service, schema, permission or dependency
changed, so full-suite/build/release checks were not repeated. Live authentication,
production deployment, real-application omissions and usefulness remain pending.
