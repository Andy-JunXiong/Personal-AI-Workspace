# Single-application preparation context

Status: deployed September 11, 2026 as `application-preparation-20260911-r1`.
Real Nuix readback and a source-grounded preparation example passed within the
material gaps recorded below. Complete-dossier and refreshed connector explicit-
selection acceptance remain pending; R3 is not declared implemented.

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

## Production release and bounded real-use acceptance — September 11

### Continuity and benefits

The user authorized the proposed R2 deployment, real-application read and one
preparation example. This closes the source-only release gap and demonstrates
that an actual saved working resume can support a qualified preparation answer.
It enables R3 result/provenance design, while a complete saved dossier and the
client's refreshed explicit-selection input remain acceptance gaps. The verified
short-term benefit is access to the real v3 working content in one project read;
long-term cross-client consistency remains an expectation, not R4 acceptance.

### Release evidence

- Exact runtime source: `e1b69374a48bc80daba75934657d9044fc94879d`, [PR 24](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/24).
- Local Node 24: both TypeScript checks, **425 tests in 56 files**, production
  build and pinned Skill packaging passed. Packaging initially rejected the
  literal `HEAD`; rerunning with the exact SHA passed. [CI run 34568376205](https://github.com/Andy-JunXiong/Personal-AI-Workspace/actions/runs/34568376205)
  independently passed the PR checks. Earlier main CI also passed on `f1647a9`.
- Source archive SHA-256: `71755d5b1ce0b34d174226382e94382bcc5ad96214222283470d7a13ffb6ed56`.
- Image: `sha256:2857c69d3723f69ec30985bab94547b01e6611e198a2b900bcb616eee94dacab`.
- Candidate/repeated-open/previous-image backup-copy recovery passed with schema
  018 unchanged. Fresh cutover backup: `workspace-20260911T060510Z.db`, integrity
  `ok`. No backup was restored over the live database.
- Cutover completed `2026-09-11T06:05:19Z` (**16:05 Sydney**). Before/after logical
  fingerprint: `209a426859d130302de7f6fad7a1922dffbf436e1ee5dc24053b0b67e1722c7c`,
  **47 tables / 1,971 rows**. Previous image `calendar-library-20260911-r1` remains
  the application rollback target.
- Service health and all five public boundary checks passed before/after release.
  General Web writes and bootstrap remain off; external matching remains disabled.
  Temporary operator-IP SSH access was restored after each remote action.
  A pre-existing systemd unit-change warning was observed; ingress restarted and
  public checks passed, but unit-file reconciliation was not part of this release.

### Real read and preparation result

The existing Nuix application was read before and after deployment through the
connected Workspace. Project versions, two Resources, one transition and zero
open Tasks agreed. The new result additionally returned its sole working copy at
recordVersion **3**, sourced from base version **8**; no resume was created or
edited for acceptance. Five gaps were correctly exposed: posting reference,
saved JD, structured comparison, submitted file and submitted version.

The deployed CLI's automatic single-copy read measured **1 business-tool call,
26,158 serialized response bytes and 74 ms**. A separate explicit-ID read measured
**1 call, 26,128 bytes and 48 ms**, returning the same v3 copy with `EXPLICIT_ID`.
These are VM-loopback measurements, not remote user latency. Selecting that copy
under the existing Wake in Cloud application returned `NOT_FOUND`. Live discovery
retained 30 tools and exposed `resumeVariantId`. Base v8 and Nuix copy v3 remained
unchanged. Multiple-copy ambiguity was tested synthetically; no extra real copy
was created just for testing.

This conversation's installed connector still exposed its older input schema,
without `resumeVariantId`; its ordinary project read returned the new projection
successfully. Explicit selection therefore has live SDK/loopback evidence, but
still needs a refreshed connector/client acceptance. It must not be reported as
already proven through the cached client schema.

A private Nuix preparation example was delivered outside Git. It cites the exact
working-copy version and a separately read current official same-title vacancy,
distinguishes self-reported career evidence from verified deployment facts, and
flags unproven enterprise-AI scale, engineering tenure and scheduled-run claims.
It does not imply the current vacancy is the historical posting used to apply.
No profile, posting reference, lifecycle, Task or submission confirmation was
written. Private reports are not indexed or copied into this repository.

Observed usefulness: R2 supplied the working resume missing from the old project
response, permitting a qualified example without another resume lookup. No
quantified old/new call-count reduction was measured. The saved JD/profile path
was absent in this real application; its full-dossier usefulness remains covered
only by synthetic checks. The CLI retains `NOT_ASSESSED` because human/content
review is recorded here rather than inferred by the checker. The next gates are
complete-dossier real use, refreshed connector selection and R3's saved-result/
correction contract. This release is not unattended daily-run or R4 acceptance.
