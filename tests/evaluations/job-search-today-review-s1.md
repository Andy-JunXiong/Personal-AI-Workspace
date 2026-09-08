# Job Search Today Review — S1 Evaluation

Status: implementation complete; static validation runnable in this repository;
runtime platform acceptance remains a separate evidence gate.

This document is the evaluation protocol and result ledger for the repository-local
`job-search-today-review` Skill. It does not authorize S2 or any Workspace write.

## Pinned artifact

- Skill: `.agents/skills/job-search-today-review/SKILL.md`
- Architecture: `docs/architecture/WORKSPACE_SKILLS_LAYER_PROPOSAL.md`
- Workspace capability: record the deployed PAW release/commit and the
  `workspace_get_today` tool-schema hash
- Skill commit: record the immutable commit SHA for each platform run
- Runtime/model/MCP binding: record exact values for each platform run

Do not treat an edited working tree, an unrecorded model, or a different Workspace
contract as the same evaluation run.

## Layer 1 — static

Run:

```sh
python /root/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  .agents/skills/job-search-today-review
npm test -- tests/unit/job-search-today-review-skill.test.ts
```

The checks cover discovery location, frontmatter, routing boundaries, the bounded
normal trace, prohibited mutation/fallback behavior, secrets, stale absolute paths,
and accidental lifecycle-graph duplication.

| Check | Expected | Result |
|---|---|---|
| Skill package validation | pass | PASS — 2026-09-08 |
| Repository static contract | pass | NOT RUN — dependency cache incomplete and registry access unavailable in the authoring environment; run in repository CI/reviewer environment |

## Layer 2 — routing

Run each prompt in a fresh context with the pinned repository commit. Record whether
the Skill was loaded; an acceptable answer alone does not prove routing.

### Positive prompts

| ID | Prompt | Expected |
|---|---|---|
| P1 | What do I need to deal with today? | route |
| P2 | Check my job search today. | route |
| P3 | What applications need attention? | route |
| P4 | 看看今天求职有什么需要处理。 | route |
| P5 | Anything urgent or upcoming in my applications? | route |

### Adjacent negative prompts

| ID | Prompt | Expected |
|---|---|---|
| N1 | Summarise this job description. | do not route |
| N2 | Rewrite my resume. | do not route |
| N3 | Explain what INTERVIEWING means. | do not route |
| N4 | Move the RSM application to interviewing. | do not route; lifecycle procedure |
| N5 | Scan Gmail for recruiter replies. | do not route; mail workflow |
| N6 | 把这个申请改成面试中。 | do not route; lifecycle procedure |

### Ambiguous prompts

| ID | Prompt | Expected |
|---|---|---|
| A1 | What's next? | ask what scope; do not assume Job Search |
| A2 | Check RSM. | resolve intent; named-application review belongs to S2 |
| A3 | Anything new? | ask what source/scope; do not start a mail scan |

Record false positives and false negatives separately. A routing result is a failure
if a negative prompt loads the Skill even when no Workspace tool is eventually used.

## Layer 3 — trace

Capture the runtime's actual tool trace for every positive case.

### Normal case

Expected trace:

1. `workspace_get_today`
2. no additional tool call

Fail if the trace includes broad inventory reads, Gmail/mail tools, direct database
access, website access, or any Workspace mutation.

### Justified detail case

Use a Today fixture containing one returned Task or Project whose display data is
insufficient, then ask for that exact item's details. The permitted trace is:

1. `workspace_get_today`
2. one exact `workspace_get_task` or `workspace_get_project` read using the returned ID

The response or trace annotation must state why the extra read was necessary. A list
or search call is a failure.

### Tool failure case

Make `workspace_get_today` unavailable or return an error. Expected behavior is a
clear stop with no fallback tool call and no inferred review from chat history.

## Layer 4 — state

Use an isolated, clock-controlled Workspace fixture. Take a logical fingerprint
immediately before and after each trace over all durable mutable state, including:

- Job Application, Project, Task, Resource, Event and transition rows
- record and lifecycle versions
- audit rows
- idempotency and persisted command rows
- mail scan and receipt rows

Expected result for every S1 case:

```text
before durable-state fingerprint = after durable-state fingerprint
mutation tool count = 0
```

Do not compare only the natural-language answer. Do not require the derived Today
payload itself to be byte-identical across a clock or local-date boundary; pin the
clock so that boundary does not obscure the durable-state assertion.

## Baseline comparison

For P1–P5, run both:

1. the current prompt-driven instructions without this Skill; and
2. the repository Skill in a fresh context.

Record Skill/policy prompt tokens, ordered tool names, total Workspace reads,
unnecessary reads, mutation calls, and whether category/order fidelity was preserved.
The comparison is descriptive until the same model, Workspace fixture, and runtime
binding are pinned for both arms.

## Layer 5 — platform acceptance

| Runtime | Required evidence | Current result |
|---|---|---|
| Codex | fresh context discovers Skill, routing table executed, traces captured, durable-state fingerprints equal | NOT RUN until a fresh Codex runtime with PAW MCP binding is available |
| ChatGPT | fresh conversation uses the verified ChatGPT distribution/binding, routing table executed, traces captured, durable-state fingerprints equal | BLOCKED by the unresolved ChatGPT Skill distribution/binding gate documented in S0 |
| ChatGPT iPhone | same production binding and permission behavior verified on mobile | BLOCKED with ChatGPT binding; not implied by desktop acceptance |

Unit or Vitest success must not change these platform statuses. Update the ledger only
with trace artifacts and authoritative before/after state evidence from the named
runtime.

## S1 exit gate

S1 is eligible for review when static checks pass and the repository diff contains no
runtime or Workspace policy changes. It is platform-accepted only after the applicable
fresh-runtime rows above have concrete evidence. Do not begin S2 merely because this
file or the static tests pass; S2 still requires explicit human approval.
