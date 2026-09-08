# Workspace Skills Platform Acceptance Results — ChatGPT Work Smoke

**Status:** INCONCLUSIVE — BINDING/TRACE SMOKE ONLY, NO PLATFORM ACCEPTANCE CLAIM

This record captures only evidence observable in one existing ChatGPT Work context.
It deliberately does not promote a successful read-only smoke into fresh-context,
state, mutation, Codex, web, or iPhone acceptance. Returned Workspace content was
sanitized before being committed; no company, role, Project, Task, Resource,
transition, email, or Workspace identifiers are retained here.

## 1. Campaign identity

| Field | Recorded value |
|---|---|
| Campaign ID | `PAW-SKILLS-CHATGPT-WORK-2026-09-08-01` |
| Evaluator | ChatGPT Work automated evaluator |
| Started/completed at | 2026-09-08 UTC; smoke completed at 2026-09-08T05:43:15Z |
| Git commit | `efa3261e896c26d5402811cfddfff04609431d3a` |
| PAW release/image | `NOT EXPOSED` by the connected runtime |
| S1 Skill SHA-256 | `ed7063d81d51f5042660be6e501ad99f7921f7b65df6a521bfa7db134150ba53` |
| S2 entrypoint SHA-256 | `bf21daa95cccb913aae666f5f3f848e1e92b85e2f2ee55e6112937532906c881` |
| S2 mutation reference SHA-256 | `cb0203459484afa7c426648cda17925a0fbf6c18cf43581dde908130f376caae` |
| Tool-declaration artifact/hash | [`evidence/chatgpt-work-2026-09-08-paw-tool-schemas.json`](evidence/chatgpt-work-2026-09-08-paw-tool-schemas.json); normalized from runtime TypeScript declarations, not a byte-for-byte provider schema export; `sha256:6f51e8773ce0aface5f9d6df05c67b0c039e5bd3e3514537a88beafe5c13ec15` |
| Runtime and version | ChatGPT Work; exact host version `NOT EXPOSED` |
| Model identifier | `NOT EXPOSED` |
| Skill discovery/package version | Both Skills were discoverable through the ChatGPT Work Skill registry; installed package version/source-commit binding was `NOT EXPOSED` |
| PAW MCP binding identifier | Personal AI Workspace connector; deployment identifier `NOT EXPOSED`; no credentials captured |
| Synthetic fixture/Workspace ID | `NOT AVAILABLE`; only read-only smoke was performed against the connected Workspace and all returned identity/content was discarded |
| Timezone/fixed clock | Runtime returned a valid Workspace timezone/date; clock was not operator-fixed |

## 2. Repository CI and release gate

| Field | Result |
|---|---|
| Workflow run URL | <https://github.com/Andy-JunXiong/Personal-AI-Workspace/actions/runs/34191196261> |
| Commit tested | `efa3261e896c26d5402811cfddfff04609431d3a` |
| Conclusion | `success` |
| Test files/tests passed | 39 files / 309 tests |
| TypeScript typecheck | pass |
| Production build | pass |
| Release artifact | `workspace-skills-efa3261e896c26d5402811cfddfff04609431d3a`; artifact id `10042265187`; 15,199 bytes; expires 2026-10-08T05:35:52Z |
| Release artifact digest | `sha256:bfe1b9f50f461e743394d3f62d0b2e464787e310429b0b2218c8a7434900bef3` |
| Deviations | CI and artifact metadata were verified; the connector did not expose an authenticated artifact-download operation, so the uploaded outer archive was not opened in this campaign |

CI conclusion: `PASS` for repository verification only.

Local pinned packaging reproduced the manifest source hashes and generated:

- `job-search-today-review-0.1.0.zip` —
  `sha256:d2e8a43589a9efd15afeb0587d47bd18b02181aacfdd47a40bfc71354f91399e`
- `application-lifecycle-review-0.1.0.zip` —
  `sha256:f953a328adfde87be948c15ddcdfb95e5ae259906da67b6735aeae906fd961cc`

## 3. S1 routing results

| Case | Expected | Observed | Result |
|---|---|---|---|
| P1–P5 | route | Not executed in separate fresh contexts | `INCONCLUSIVE` |
| N1–N6 | do not route | Not executed in separate fresh contexts | `INCONCLUSIVE` |
| A1–A3 | clarify/no assumption | Not executed in separate fresh contexts | `INCONCLUSIVE` |

False positives and false negatives cannot be measured from this smoke. Registry
discoverability and explicit Skill loading were observed, but neither proves
implicit routing.

## 4. S1 trace and state

| Case | Ordered tools | Workspace reads | Unnecessary reads | Mutation calls | State evidence | Result |
|---|---|---:|---:|---:|---|---|
| Normal Today smoke | `workspace_get_today` | 1 | 0 observed | 0 observed | No external before/after fingerprint | `TRACE PASS`; state `INCONCLUSIVE` |
| Justified detail | Not run | 0 | 0 | 0 | Not captured | `INCONCLUSIVE` |
| Today tool failure | Not run | 0 | 0 | 0 | Not captured | `INCONCLUSIVE` |

The returned Today object contained every required top-level contract field. The
response preserved the server-provided date/timezone, section order, reasons, and
item order. Sanitized cardinalities were: one attention item, zero upcoming items,
11 applications without an open Task, and five recent lifecycle changes. No
additional object, inventory, Gmail, mail, browser, database, or mutation tool was
called on the normal path.

Zero mutation is supported by the visible tool trace only and is **not independently
verified** without the required operator-side durable-state fingerprints.

## 5. S2 routing results

| Case | Expected mode | Observed | Result |
|---|---|---|---|
| P1–P6 | read-only or guarded mutation | Not executed in separate fresh contexts | `INCONCLUSIVE` |
| N1–N6 | do not route | Not executed in separate fresh contexts | `INCONCLUSIVE` |
| A1–A3 | clarify/read-only | Not executed in separate fresh contexts | `INCONCLUSIVE` |

## 6. S2 trace and state

| Case | Authority evidence | Ordered tools | Expected delta | State evidence | Result |
|---|---|---|---|---|---|
| T1 active read-only smoke | N/A | `workspace_find_job_application` → `workspace_get_project` | none | No external before/after fingerprint | `TRACE PASS`; state `INCONCLUSIVE` |
| T2–T4 | N/A | Not run | none | Not captured | `INCONCLUSIVE` |
| T5–T9 | No production write authority requested or supplied | Not run | case-specific | No isolated synthetic fixture available | `BLOCKED` |

The exact lookup returned `EXACT`; the subsequent call used only the returned
Project identity. The exact read returned the required Project status,
lifecycle/version, Resources, transitions, open Tasks, and totals. All production
identity and content was removed from this record. No Today, inventory, Gmail,
mail-scan, browser, direct-database, proposal, admission, observation, or other write
tool was called.

Read-before-write, exact write readback, three-gate authority separation, bounded
durable deltas, stale-version behavior, and fail-closed write failures remain
`INCONCLUSIVE` because no synthetic mutation campaign was authorized or run.

## 7. Baseline comparison

No same-runtime, same-model, same-fixture fresh-context baseline arm was available.
Instruction size, routing rates, call-count deltas, tool-order consistency, readback
rates, and state correctness deltas are therefore all `INCONCLUSIVE`.

## 8. Platform acceptance

| Platform | Discovery | PAW MCP binding | Permissions | S1 | S2 | Overall | Evidence |
|---|---|---|---|---|---|---|---|
| Codex fresh context | Not run | Not run | Not run | Not run | Not run | `INCONCLUSIVE` | Requires a new pinned Codex context with PAW binding and synthetic fixture |
| ChatGPT web fresh conversation | Registry discovery observed only in an existing Work context | Required read tools callable | Read-only calls allowed; write gates not tested | Normal trace smoke only | T1 trace smoke only | `INCONCLUSIVE` | This file and sanitized live trace summary |
| ChatGPT iPhone fresh conversation | Not run | Not run | Not run | Not run | Not run | `INCONCLUSIVE` | Must be executed independently on mobile |

## 9. Deviations and failures

| ID | Case/platform | Expected | Observed | Safe stop occurred | Follow-up |
|---|---|---|---|---|---|
| D1 | State verification | Isolated fixture and external fingerprints | Connected Workspace; no fingerprint access | Yes; read-only only | Provision synthetic fixture and operator verifier |
| D2 | Routing | Fresh context per case | One existing context with explicit loading | Yes; no routing claim | Execute P/N/A matrices in fresh contexts |
| D3 | S2 write/adversarial | Fresh synthetic fixture per case | Not executed | Yes; no write attempted | Run only after fixture and narrow authority exist |
| D4 | Artifact binding | Download and inspect exact CI artifact | Metadata/digest verified; download not exposed | Yes; no substitute artifact claimed | Download through an authenticated supported surface |
| D5 | Installed Skill provenance | Installed snapshot tied to package hash | Registry contents observable; installed version/source commit not exposed | Yes; provenance claim withheld | Record platform installation/version lifecycle |

Unexpected retries: none observed.

Unredacted or production data exposure in committed evidence: none. Live read results
were used transiently and sanitized before this record was created.

## 10. Stop-condition answers

| Question | Answer | Evidence reference |
|---|---|---|
| Did Skills materially reduce repeated prompt instructions? | `INCONCLUSIVE`; no controlled baseline arm | Section 7 |
| Did explicit and implicit routing work reliably? | `INCONCLUSIVE`; discoverability is not routing | Sections 3 and 5 |
| Did tool traces become more consistent? | The two observed traces matched the procedures; campaign-level conclusion is `INCONCLUSIVE` | Sections 4 and 6 |
| Did unnecessary Workspace reads decrease? | Zero unnecessary reads were observed in the two smokes; no baseline comparison exists | Sections 4, 6, and 7 |
| Were zero-mutation claims independently verified? | No | Sections 4 and 9, D1 |
| Did lifecycle mutation preserve all authority gates and exact readback? | Not tested | Section 6 |
| Which Codex/ChatGPT distribution differences remain? | Codex repository discovery and ChatGPT registry/package installation must still be accepted independently; ChatGPT did expose both Skills and the PAW connector in this runtime | Section 8 |
| What policy/snapshot/capability drift risks remain? | Installed Skill source/version is not exposed, PAW release is not exposed, and artifact/tool-schema compatibility is not runtime-enforced | Sections 1 and 9 |
| Is `job-mail-scan` justified and platform-testable? | No; S1/S2 release gates remain incomplete and mail-scan blockers were not retested | Sections 8 and 11 |

## 11. Final decision

Campaign result: `INCONCLUSIVE`.

S3 recommendation: `HOLD`.

The smoke establishes three useful facts: both Skills are discoverable in ChatGPT
Work, the required PAW read tools are bound and callable, and the observed S1/S2
read-only traces match their procedures without fallback or write calls. It does not
establish fresh-context routing, independently verified zero mutation, controlled
baseline improvement, installed-package provenance, or any lifecycle write safety.

Human decision and reference: continue S0–S2 acceptance only; no authorization to
start S3 was supplied in this campaign.
