# Workspace Skills Deterministic ChatGPT Web Smoke — 2026-09-08

**Status:** EXECUTED — READ-ONLY BEHAVIOR MATCHED; FULL ACCEPTANCE INCONCLUSIVE

This follow-up campaign verifies the deterministic Skill packaging introduced by
merge commit `998c20e58a8733fb56eb338d0e9e97d53b880618` and repeats one S1 and one
S2 read-only smoke case in separate fresh ChatGPT Work conversations.

It does not claim full platform acceptance. The live Workspace was not an isolated
synthetic fixture, the ChatGPT UI did not expose raw function traces or Skill-load
identifiers, and no lifecycle mutation case was run.

## Campaign identity

| Field | Recorded value |
|---|---|
| Campaign ID | `chatgpt-web-deterministic-skills-smoke-2026-09-08` |
| Executed at | 2026-09-08T04:52Z–2026-09-08T04:57Z |
| Repository commit | `998c20e58a8733fb56eb338d0e9e97d53b880618` |
| Release version | `0.1.0` |
| S1 Skill SHA-256 | `ed7063d81d51f5042660be6e501ad99f7921f7b65df6a521bfa7db134150ba53` |
| S2 entrypoint SHA-256 | `bf21daa95cccb913aae666f5f3f848e1e92b85e2f2ee55e6112937532906c881` |
| S2 mutation reference SHA-256 | `cb0203459484afa7c426648cda17925a0fbf6c18cf43581dde908130f376caae` |
| S1 package SHA-256 | `d2e8a43589a9efd15afeb0587d47bd18b02181aacfdd47a40bfc71354f91399e` |
| S2 package SHA-256 | `f953a328adfde87be948c15ddcdfb95e5ae259906da67b6735aeae906fd961cc` |
| Release manifest SHA-256 | `ac001a4335939e7e83f96a83484a1e1318f49fcaf4ec36e91a8ac3a4d7c2f674` |
| Runtime | ChatGPT web, Work mode |
| Model shown by host | GPT-5.6 Sol Light |
| PAW binding | Installed `Personal AI Workspace` source; identifier omitted |
| Workspace | Existing live Workspace; identifiers omitted |
| Workspace date/time zone | 2026-09-08 / Australia/Sydney |

The exact merge commit passed local `npm run verify`: 39 test files and 306 tests,
including typecheck and production build. Pull-request-head workflow run
[34187175891](https://github.com/Andy-JunXiong/Personal-AI-Workspace/actions/runs/34187175891)
also completed successfully for the merged content.

## Deterministic package and installed snapshot

The canonical release command was run from the exact merge commit:

```sh
npm run skills:package -- --source-ref 998c20e58a8733fb56eb338d0e9e97d53b880618
```

Both archives passed ZIP integrity checks. The generated manifest recorded the
same source commit and the package hashes above.

Installed snapshot verification found:

- `job-search-today-review` already matched the canonical S1 `SKILL.md` byte for
  byte, so no content update was required.
- `application-lifecycle-review` still contained the earlier manually flattened
  procedure. It was replaced with the canonical S2 `SKILL.md` plus
  `references/mutation-procedure.md` while retaining its existing UI metadata.
- The saved S2 entrypoint and reference were read back and matched the repository
  hashes above.

This closes the earlier manual-flattening drift for the two installed Skills. It
does not prove that the runtime exposes the package version or hashes during each
invocation.

## S1 read-only smoke

The first fresh ChatGPT Work conversation used this short implicit prompt:

> 看看今天求职有什么需要处理。只读，不修改任何 Workspace 状态，不使用 Gmail。

Observed behavior:

- ChatGPT stated that it would use the Today review procedure and remain read-only.
- The visible Sources list contained `Personal AI Workspace`.
- The response reported the Workspace date/time zone, one high-priority attention
  item, zero upcoming items, zero overdue or blocked items, 11 active applications
  without an open Task, and the recent lifecycle changes.
- The response stated that only the Workspace Today read was used. No Gmail,
  inventory, detail-read, or mutation activity was visible.
- An independent direct `workspace_get_today` call after the web run agreed with
  every reported category count, ordering, and summarized state.

Result: **BEHAVIOR MATCHED; EXACT SKILL-LOAD AND RAW TRACE INCONCLUSIVE**.

## S2 read-only smoke

The second fresh ChatGPT Work conversation requested the current state and next
step for one exact existing application, explicitly read-only and without Gmail.
The production application identity and Task identifiers are omitted here.

Observed behavior:

- ChatGPT stated that it would follow the single-application lifecycle review and
  first resolve the company/role before reading the Project.
- The visible Sources list contained `Personal AI Workspace`.
- The response reported `ACTIVE`, `INTERVIEWING`, lifecycle version 2, one stored
  evidence item, and one open high-priority interview-preparation Task.
- The recommendation remained separate from durable state.
- No observation, proposal, admission, Task mutation, Gmail, mail-scan, browser,
  or direct-database fallback was visible.
- Independent direct `workspace_find_job_application` and `workspace_get_project`
  calls returned an exact match and agreed with every durable field summarized by
  the web response.

Result: **READ-ONLY BEHAVIOR MATCHED; EXACT SKILL-LOAD, RAW TRACE, AND STATE-DELTA
PROOF INCONCLUSIVE**.

## Evidence limits

The following remain unavailable from this campaign:

1. A platform-exported Skill-load identifier and installed artifact hash for each
   conversation.
2. Raw ordered ChatGPT function names, arguments, and results. The UI exposes the
   PAW source and model narrative, not an exportable trace.
3. An external before/after logical fingerprint. The campaign used the live
   Workspace and therefore intentionally avoided direct database access.
4. Independent proof of zero mutation. Matching post-run versions and the absence
   of visible mutation activity are supporting evidence, but not the runbook's
   required before/after state proof.
5. The complete routing, ambiguity, failure, mutation, baseline, Codex-fresh, and
   iPhone suites.

The natural-language statement that no mutation occurred is not treated as
independent evidence.

## Subsequent companion evidence

After this historical live smoke, [PR #18](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/18)
merged the isolated synthetic acceptance harness as
`495a12955f75df486418f0e99a6c61258ac2fb2d`. Its 8/8 passing campaign supplies
operator-side durable-state fingerprints for the S1 normal path and representative
S2 read, proposal, observation, authorized transition and failure paths. See
[the synthetic acceptance record](workspace-skills-synthetic-acceptance-2026-09-08.md).

That companion campaign closes the local Workspace/MCP contract-level state gap.
It does not retroactively supply raw traces, Skill-load provenance or state proof
for these two historical live ChatGPT conversations.

## Platform classification

| Platform | Packaging/discovery | PAW binding | S1 | S2 | Overall |
|---|---|---|---|---|---|
| ChatGPT web Work | Installed source hashes matched canonical release | Observed | Read-only behavior matched | Read-only behavior matched | `INCONCLUSIVE` |
| Codex fresh context | Repository Skill files present; not independently run | Not run | Not run | Not run | `INCONCLUSIVE` |
| ChatGPT iPhone | Not run | Not run | Not run | Not run | `INCONCLUSIVE` |

## Stop-condition assessment

| Question | Current evidence-based answer |
|---|---|
| Did Skills reduce repeated prompt instructions? | Yes for the two smoke prompts; no broad baseline measurement yet. |
| Did routing work reliably? | Both tested implicit positive prompts behaved correctly; full positive/negative suite remains unrun. |
| Did tool traces become more consistent? | Behavior followed the intended minimal sequences, but raw trace export is unavailable. |
| Did unnecessary Workspace calls decrease? | S1 showed the intended Today-only behavior; broader comparison remains incomplete. |
| Were zero-mutation claims independently verified? | No. A synthetic fixture and external before/after fingerprint are still required. |
| Did mutation flows preserve authority and exact readback? | Not tested in this read-only live campaign. |
| Do Codex and ChatGPT use different distribution/binding? | Yes; repository discovery and installed ChatGPT Skills remain distinct bindings. |
| What synchronization risk remains? | Runtime invocation does not expose installed hash/version, so per-run artifact identity remains indirect. |
| Is `job-mail-scan` justified? | Not yet. Higher-risk acceptance prerequisites remain open. |

## Decision

Campaign result: **READ-ONLY BEHAVIOR MATCHED; FULL ACCEPTANCE INCONCLUSIVE**

S3 recommendation: **HOLD**. The representative isolated contract cases now pass,
but model/runtime routing and authority behavior, the remaining failure matrix,
baseline comparison, installed runtime provenance, iPhone acceptance and the mail
platform block remain open. A human must explicitly approve S3.
