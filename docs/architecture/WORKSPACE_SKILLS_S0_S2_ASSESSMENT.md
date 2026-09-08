# Workspace Skills S0–S2 Assessment

**Status:** IMPLEMENTATION COMPLETE — PLATFORM ACCEPTANCE INCOMPLETE

**Repository baseline:** `main` at `8754393b2bc04168cf284dbe3e0b45656fb38a03`

**Prepared:** 2026-09-08

**Decision:** HOLD S3 `job-mail-scan`

## Executive conclusion

S0 established a sound procedure/capability/state/authority boundary. S1 and S2
then implemented the two approved repository-local Codex Skills without changing
PAW runtime, MCP contracts, lifecycle rules, authorization policy, deployment,
schedules, or production Workspace state.

The implementation proves that the intended procedures can be represented as
small, progressively disclosed repository Skills. It does **not** yet prove the
product hypothesis that Skills materially improve routing, tool traces, prompt
size, or durable-state outcomes in Codex or ChatGPT. The required fresh-runtime,
baseline-comparison, trace, and state evidence has not been collected.

Do not implement `job-mail-scan` yet. The next work should be acceptance evidence
for S1/S2 and verification of the ChatGPT production binding, not another Skill.

## Evidence reviewed

| Evidence | Result |
|---|---|
| S0 architecture proposal | [PR #8](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/8) merged as `e37f06a`; defines runtime-neutral boundary, distribution matrix, version model, security model, and stop condition |
| S1 `job-search-today-review` | [PR #9](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/9) merged as `645233d`; 46 lines / 404 words; normal path specifies one `workspace_get_today` read and no mutation branch |
| S2 `application-lifecycle-review` | [PR #10](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/10) merged as `8754393`; 62-line entrypoint plus 110-line / 831-word mutation reference using progressive disclosure |
| Repository change scope since S0 | Seven files, limited to `.agents/skills` and `tests`; no `src`, schema, deployment, schedule, or policy file changed |
| Skill package validation | Passed for S1 and S2 on 2026-09-08 |
| Repository Vitest/full verification | Not run in the authoring environment because dependencies were absent and registry access was unavailable |
| Fresh Codex acceptance | Not run; PAW MCP binding was unavailable in a fresh test runtime |
| Fresh ChatGPT/iPhone acceptance | Blocked by the unresolved PAW-specific Skill distribution/MCP binding gate |
| Prompt-driven baseline comparison | Not run |

Canonical artifacts:

- [S0 proposal](WORKSPACE_SKILLS_LAYER_PROPOSAL.md)
- [S1 Skill](../../.agents/skills/job-search-today-review/SKILL.md) and
  [evaluation protocol](../../tests/evaluations/job-search-today-review-s1.md)
- [S2 Skill](../../.agents/skills/application-lifecycle-review/SKILL.md),
  [mutation procedure](../../.agents/skills/application-lifecycle-review/references/mutation-procedure.md),
  and [evaluation protocol](../../tests/evaluations/application-lifecycle-review-s2.md)

## Stop-condition assessment

### 1. Did Skills materially reduce repeated prompt instructions?

**Result: INCONCLUSIVE.**

The procedures are now centralized in 1,706 words across three progressively
loaded Skill files, so future prompts should no longer need to restate the full
Today or lifecycle operating procedure. That is structural evidence of reuse,
not evidence of a material runtime reduction. No same-model prompt-driven versus
Skill-based token comparison has been executed.

### 2. Did explicit and implicit routing work reliably?

**Result: NOT VERIFIED.**

Both Skills have discriminating descriptions and English/Chinese positive,
negative, and ambiguous routing suites. No fresh Codex or ChatGPT run captured
actual Skill loading, false positives, or false negatives. Static frontmatter
validation cannot establish routing reliability.

### 3. Did tool traces become more consistent?

**Result: NOT VERIFIED.**

S1 specifies one normal `workspace_get_today` call. S2 specifies exact resolution,
pre-write reads, proposal verification, admission, and final exact readback. These
are reviewable trace contracts, but no paired runtime traces were captured. The
implementation therefore proves intended ordering, not observed consistency.

### 4. Did unnecessary Workspace calls decrease?

**Result: NOT VERIFIED.**

S1 prohibits default inventory enumeration, while S2 limits closed-inclusive
listing to a specific `NOT_FOUND` terminal/closed path. No prompt-driven baseline
or Skill trace counts exist, so a decrease cannot be claimed.

### 5. Were zero-mutation claims independently verified?

**Result: NOT VERIFIED FOR SKILL EXECUTION.**

The S1 contract has no mutation branch and the underlying Today tool is declared
read-only. However, no Skill run captured both a zero-mutation tool trace and
authoritative before/after durable-state fingerprints. Model text and static
instructions are insufficient evidence.

### 6. Did lifecycle mutation preserve all authority gates and exact readback?

**Result: STATICALLY PRESERVED; RUNTIME NOT VERIFIED.**

The S2 procedure explicitly separates platform permission, Workspace authority,
and domain admission; requires current lifecycle version; treats proposal as a
write; retains idempotency identity; and requires exact Project readback after
proposal and admission. The underlying PAW lifecycle contracts already enforce
proposal/admission separation and optimistic concurrency. No fresh Skill-driven
mutation trace and bounded durable-state delta has yet verified the combined
orchestration.

### 7. Which distribution/binding differences remain between Codex and ChatGPT?

**Result: DIFFERENT MECHANISMS CONFIRMED; PAW BINDING UNRESOLVED.**

Codex repository discovery uses `.agents/skills` and pins the prototype to a Git
commit. ChatGPT's documented production route uses an installed Skill/Plugin
snapshot with a separately declared or mapped MCP dependency. GitHub publication
does not install the Skills in ChatGPT. PAW-specific installation, MCP mapping,
permissions, update behavior, and iPhone operation remain unverified.

### 8. What policy, Skill snapshot, or capability-version risks remain?

**Result: OPEN RISKS.**

- Skill behavior is pinned by Git commit, but no release manifest packages a
  declared PAW capability compatibility set.
- Eval protocols call for tool-schema hashes, but no automated drift check exists.
- An installed ChatGPT Plugin would be a static snapshot and would not inherit a
  later GitHub Skill or Workspace policy update automatically.
- Multiple hand-maintained Codex/ChatGPT copies would drift; deterministic
  packaging from one canonical source is still required.
- S1 is not mail-policy-dependent. A future mail Skill would add a separate
  canonical policy version/hash and explicit authority-lifecycle problem.
- The new repository contract tests were not executed in a dependency-complete
  environment, and no repository CI status currently supplies that missing proof.

### 9. Is `job-mail-scan` now justified and platform-testable?

**Result: NO — HOLD.**

The lower-risk Skills have not yet demonstrated routing, trace, state, or prompt
benefits in their target runtimes. Mail scan also retains the documented platform
block around scan creation and adds untrusted email content, bounded/resumable
coverage, partial/complete semantics, deduplication, receipts, and optional writes.
Implementing it now would increase procedural surface before the abstraction's
measurable value or production distribution path is established.

## Required evidence before reconsidering S3

1. Run S1 in a fresh Codex context with the real PAW MCP binding; execute its full
   routing suite and capture actual tool traces.
2. Independently prove S1 zero mutation with durable before/after fingerprints.
3. Run S2 read-only, proposal-only, direct authorized admission, stale-version,
   ambiguity, rejection, and response/readback-mismatch cases against isolated
   synthetic Workspace state.
4. Execute a same-model prompt-driven baseline for S1/S2 and compare repeated
   instruction tokens, tool-order variance, unnecessary reads, missing readbacks,
   and durable deltas.
5. Verify the supported ChatGPT Skill/Plugin installation and PAW MCP dependency
   binding in a fresh web conversation, then separately on iPhone.
6. Resolve and retest the `workspace_start_mail_scan` platform block without an
   alternate-source or retry workaround.
7. Define deterministic packaging plus policy/capability hash checks for the
   ChatGPT artifact.

## Recommendation

Keep the merged S1/S2 Skills as a bounded prototype. The architecture is promising
and the authority boundary remains intact, but the success criteria are behavioral,
not documentary. Pause feature expansion and collect the missing runtime evidence.

Proceed to `job-mail-scan` only after those results show a measurable improvement
and a human explicitly approves S3.
