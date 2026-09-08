# Workspace Skills Platform Acceptance Results

**Status:** DRAFT — NO ACCEPTANCE CLAIM

Copy this file for one pinned acceptance campaign. Do not overwrite the template.
Replace every `TBD`; an incomplete row is `INCONCLUSIVE`, not a pass.

## 1. Campaign identity

| Field | Recorded value |
|---|---|
| Campaign ID | TBD |
| Evaluator | TBD |
| Started/completed at | TBD |
| Git commit | TBD |
| PAW release/image | TBD |
| S1 Skill SHA-256 | TBD |
| S2 entrypoint SHA-256 | TBD |
| S2 mutation reference SHA-256 | TBD |
| Tool-schema artifact/hash | TBD |
| Runtime and version | TBD |
| Model identifier or `NOT EXPOSED` | TBD |
| Skill discovery/package version | TBD |
| PAW MCP binding identifier | TBD — no credentials |
| Synthetic fixture/Workspace ID | TBD — synthetic only |
| Timezone/fixed clock | TBD |

## 2. Repository CI gate

| Field | Result |
|---|---|
| Workflow run URL | TBD |
| Commit tested | TBD |
| Conclusion | TBD |
| Test files/tests passed | TBD |
| TypeScript typecheck | TBD |
| Production build | TBD |
| Deviations | TBD |

CI conclusion: `TBD`

## 3. S1 routing results

Use the prompt IDs from `job-search-today-review-s1.md`.

| Case | Expected | Skill loaded | False positive/negative | Trace artifact | Result |
|---|---|---|---|---|---|
| P1–P5 | route | TBD | TBD | TBD | TBD |
| N1–N6 | do not route | TBD | TBD | TBD | TBD |
| A1–A3 | clarify/no assumption | TBD | TBD | TBD | TBD |

False positives: `TBD`

False negatives: `TBD`

## 4. S1 trace and state

| Case | Ordered tools | Workspace reads | Unnecessary reads | Mutation calls | Before fingerprint | After fingerprint | Result |
|---|---|---:|---:|---:|---|---|---|
| Normal Today | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Justified detail | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Today tool failure | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

Direct Today/output agreement: `TBD`

Zero-mutation conclusion and evidence: `TBD`

## 5. S2 routing results

Use the prompt IDs from `application-lifecycle-review-s2.md`.

| Case | Expected mode | Skill loaded | False positive/negative | Trace artifact | Result |
|---|---|---|---|---|---|
| P1–P6 | read-only or guarded mutation | TBD | TBD | TBD | TBD |
| N1–N6 | do not route | TBD | TBD | TBD | TBD |
| A1–A3 | clarify/read-only | TBD | TBD | TBD | TBD |

False positives: `TBD`

False negatives: `TBD`

## 6. S2 trace and state

| Case | Authority evidence | Ordered tools | Before/after evidence | Expected bounded delta | Actual durable delta | Result |
|---|---|---|---|---|---|---|
| T1 active read-only | N/A | TBD | TBD | none | TBD | TBD |
| T2 ambiguous/missing identity | N/A | TBD | TBD | none | TBD | TBD |
| T3 closed application read | N/A | TBD | TBD | none | TBD | TBD |
| T4 advice read-only | N/A | TBD | TBD | none | TBD | TBD |
| T5 authorized lifecycle change | TBD | TBD | TBD | Workspace-owned admitted delta | TBD | TBD |
| T6 proposal-only authority | TBD | TBD | TBD | proposal only; no lifecycle delta | TBD | TBD |
| T7 existing-proposal admission | TBD | TBD | TBD | Workspace-owned admitted delta; no duplicate proposal | TBD | TBD |
| T8 authorized observation | TBD | TBD | TBD | one observation; no lifecycle delta | TBD | TBD |
| T9 adversarial failures | TBD | TBD | TBD | case-specific fail-closed delta | TBD | TBD |

Read-before-write preserved: `TBD`

Exact readback after every attempted write: `TBD`

Platform permission / Workspace authority / domain admission kept distinct: `TBD`

Fallback attempts: `TBD`

## 7. Baseline comparison

| Metric | Prompt-driven baseline | Skill | Delta | Interpretation |
|---|---:|---:|---:|---|
| Instruction words | TBD | TBD | TBD | TBD |
| Instruction UTF-8 bytes | TBD | TBD | TBD | TBD |
| Instruction tokens, if exposed | TBD | TBD | TBD | TBD |
| Routing successes / total | TBD | TBD | TBD | TBD |
| Workspace reads | TBD | TBD | TBD | TBD |
| Unnecessary Workspace reads | TBD | TBD | TBD | TBD |
| Incorrect tool-order cases | TBD | TBD | TBD | TBD |
| Missing pre-write reads | TBD | TBD | TBD | TBD |
| Missing exact readbacks | TBD | TBD | TBD | TBD |
| Unauthorized mutation attempts | TBD | TBD | TBD | TBD |
| Fallback attempts | TBD | TBD | TBD | TBD |
| Final-state mismatches | TBD | TBD | TBD | TBD |

Baseline prompt artifact: `TBD`

Skill prompt artifact: `TBD`

## 8. Platform acceptance

| Platform | Discovery | PAW MCP binding | Permissions | S1 | S2 | Overall | Evidence |
|---|---|---|---|---|---|---|---|
| Codex fresh context | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| ChatGPT web fresh conversation | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| ChatGPT iPhone fresh conversation | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

Use only `SUPPORTED`, `NOT_SUPPORTED`, `INCONCLUSIVE`, or `BLOCKED` for the
overall platform result.

## 9. Deviations and failures

| ID | Case/platform | Expected | Observed | Safe stop occurred | Follow-up |
|---|---|---|---|---|---|
| D1 | TBD | TBD | TBD | TBD | TBD |

Unexpected retries: `TBD`

Unredacted or production data exposure: `TBD`

## 10. Stop-condition answers

| Question | Answer | Evidence reference |
|---|---|---|
| Did Skills materially reduce repeated prompt instructions? | TBD | TBD |
| Did explicit and implicit routing work reliably? | TBD | TBD |
| Did tool traces become more consistent? | TBD | TBD |
| Did unnecessary Workspace reads decrease? | TBD | TBD |
| Were zero-mutation claims independently verified? | TBD | TBD |
| Did lifecycle mutation preserve all authority gates and exact readback? | TBD | TBD |
| Which Codex/ChatGPT distribution differences remain? | TBD | TBD |
| What policy/Snapshot/capability drift risks remain? | TBD | TBD |
| Is `job-mail-scan` justified and platform-testable? | TBD | TBD |

## 11. Final decision

Campaign result: `TBD`

S3 recommendation: `HOLD / CONSIDER FOR EXPLICIT APPROVAL`

Decision rationale: `TBD`

Human decision and reference: `TBD`
