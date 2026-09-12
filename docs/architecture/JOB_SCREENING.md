# Recoverable candidate screening

Status: September 12, 2026. Rule evaluator, immutable screening/override storage,
interactive MCP commands, shared candidate filtering and Web recovery are locally
implemented and verified. Migration 020 and the 34-tool server are not deployed.
No live candidate or private profile has been written by this package.

## Continuity and benefits

- Upstream: Jun requested fewer clearly unsuitable jobs, especially roles requiring
  long commercial engineering tenure, then supplied screening requirements and
  requested the next step. This extends the [candidate preparation workflow](JOB_LIBRARY_WORKFLOW.md)
  before the existing [letter-grade assessment](CANDIDATE_MATCH_GRADES.md).
- Current package: the deterministic evaluator now feeds immutable, version-bound
  screening records. Shared queries exclude only current filters, and explicit
  keep/withdraw controls preserve independent human choice. No private profile is
  embedded in source, and no model provider or scheduled ingestion is enabled.
- Downstream: production backup/recovery and deployment, refreshed-client use,
  then a real confirmed profile/JD screening with independent readback. The existing
  letter-grade assessment command retains its separate contract and acceptance.
- Short-term verified benefit: 490 tests pass, including screening history,
  attribution, concurrency, authority, pagination and recovery; a synthetic browser
  flow verifies actual filtering and keep/withdraw. Reduction in real unsuitable
  jobs remains to be measured after deployment and source-grounded use.
- Long-term expected benefit: explainable candidate selection with retained evidence
  and recoverable decisions, without conflating career preference with lack of ability.

Ownership follows the [existing roadmap](../strategy/PRODUCT_SOLUTION_ROADMAP.md#3-保留简化及不建设的内容):
the interaction host interprets JD/source material; PAW validates and stores domain
results. This module does not provide natural-language parsing or a scheduler.
Revisit the rule categories when real JD interpretation shows an unsupported case,
rather than substituting title or keyword heuristics.

## Executable boundary

[`screenJob`](../../src/domain/job-screening.ts) accepts validated structured input:

- Full saved JD text and an explicit full-review assertion. Exact quotation checks
  establish text attribution, not semantic accuracy or completeness.
- A positive profile version and per-category tenure evidence. `lowerYears` means
  at least that much established experience; `upperYears: null` means additional
  experience remains unknown. A confirmed shortfall requires an attributable upper
  bound below the requirement. No adding overlapping jobs or converting professional,
  consulting, software, AI/ML or direct-management categories into one another.
- Optional explicit tenure exclusions with a user-preference statement/reference.
  These can filter an unwanted career requirement without inventing a negative fact.
  Ambiguous engineering cannot be an exclusion category.
- Required, preferred or uncertain clauses, each with exact JD text, the host's
  separate interpretation and one or more alternatives. Alternatives are OR;
  separate clauses are AND. Compound conditions must be extracted accordingly.
- Non-tenure condition comparisons for location, work rights, clearance, specialist
  direction, qualifications, tools and compensation. Known outcomes need evidence;
  missing evidence stays UNKNOWN. Evidence references are caller-supplied here;
  persistence validates them against owned, versioned confirmed source records.

Output contains `ruleVersion`, `profileVersion`, overall decision, per-clause rules,
source quotes, candidate evidence and FACT/PREFERENCE/UNKNOWN basis. Alternatives
remain inspectable. The integration implements `recoverable: true` through retained
history and explicit overrides. `matchGrade` remains null: screening
does not assign or replace the separate A+ through B− assessment.

## Decision rules and limits

1. Incomplete full-JD review or no extracted requirements produces
   `USER_CONFIRMATION_REQUIRED`, even if provisional findings contain a blocker.
2. A satisfied alternative prevents another alternative from excluding the clause.
   An unknown alternative prevents a definitive exclusion; retain it for confirmation.
3. Preferred gaps can only deprioritize. Uncertain importance requires clarification
   before exclusion. Job titles alone never enter the rule engine.
4. Explicit tenure exclusions apply only to the same unambiguous category and at or
   above the user-specified threshold. They are preference evidence, not capability facts.
5. Confirmed same-category shortfalls at required SWE 8+ years, AI/ML engineering
   5+ years or direct people management 3+ years filter. Other confirmed tenure
   shortfalls deprioritize; broad experience requirements do not become SWE gates.
6. Confirmed mandatory location/work-rights/clearance/specialist/qualification
   mismatches filter. Tool and compensation gaps only deprioritize. Salary units,
   super inclusions, remote-location options, equivalent credentials and clearance
   exceptions must be interpreted upstream; ambiguity remains UNKNOWN. The evaluator
   does not make legal eligibility determinations or infer citizenship.
7. Across mandatory clauses, a conclusive FILTER takes precedence over confirmation,
   then DEPRIORITIZE, then EVALUATE. All findings remain available for review.

The supplied private career profile and compensation thresholds are deliberately
not embedded in this public repository. The profile must be attributable Workspace
data before live use. Facts described as merely unverified must not be imported as
confirmed absence, and assistant-generated memory summaries do not verify themselves.

## Integrated storage, commands and recovery

Migration [`020_candidate_screening.sql`](../../db/migrations/020_candidate_screening.sql)
adds `candidate_screenings` and `candidate_screening_overrides`; both have immutable
history triggers and Workspace/candidate/version uniqueness. Screening stores exact
input manifest, JD/profile/source snapshots, explicit profile source ID, evaluator
input/result, human-readable reason, provenance, actor and authority reference.
Profile version is the selected confirmed library source's actual record version;
it is not an unvalidated caller-created profile counter.

The [service](../../src/application/candidate-screening-service.ts) reuses assessment
input selection/fingerprints through `CandidateAssessmentService.inputs`, including
confirmed sources. A saved JD and available selected sources are required. All
candidate-evidence statements must be exact quotes from selected CONFIRMED sources,
with their source IDs as references. A missing base resume alone does not block
screening on a confirmed location or preference; letter grading retains its own
base-resume completeness rule. Input/snapshot bodies are each bounded at 600,000
characters, with at most 100 selected sources. Substring validation establishes
attribution, not whether an interpreted number/category is semantically correct.

| Entry | Contract |
| --- | --- |
| Existing `workspace_get_job_candidate` | `includeAssessmentContext` and `sourceIds` provide fresh source/body/manifest reads; default response now also carries a lightweight screening summary. |
| `workspace_record_candidate_screening` | Interactive MCP-only, explicit user authority, current candidate/screening versions, exact input manifest and confirmed profile source/version. Server derives the decision; caller-supplied decisions/grades are rejected. |
| `workspace_get_candidate_screening` | Current summary/report plus ten-item screening and override histories. Exact `version` returns immutable source snapshots; `beforeVersion` and `overrideBeforeVersion` independently page history. |
| `workspace_override_candidate_screening` | Explicit KEEP or AUTOMATIC withdrawal, fresh candidate/screening/override versions, idempotency and actual user authority. A new screening never resets KEEP. |
| `POST /api/v1/job-search/library/candidates/:id/screening-override` | Existing mapped session, same-origin and CSRF enforcement. Strict button intent/versions; server provides the authority reference. Remains available with general Web writes off, like scoped candidate decisions. No Web screening-generation endpoint is added. |

Writes are transactional with operation-scoped, principal-bound idempotency.
Changed payloads under one key or stale versions produce zero writes. Exact replay
returns the historical write result; callers read again for current validity.

`JobSearchQueryService` receives the screening projection from Workspace service
wiring. Web and MCP lists apply it before pagination and total counts. The
`screening` query is VISIBLE (default), FILTERED or ALL, independently combined with
decision, linkage, search and sorting. Current FILTER results are hidden only if
there is no KEEP override and the candidate is not SAVED. Explicit saved interest
also preserves visibility. KEEP does not undo a separate DISMISSED decision; its
decision filter remains meaningful.

Candidate identity, JD, base resume, selected sources, curated library or rule-version
changes make the prior screening STALE and visible again. The original report and
override history remain intact. Queries/overrides do not mutate candidate decisions,
application state, Tasks, submissions or letter-grade assessments. The shared query
streams matching candidates and computes exact totals; it is not constant-cost
pagination, and large-inventory performance is not claimed as accepted.

Jobs now offers “已筛除（可恢复）”, current/stale/unscreened labels, quoted reasons,
paginated history, a persistent keep button and explicit withdrawal. The original
candidate remains accessible by exact ID regardless of visibility. These controls
change list eligibility only; they never delete a job or submit an application.

## Earlier rule-core verification — September 12

Level 1, following [targeted verification](../VERIFICATION.md). The new module has
no production callers and no schema, identity, dependency or build configuration
change. Test fixtures are synthetic and do not reproduce the private career profile.

- `npx.cmd vitest run tests/unit/job-screening.test.ts`: 29 tests passed.
- `npx.cmd tsc --noEmit`: passed with the existing server project configuration.
- Documentation references and whitespace diff checked.

Full runtime suite, browser checks, build and deployment were not run because the
module is not integrated into those paths. These results validate structured rule
evaluation, not ChatGPT's extraction quality, saved-source truth, recovery UI or
live filtering. Prior user edits and the earlier September 12 readback notes are
preserved.

## Integration verification — September 12

The concrete Level 3 trigger is migration 020 plus shared Web/MCP list semantics
and explicit override writes. The source diff was reviewed against callers and
existing authority checks before running the [verification policy](../VERIFICATION.md).

- `npm.cmd run verify` passed: both TypeScript projects, **490 tests in 60 files**,
  and production build. The existing Python 3.13 executable was selected through
  `PAW_RESUME_PYTHON`; no interpreter installation or resume-code change was needed.
- Initial failures identified outdated expected tool/migration inventories and
  two new test expectations (optional MCP success flag, unauthenticated HTTP 401).
  Those assertions were corrected; strict existing gates were retained. The old
  018-to-019 proof is now pinned to that historical migration set, while the new
  019-to-020 proof verifies data/schema preservation and repeated startup.
- Migration verification uses the existing additive verifier, preserving every
  prior business table and migration record while requiring both new tables empty.
  [`verify-candidate-screening-migration`](../../scripts/verify-candidate-screening-migration.ts)
  is the repeatable entry point. Reopen and immutable-history tests pass separately.
- Browser checks used only the loopback synthetic
  [preview](../../tests/manual/candidate-screening-preview.ts). Default list showed
  two visible candidates; FILTERED showed one excluded candidate. Actual keep and
  withdrawal clicks persisted through the Web route. After withdrawal the default
  count returned to two, while the stale-JD candidate remained visible.
- Desktop width 1546 and requested 390px viewport (375px content plus scrollbar)
  had equal document scroll/content widths. Desktop detail and narrow list screenshots
  were inspected; the initial missing panel padding was corrected. No real mailbox,
  profile, candidate or production browser state was changed.
- Documentation diff, new-file whitespace and local reference targets checked.
  Unchanged successful runtime evidence is reused after documentation follow-up.

Next release gate: stage current source, rehearse production-copy backup/recovery,
deploy with migration/data-preservation and public/authenticated checks, then refresh
the connector for 34 tools. Real use requires explicitly confirmed profile evidence,
a complete saved JD and human review of the extracted conditions. Automatic JD
retrieval/scheduled screening, semantic extraction accuracy and sustained real-user
benefit remain unverified; backend external matching remains off. This record
does not claim production deployment or live-job acceptance.

## Release preparation — September 12

The next-step instruction authorizes release preparation and deployment on the
existing Lightsail runtime. The recovery helper now accepts
`--candidate-screening-upgrade` and selects the 020 verifier. Its existing sequence
starts the candidate twice and the previous image once against an upgraded copy,
with integrity and logical-data checks. Shell syntax and diff checks passed;
the unchanged 490-test application evidence above remains applicable.

The pre-release public Web check passed all five checks with general writes off.
This is baseline availability evidence, not new-feature acceptance. Direct SSH
timed out and the existing AWS browser session requires sign-in; production-copy
rehearsal and cutover have not run. Source packaging can proceed while the user
restores that session. No firewall or account permissions are expanded.
