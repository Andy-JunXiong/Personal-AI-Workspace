# Workspace Skills S0–S2 Assessment

**Status:** IMPLEMENTATION + LOCAL CONTRACT ACCEPTANCE COMPLETE — PLATFORM ACCEPTANCE INCOMPLETE

**Repository baseline:** `main` at `495a12955f75df486418f0e99a6c61258ac2fb2d`

**Prepared:** 2026-09-08

**Decision:** HOLD S3 `job-mail-scan`

## Executive conclusion

S0 established a sound procedure/capability/state/authority boundary. S1 and S2
then implemented the two approved repository-local Codex Skills without changing
PAW runtime, MCP contracts, lifecycle rules, authorization policy, deployment,
schedules, or production Workspace state.

The implementation proves that the intended procedures can be represented as
small, progressively disclosed repository Skills. Deterministic packaging,
repository verification, two positive read-only ChatGPT Work smokes, and an 8/8
isolated Workspace/MCP contract campaign now provide evidence beyond static prose.
The local campaign independently verifies the S1 zero-mutation fingerprint and
representative S2 read/write ordering, bounded durable deltas and exact readback.

The product hypothesis remains incomplete. Full fresh-runtime routing matrices,
hosted-model authority behavior, same-model baseline comparison, platform-exported
traces/provenance, fresh Codex acceptance and iPhone acceptance have not been
established.

Do not implement `job-mail-scan` yet. The next work should be acceptance evidence
for S1/S2 and verification of the ChatGPT production binding, not another Skill.

## Evidence reviewed

| Evidence | Result |
|---|---|
| S0 architecture proposal | [PR #8](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/8) merged as `e37f06a`; defines runtime-neutral boundary, distribution matrix, version model, security model, and stop condition |
| S1 `job-search-today-review` | [PR #9](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/9) merged as `645233d`; 46 lines / 404 words; normal path specifies one `workspace_get_today` read and no mutation branch |
| S2 `application-lifecycle-review` | [PR #10](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/10) merged as `8754393`; 62-line entrypoint plus 110-line / 831-word mutation reference using progressive disclosure |
| Deterministic packaging and provenance | [PR #16](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/16) merged as `efa3261`; one canonical source packages versioned S1/S2 artifacts with source hashes and CI artifact metadata |
| ChatGPT Work read-only evidence | [PR #17](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/17) merged as `6a934a8`; installed discovery and PAW binding observed, with S1 and S2 positive read-only behavior matching independent Workspace reads |
| Isolated synthetic contract evidence | [PR #18](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/18) merged as `495a129`; 8/8 S1/S2 cases passed with ordered real-MCP traces, logical fingerprints and bounded row deltas |
| Skill package validation | Passed for S1 and S2 on 2026-09-08 |
| Repository Vitest/full verification | Main Verify run [34195197793](https://github.com/Andy-JunXiong/Personal-AI-Workspace/actions/runs/34195197793) succeeded: 40 test files / 310 tests, typecheck and production build |
| Fresh Codex acceptance | Not run; PAW MCP binding was unavailable in a fresh test runtime |
| Fresh ChatGPT acceptance | Installed Skill discovery and PAW binding observed; two positive read-only smokes passed behavior checks, but the full routing/mutation matrix and platform-exported evidence remain incomplete |
| ChatGPT iPhone acceptance | Not run |
| Prompt-driven baseline comparison | Not run |

Canonical artifacts:

- [S0 proposal](WORKSPACE_SKILLS_LAYER_PROPOSAL.md)
- [S1 Skill](../../.agents/skills/job-search-today-review/SKILL.md) and
  [evaluation protocol](../../tests/evaluations/job-search-today-review-s1.md)
- [S2 Skill](../../.agents/skills/application-lifecycle-review/SKILL.md),
  [mutation procedure](../../.agents/skills/application-lifecycle-review/references/mutation-procedure.md),
  and [evaluation protocol](../../tests/evaluations/application-lifecycle-review-s2.md)
- [Synthetic acceptance result](../../tests/evaluations/workspace-skills-synthetic-acceptance-2026-09-08.md)

## Stop-condition assessment

### 1. Did Skills materially reduce repeated prompt instructions?

**Result: INCONCLUSIVE.**

The procedures are now centralized in 1,706 words across three progressively
loaded Skill files, so future prompts should no longer need to restate the full
Today or lifecycle operating procedure. That is structural evidence of reuse,
not evidence of a material runtime reduction. No same-model prompt-driven versus
Skill-based token comparison has been executed.

### 2. Did explicit and implicit routing work reliably?

**Result: PARTIALLY VERIFIED.**

Both Skills have discriminating descriptions and English/Chinese positive,
negative, and ambiguous routing suites. Two separate fresh ChatGPT Work positive
read-only prompts behaved as the intended Skills, but the complete positive,
negative, ambiguous and multilingual matrices have not been executed with
platform-visible Skill-load evidence. False-positive and false-negative rates
therefore remain unknown.

### 3. Did tool traces become more consistent?

**Result: LOCAL CONTRACT VERIFIED; MODEL CONSISTENCY INCONCLUSIVE.**

S1 specifies one normal `workspace_get_today` call. S2 specifies exact resolution,
pre-write reads, proposal verification, admission, and final exact readback. These
orders passed the isolated real-MCP harness, and the two ChatGPT read-only smokes
matched the intended minimal behavior. Repeated hosted-model traces and a paired
prompt-driven baseline were not captured, so consistency improvement cannot yet
be measured.

### 4. Did unnecessary Workspace calls decrease?

**Result: NOT VERIFIED.**

S1 prohibits default inventory enumeration, while S2 limits closed-inclusive
listing to a specific `NOT_FOUND` terminal/closed path. No prompt-driven baseline
or Skill trace counts exist, so a decrease cannot be claimed.

### 5. Were zero-mutation claims independently verified?

**Result: VERIFIED FOR THE LOCAL S1 MCP CONTRACT; PLATFORM INVOCATION INCONCLUSIVE.**

The isolated S1 campaign captured exactly one `workspace_get_today` call, zero
mutation calls, and equal complete logical durable-state fingerprints before and
after. This independently verifies the procedure's local Workspace/MCP contract.
The live ChatGPT smoke did not expose an external before/after fingerprint, so the
same claim is not independently verified for that hosted invocation.

### 6. Did lifecycle mutation preserve all authority gates and exact readback?

**Result: LOCAL WORKSPACE/MCP SEQUENCE VERIFIED; MODEL AUTHORITY BEHAVIOR INCONCLUSIVE.**

The S2 procedure explicitly separates platform permission, Workspace authority,
and domain admission; requires current lifecycle version; treats proposal as a
write; retains idempotency identity; and requires exact Project readback after
proposal and admission. The underlying PAW lifecycle contracts already enforce
proposal/admission separation and optimistic concurrency. The isolated harness
passed an authorized propose/read/admit/read case, proposal-only and
observation-only cases, invalid
transition behavior, and a stale-version concurrency conflict with exact readback
and bounded durable deltas. Because a deterministic operator harness supplied the
approved inputs, it does not prove that a hosted model will apply all authority
gates correctly.

### 7. Which distribution/binding differences remain between Codex and ChatGPT?

**Result: DIFFERENT MECHANISMS CONFIRMED; COMPLETE ACCEPTANCE UNRESOLVED.**

Codex repository discovery uses `.agents/skills` and pins the prototype to a Git
commit. ChatGPT's documented production route uses an installed Skill/Plugin
snapshot with a separately declared or mapped MCP dependency. GitHub publication
does not install the Skills in ChatGPT. Installed ChatGPT Skill discovery and PAW
read-tool binding were observed in Work mode. Per-invocation package provenance,
write permissions, update behavior, fresh Codex binding and iPhone operation
remain unverified.

### 8. What policy, Skill snapshot, or capability-version risks remain?

**Result: OPEN RISKS.**

- Deterministic packaging, release manifests and CI artifacts now prevent manual
  source flattening from being the release path, but installed runtimes do not
  expose the active package hash per invocation.
- Eval protocols record tool-schema hashes, but runtime capability compatibility
  and drift rejection are not enforced automatically.
- An installed ChatGPT Plugin would be a static snapshot and would not inherit a
  later GitHub Skill or Workspace policy update automatically.
- Manual installation can still select the wrong artifact even though packaging
  now derives both runtime artifacts from one canonical source.
- S1 is not mail-policy-dependent. A future mail Skill would add a separate
  canonical policy version/hash and explicit authority-lifecycle problem.
- Policy version, Skill snapshot and deployed Workspace capability version still
  need a runtime-visible compatibility decision rather than documentation alone.

### 9. Is `job-mail-scan` now justified and platform-testable?

**Result: NO — HOLD.**

The lower-risk Skills now demonstrate useful local trace/state behavior and two
positive ChatGPT read-only smokes, but not reliable routing, hosted-model mutation
authority or measured prompt/baseline benefits. Mail scan also retains the
documented platform block around scan creation and adds untrusted email content,
bounded/resumable
coverage, partial/complete semantics, deduplication, receipts, and optional writes.
Implementing it now would increase procedural surface before the abstraction's
measurable value or production distribution path is established.

## Required evidence before reconsidering S3

1. Run S1 and S2 in a fresh Codex context with the real PAW MCP binding; execute
   the routing suites and capture actual tool traces.
2. Execute the complete positive, negative, ambiguous and multilingual routing
   matrices in fresh ChatGPT conversations with platform-visible evidence where
   available.
3. Exercise hosted-model authority pauses and the remaining T3, T4, T7 and T9
   failure cases; do not infer these from the deterministic harness.
4. Execute a same-model prompt-driven baseline for S1/S2 and compare repeated
   instruction tokens, tool-order variance, unnecessary reads, missing readbacks,
   and durable deltas.
5. Record installed ChatGPT package/version provenance and permission behavior,
   then execute acceptance separately on iPhone.
6. Resolve and retest the `workspace_start_mail_scan` platform block without an
   alternate-source or retry workaround.
7. Add enforceable policy/capability compatibility checks to the deterministic
   ChatGPT artifact lifecycle.

## Recommendation

Keep the merged S1/S2 Skills as a bounded prototype. The architecture is promising
and the authority boundary remains intact, but the success criteria are behavioral,
not documentary. Pause feature expansion and collect the missing runtime evidence.

Proceed to `job-mail-scan` only after those results show a measurable improvement
and a human explicitly approves S3.
