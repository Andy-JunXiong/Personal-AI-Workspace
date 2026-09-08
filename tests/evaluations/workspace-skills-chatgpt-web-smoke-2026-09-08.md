# Workspace Skills ChatGPT Web Smoke — 2026-09-08

**Status:** EXECUTED — INCONCLUSIVE FOR FULL PLATFORM ACCEPTANCE

This record captures a bounded, read-only ChatGPT Work smoke run performed after
the S0–S2 Skills were installed through the account-visible ChatGPT Skill editor.
It is not a substitute for the full
[platform acceptance runbook](workspace-skills-platform-acceptance-runbook.md).

No lifecycle, Task, observation, transition, mail-scan, deployment, schedule, or
authorization mutation was requested during this campaign. The live Workspace
was not an isolated synthetic fixture, so mutation cases were intentionally not
run and no production identifiers or application names are committed here.

## Campaign identity

| Field | Recorded value |
|---|---|
| Campaign ID | `chatgpt-web-readonly-smoke-2026-09-08` |
| Executed at | 2026-09-08T04:00Z |
| Repository commit | `75bd79f56ca192076e3b36f4850827c5cfa0a38f` |
| S1 repository SHA-256 | `ed7063d81d51f5042660be6e501ad99f7921f7b65df6a521bfa7db134150ba53` |
| S2 entrypoint repository SHA-256 | `bf21daa95cccb913aae666f5f3f848e1e92b85e2f2ee55e6112937532906c881` |
| S2 mutation reference repository SHA-256 | `cb0203459484afa7c426648cda17925a0fbf6c18cf43581dde908130f376caae` |
| Runtime | ChatGPT web, Work mode |
| Model shown by host | GPT-5.6 Sol Light |
| PAW binding | Existing installed `Personal AI Workspace` app; identifier omitted |
| Workspace | Existing live Workspace; identifiers omitted |
| Workspace date/time zone returned | 2026-09-08 / Australia/Sydney |

The pull-request-head GitHub Actions gate was already green before this smoke
run: [workflow run 34183924203](https://github.com/Andy-JunXiong/Personal-AI-Workspace/actions/runs/34183924203).
The run was triggered for PR #12 and passed 38 test files and 302 tests on Node
24, including typecheck and production build. It is repository verification for
the merged content, not an exact merge-commit platform-acceptance claim.

## Distribution and binding observed

The current ChatGPT account exposed **Skills > Create > Create with editor**.
Two personal Skills were created:

- `job-search-today-review`
- `application-lifecycle-review`

The editor stores the Skill name and routing description as separate fields and
generated `agents/openai.yaml`. The generated metadata file could not be loaded
through the editor after one retry, so its dependency declaration and installed
snapshot hash were not captured.

The S1 procedure body was copied from the repository Skill. For S2, the editor
could not reliably add the referenced Markdown file through the automated browser,
so the mutation reference was flattened into the installed `SKILL.md` snapshot.
All three authority gates, read-before-write, exact readback, idempotency, and
fail-closed rules were retained. This manual flattening is a distribution-drift
risk and is not accepted as the long-term packaging path.

In both fresh conversations, ChatGPT automatically added the installed
`Personal AI Workspace` app to the Work task's Sources list. No Gmail, browser,
direct database, or alternate state source appeared.

## S1 read-only smoke

The fresh conversation used the short Chinese intent from the routing suite,
without naming the Skill. The visible reasoning said it would use the daily job
search review procedure and remain read-only.

Observed behavior:

- ChatGPT displayed one PAW activity card: `Reviewed today's workspace activities`.
- The response reported the Workspace date and time zone.
- It preserved one high-priority attention item, zero upcoming items, 11 active
  applications without open Tasks, and the recent lifecycle changes returned by
  Today.
- No broad inventory, Gmail, mail-scan, or mutation card appeared.
- An independent direct `workspace_get_today` read after the web run agreed with
  the reported section counts, classification, ordering, and summarized content.

The UI did not export the raw function name, arguments, result, or a Skill-load
identifier. The single activity label is consistent with `workspace_get_today`,
but the runbook forbids inferring an exact trace from presentation text alone.

S1 smoke result: **BEHAVIOR MATCHED; EXACT TRACE INCONCLUSIVE**.

## S2 read-only smoke

A separate fresh conversation asked for the current state and recommended next
step for one exact existing application. The prompt was intentionally read-only;
the production identity is omitted from this committed artifact.

Observed behavior:

- ChatGPT stated that it was using the single-application lifecycle procedure and
  would not modify application or Task state.
- The visible PAW activity changed from exact application lookup to project-state
  retrieval before the final answer.
- The response reported `ACTIVE`, `INTERVIEWING`, lifecycle version 2, one stored
  evidence item, and one open high-priority interview-preparation Task.
- Advice remained clearly separate from durable state.
- No observation, proposal, admission, Task mutation, Gmail, mail-scan, browser,
  or database fallback appeared.
- Independent direct calls to `workspace_find_job_application` and
  `workspace_get_project` agreed with the lifecycle state/version, evidence count,
  and open Task state reported by the web conversation.

The UI consolidated the PAW activity into a natural-language card rather than
exporting raw ordered function names and arguments. No pre/post database
fingerprint was available for the live Workspace.

S2 smoke result: **READ-ONLY BEHAVIOR MATCHED; EXACT TRACE AND STATE-DELTA PROOF
INCONCLUSIVE**.

## Platform classification

| Platform | Discovery | PAW binding | Read-only behavior | Mutation behavior | Overall |
|---|---|---|---|---|---|
| ChatGPT web Work | Behavioral evidence only | Observed for S1/S2 reads | Matched direct PAW reads | Not run | `INCONCLUSIVE` |
| Codex fresh repository context | Not run | Not run | Not run | Not run | `INCONCLUSIVE` |
| ChatGPT iPhone | Not run | Not run | Not run | Not run | `INCONCLUSIVE` |

## Remaining acceptance gaps

1. Exportable evidence that the intended Skill, not only matching model behavior,
   loaded in each conversation.
2. Raw ordered tool names, sanitized arguments, and results from the platform.
3. An isolated synthetic Workspace with external before/after logical
   fingerprints.
4. Full positive, negative, ambiguous, failure, and baseline routing suites.
5. S2 authority, proposal, admission, stale-version, terminal-state, and mismatch
   cases on isolated fixtures.
6. A deterministic packaging path that preserves the canonical repository Skill
   and reference hashes in the ChatGPT snapshot.
7. Independent fresh Codex and ChatGPT iPhone runs.

## Decision

The smoke materially improves the evidence: account-visible Skill installation,
implicit natural-language behavior, PAW app binding, and S1/S2 read-only output all
worked in fresh ChatGPT Work conversations. It does not close the platform gate.

Campaign result: **INCONCLUSIVE FOR FULL ACCEPTANCE**

S3 recommendation: **HOLD**. Do not implement `job-mail-scan` until the remaining
runbook evidence is captured on isolated fixtures and a human explicitly approves
S3.
