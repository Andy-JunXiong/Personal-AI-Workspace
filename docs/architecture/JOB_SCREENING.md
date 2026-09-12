# Recoverable candidate screening

Status: September 12, 2026. Rule evaluator, immutable screening/override storage,
interactive MCP commands, shared candidate filtering and Web recovery are deployed
as `screening-profile-20260912-r1`, including migration 020 and the 35-tool server.
Release probes made no live profile or screening writes; subsequent user-reported
real writes and readback are recorded in the acceptance ledger below.

The later real-client attempt exposed a missing MCP profile-write path. The
[profile admission repair](#confirmed-profile-admission-repair--september-12) is
deployed and verified. [Real-client feedback](#real-client-acceptance-and-jd-ingestion-gap--september-12)
now confirms profile persistence and Google UNKNOWN/non-FILTER screening. Real
8+/10+ FILTER → KEEP remains blocked on candidate JD ingestion.

## Continuity and benefits

- Upstream: Jun requested fewer clearly unsuitable jobs, especially roles requiring
  long commercial engineering tenure, then supplied screening requirements and
  requested the next step. This extends the [candidate preparation workflow](JOB_LIBRARY_WORKFLOW.md)
  before the existing [letter-grade assessment](CANDIDATE_MATCH_GRADES.md).
- Current package: the deterministic evaluator now feeds immutable, version-bound
  screening records. Shared queries exclude only current filters, and explicit
  keep/withdraw controls preserve independent human choice. No private profile is
  embedded in source, and no model provider or scheduled ingestion is enabled.
- Downstream: controlled candidate JD ingestion, then real 8+/10+ FILTER → KEEP
  acceptance. Profile/Google readback is now reported complete by the user. The existing
  letter-grade assessment command retains its separate contract and acceptance.
- Short-term verified benefit: 490 tests pass, including screening history,
  attribution, concurrency, authority, pagination and recovery; a synthetic browser
  flow verifies actual filtering and keep/withdraw. Reduction in real unsuitable
  jobs remains to be measured through source-grounded use. Production-copy recovery,
  original-data preservation and authenticated list/detail reads now pass.
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

## Production release — September 12

After the user restored AWS sign-in, the existing Lightsail browser SSH session
confirmed the healthy `candidate-grades-20260911-r1` baseline. A normal browser tab
was used after the popup terminal failed to respond to interactions. No firewall,
instance, account role, scheduler or provider setting was changed.

- Release: `job-screening-20260912-r1`; source commit
  `e3cd5e84770bae3e0c216a2b3419b182ee780e98`.
- Source archive SHA256:
  `1e45e824217d7d85614eaac566c0c68fa750c0381d5c9336e6cdcaeaa33f0b01`.
  Server source: `/opt/paw-job-screening-20260912-r1`.
- Image ID: `sha256:2ec7068ec46774098e5ef431098de081b8340359e4c4bfa974a17756d7db9ae5`.
  Cutover reported healthy at **2026-09-12T04:10:56Z** (14:10 Sydney).
- The existing private S3 transfer bucket retained all four public-access blocks;
  the archive used AES256 encryption. After server checksum verification, the exact
  temporary object version and local presigned URL file were removed.
- Backup `workspace-20260912T041018Z.db` passed integrity checks. The 020 verifier
  preserved **47 prior business tables**, added only the two empty screening tables,
  and passed. The candidate image then restarted unchanged, and the previous image
  started against the same upgraded copy: all three healthy, **50 tables / 2261 rows**,
  with logical content preserved for repeated/new-old startup.
- Immediately before cutover, backup `workspace-20260912T041047Z.db` passed. The
  stopped/checkpointed production data was copied to the release's `-before` and
  `-after` directories under `/srv/paw/deployments`; the production migration again
  preserved all 47 prior business tables. Base + Web + Gmail overlays were retained.
  The rollback handler was available and did not need to run. General Web writes
  remain off; scoped existing writes retain their contracts.
- Post-cutover public `web:check --writes off` passed all five checks. An actual
  loopback MCP client discovered **34 tools**, including all three new commands,
  verified Workspace identity and read ALL/default/FILTERED counts **10 / 10 / 0**.
  The exact saved-JD candidate returned UNSCREENED and empty screening/override
  history. These probes made zero business writes.
- Authenticated browser acceptance passed after normal Google sign-in: the Jobs
  list displays 10 candidates and the new selector; choosing “已筛除（可恢复）”
  displays zero; the saved-JD detail shows “尚未筛选” with the source requirements
  intact. Existing ignored decisions were preserved. Real recovery clicks remain
  covered by the synthetic test evidence, not by a production mutation.

The unchanged 490-test/type-check/build evidence was reused; this release turn ran
production recovery, migration, public and authenticated acceptance instead of
repeating application tests. Next: refresh the ChatGPT connector, confirm profile
source evidence, and perform one complete real-JD screening with human-reviewed
requirements and independent readback. There is no live screening report yet;
automatic JD retrieval/scheduled screening and extraction accuracy are not accepted.

## Confirmed-profile admission repair — September 12

### Continuity and benefits

The user's real ChatGPT attempt confirmed new screening/context reads but could
not create a CONFIRMED profile. The only confirmed library item concerned one
employment date and must not stand in for an entire profile. The first release's
tests seeded confirmed sources directly, so its server/read acceptance did not
prove the full user journey. This repair adds the missing interactive MCP entry
over the existing library, enabling confirmation → profile save → fresh context →
screening → independent readback. Synthetic end-to-end evidence now exercises
that sequence from zero confirmed sources. Real user-profile admission remains
pending. Longer term, versioned confirmation receipts preserve attribution and
safe corrections without creating a second profile store or enabling model calls.

### Admission contract

`workspace_record_screening_profile` accepts the exact user-confirmed `content`,
`expectedProfileVersion`, `userConfirmed`, `authorityReference` and `idempotencyKey`.
It writes only the dedicated `screening:confirmed-profile` library source with a
server-controlled title, null source URL and CONFIRMED status. It cannot select or
confirm an arbitrary imported source, and Web-channel calls are rejected.

First read candidate assessment context. `sourceDirectory.items` now includes
`sourceKey`, identifying the dedicated profile; page the directory when necessary.
Use version 0 for initial creation and the observed version for updates. Read the
existing profile before presenting a replacement to the user. UNKNOWN experience
and explicit exclusion preferences must remain distinct; neither memory nor a JD
grants confirmation. This endpoint records user attestation, not independent proof
of career facts or semantic verification of what was said in a conversation.

The response returns `sourceId`, `recordVersion`, a manifest-compatible `hash`,
CONFIRMED status, the exact source snapshot and confirmation actor/reference/time.
The existing durable idempotency receipt stores that snapshot atomically with the
source write. A retry returns the original receipt even after later edits; changed
payloads conflict. A stale expected version fails before modifying the library.
The existing library Web editor retains its versioned editing contract; confirmation
receipts preserve the original snapshot, not an assertion that the current source
has never changed. No schema migration is needed.

After any save/replay, reread `workspace_get_job_candidate` with assessment context
and the returned source ID. The new confirmed source is discoverable and selected;
its change invalidates earlier library/input manifests and assessments. Never submit
the pre-save manifest. Existing screening snapshots preserve their historical inputs.
Source confirmation does not itself screen a candidate, change a KEEP override,
alter candidate decisions, or create applications/Tasks.

### Local verification

The concrete Level 3 gate is a new confirmed-source authority entry plus release
preparation. `npm.cmd run verify` passed **496 tests in 61 files**, both type checks
and the build with the existing Python interpreter. The affected tests first exposed
a synthetic fixture using the same posting URL for two candidates; the existing
deduplication correctly treated them as one. Distinct fixture URLs corrected that
setup; no candidate-deduplication behavior changed.

Six new tests cover the complete MCP flow without seeded confirmations, 5-year
UNKNOWN, explicit 8-year preference FILTER followed by KEEP, preserved DISMISSED
version 2, stale reports after profile updates, immutable historical screening
snapshots, durable confirmation receipts across reopen, stale/conflicting requests,
unauthorized channels/identities, workspace isolation and atomic rollback when
the receipt cannot be saved. Tool inventory expectations are now 35; source and
authority behavior remain scoped to the new command. No live profile was written.

### Profile repair production release

- Deployed `screening-profile-20260912-r1` from commit
  `bdc695688b9896daf074b0a17adb691f14bc59f5`; archive SHA256
  `b2d1f870625353128f6cb647a86a7eed61373f9e10594639e8006e35b6b54d4d`.
- Image: `sha256:dc0ecde05b7baf9cbade22aab9f586bc3fbe793b528c85dcdef23597a0154099`.
  Healthy cutover **2026-09-12T04:43:09Z** (14:43 Sydney). Source and logs remain
  under `/opt/paw-screening-profile-20260912-r1` and `/srv/paw/deployments`.
- Backup `workspace-20260912T044243Z.db` passed integrity. Candidate and previous
  `job-screening-20260912-r1` images both started against isolated copies with
  unchanged logical contents: **50 tables / 2261 rows**. The immediate pre-cutover
  backup was `workspace-20260912T044301Z.db`. No new migration, schema rollback or
  persistent-volume replacement occurred; base/Web/Gmail overlays were retained.
- The private transfer retained public-access blocks and AES256 object encryption.
  A terminal input sequencing error initially prevented the download command from
  running; separate input/submission steps resolved it. The downloaded archive hash
  and built image were independently read back. The exact temporary S3 object
  version and local presigned URL file were deleted after verification.
- Public Web checks passed all five boundaries with general writes off. Actual
  server MCP discovery returned **35 tools** and verified all five required profile
  command parameters. Authenticated loopback candidate context preserved Google
  candidate **v2 / DISMISSED**, screening **v0**, base resume **v8**, and **37** source
  directory entries with discoverable sourceKey metadata. No dedicated profile or
  screening report was inserted by the release probe.

The 496-test release evidence is reused after this documentation update. Browser
layout/recovery was not retested because no Web UI or route changed in this repair.
Next, refresh the client to discover `workspace_record_screening_profile`, save only
the already confirmed profile text, then reread current candidate context using the
returned source ID before recording screening. Never reuse stale versions/hashes
from the reported failed attempt. A real confirmed-source write and real screening
readback still require that user workflow; synthetic success is not live acceptance.

## Real-client acceptance and JD ingestion gap — September 12

### Continuity and benefits

The profile admission repair above unlocked the user's ChatGPT workflow. This
documentation follow-up records Jun's supplied real-write/readback feedback and
replaces the current pending-profile gate with the next concrete gap: controlled
candidate JD ingestion, followed by real FILTER → explicit KEEP recovery. It adds
no runtime code, deployment or business write. The reported immediate outcome is
correct handling of unknown tenure with candidate-state isolation; longer-term
recoverable exclusion of unsuitable jobs still needs the second real-JD exercise.

### Evidence origin and completed gate

Evidence is the ChatGPT acceptance feedback pasted by Jun on September 12, 2026.
Codex did not independently query production in this documentation turn. The earlier
release probes and their zero-write observations remain historical evidence.
Connector discovery was subsequently confirmed by the user, including the profile
command's five parameters and initial expectedProfileVersion = 0 behavior.

| Readback item | User-reported persisted result |
| --- | --- |
| Confirmed profile source | `9ea50d9d-be3d-4234-aede-1d67e31227b8`, recordVersion **1**, reviewStatus **CONFIRMED** |
| Google role | Senior Software Engineer, Android SRE |
| Screening | `ca99c2c7-3c99-4789-840f-1dbcfe5173ed`, recordVersion **1** |
| Computed screening decision | **USER_CONFIRMATION_REQUIRED**, not FILTER |
| Required 5-year software-development tenure | **TENURE_UNKNOWN** |
| Bachelor requirement | Satisfied |
| Preferred Master's CS/Engineering; 2-year distributed systems | Both UNKNOWN |
| Candidate state | recordVersion **2**, decision **DISMISSED**, unchanged |

The confirmed rule summary keeps commercial SWE tenure UNKNOWN. Approximately
6.1 years is a relevant-role span, neither established SWE tenure nor an upper
bound; it cannot prove either satisfaction or shortfall. The personal A-rule
exclusion applies only to explicit required 8+/10+ commercial/professional software
development/software engineering tenure, not broad engineering experience. The
Google 5-year requirement does not trigger that preference. No full private profile
is copied into this repository.

The feedback reports no candidate restoration, save-interest change, application
creation or application-state change. Thus the first real segment is reported
complete: confirmed profile → Google UNKNOWN/non-FILTER → preserved DISMISSED.
This does not establish letter-grade acceptance or real FILTER → KEEP recovery.

### Remaining gap and proposed next increment

Of the reported 10 candidates, the other **nine have MISSING_JD**. The user's
ChatGPT session could record candidate metadata but found no exposed command to
write an external full JD into candidate assessment context. Screening requires
that saved context and a real jdHash; webpage text or a posting link cannot stand
in for those persisted inputs. No second screening was fabricated.

The feedback identifies Accenture Sydney's
[Senior Full Stack Developer — Tech Lead](https://accenture.wd103.myworkdayjobs.com/AccentureCareers/job/Sydney-International-House-3-Sussex-St/Senior-Full-Stack-Developer---Tech-Lead_14489255)
as a proposed target, quoting “10+ years of commercial software development
experience”. That external JD was not independently fetched in this documentation
turn and is not reported as ingested or screened. Verify the complete text and its
required-clause interpretation when performing the next acceptance exercise.

Proposed development scope is a controlled JD write entry, for example
`workspace_record_candidate_job_description`; the name and exact schema are not
implemented contracts. Preserve source attribution, optimistic concurrency,
idempotency and candidate/application-state isolation. After saving, reread
candidate context for the actual jdHash, current versions and fresh inputManifest.
Then verify explicit 10+ commercial SWE → FILTER → human KEEP → list visibility,
holding independent candidate-decision filters constant. KEEP must not imply an
application, saved interest or reversal of DISMISSED.

Validation for this update is Level 0: documentation diff, whitespace and local
references. No runtime input changed, so the existing 496-test release evidence is
retained without rerunning tests, type checks or build. This update records reported
acceptance; it does not claim a new live probe, JD ingestion fix or production release.
