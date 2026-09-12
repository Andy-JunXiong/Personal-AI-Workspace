# Skill and project evidence library

Status: baseline deployed as `skill-library-20260912-r1`, September 12, 2026.
Incremental-update follow-up is implemented locally; release and scheduled-task
evidence are recorded separately below.

## Continuity and benefits

Jun clarified that [candidate matching](CANDIDATE_MATCH_GRADES.md) should compare
JD requirements against a consolidated skill/project library. Uploaded resumes
and Drive documents supply evidence; linked GitHub projects supply evolving code
evidence. This package adds versioned synthesis, controlled imports, commit-pinned
GitHub refresh, MCP operations and website display, following the
[core workflow](CORE_JOB_WORKFLOW.md).

The immediate benefit is reuse of one evidence-backed inventory across jobs, with
explicit conflicts and stale-source detection. Next: consolidate actual documents,
register the user's selected repositories and save a real skill-based assessment.
Long-term, the same operations can support scheduled analysis without maintaining
separate skill inventories per job. This does not create a schedule, confirm unknown
tenure or change application decisions.

Ownership follows the existing [platform decision](../strategy/OPENAI_PLATFORM_WATCH.md):
GPT/connected Drive tools read and interpret documents; PAW owns domain records,
source-version checks, admission and durable receipts. The catalog and matching are
PAW-specific. A bounded public GitHub reader provides repeatable checks/snapshots,
not a general repository browser. Revisit when an authorized connector can supply
equivalent attributable snapshots, especially for private repositories. No private
GitHub token or extra model service has been configured.

## Data and admission

- Reuse `job_library_sources` and `idempotency_records`; no migration.
  `skills:catalog` stores validated `skill-library-v1` JSON, at most 50,000
  characters, 100 skills/facts and 30 projects. Stable IDs, aliases, usage summaries,
  project links and SUPPORTED/UNKNOWN/CONFLICT statuses are explicit.
- Supported skills and all projects cite exact quotes, source IDs, versions and
  hashes. Summaries/contributions remain GPT interpretations, not independent proof
  of authorship or human confirmation. The catalog stays SOURCE. Confirmed screening
  facts/preferences remain in their existing separate source.
- `reviewedSources` declares review of the current effective directory (maximum
  100). Admission verifies coverage/versions, not that GPT actually read every word.
  Duplicate canonical names/IDs and broken project links are rejected; semantic
  synonym merging remains GPT's responsibility.
- Adding, excluding or changing a source makes coverage stale. Changed supporting
  evidence identifies affected skills. Identical GitHub snapshots do not change
  library versions. Historical reports keep original sources.
- Generic source writers cannot overwrite managed `skills:` or `github:` keys.
  Uploaded/Drive text imports use stable `import:` keys and stay SOURCE. Text
  acquisition is caller-attributed; no fabricated extraction or automatic confirmation.
- Writes require explicit authority, CAS and principal-bound idempotency. Exact
  retries return historical receipts; reread current state after replay. Source
  updates and receipts commit atomically. Reads/references remain workspace-scoped.

## GitHub refresh

`workspace_refresh_github_project` registers/refreshes a public repository and 1–8
selected text paths. Each new request checks default-branch HEAD. Unchanged commit
and paths reuse evidence; new commits read all selected files at that SHA. Changed
path selection also requires capture. The UI exposes commits, capture/check times,
paths and failures. This is selected-file evidence, not a full-repository audit.
Technology does not establish personal contribution, proficiency or SWE tenure.

The reader uses fixed `https://api.github.com`, rejects redirects/unsafe paths,
and bounds the total deadline to 30 seconds, responses to 200 KB, files to 30 KB,
and total text to 38,000 characters. Binary, missing, oversized, private or
inaccessible files produce FAILED receipts while retaining prior sources. There is
no execution, checkout or credential access. Underlying operations follow the
[GitHub commit API](https://docs.github.com/en/rest/commits/commits) and
[contents API](https://docs.github.com/en/rest/repos/contents).

Refresh occurs on user/GPT command, not read-only page GET. The JD prompt requires
refresh before each analysis; the server does not independently prove that every
model run invoked it. No scheduled execution acceptance is claimed. Retries replay
the original check; a new check needs a new key. A failed check must be reported,
not described as latest evidence.

## Tools and matching

Four additions bring MCP inventory to **40**:

| Tool | Purpose |
| --- | --- |
| `workspace_get_skill_library` | Catalog/stale state, paged directory, selected full sources and GitHub receipts |
| `workspace_record_skill_source` | Attributable uploaded/Drive text import; no external document write |
| `workspace_record_skill_library` | Save synthesis with current coverage and exact evidence |
| `workspace_refresh_github_project` | Check/register a repo and save commit-pinned selected files |

Candidate context includes the catalog and supporting sources in the existing
manifest and immutable snapshot. With a catalog present, new match evidence must
use `kind=SKILL`, `skillId`, catalog `sourceId` and exact skill summary. Unsupported,
conflicting or stale skills cannot substantiate MATCH/PARTIAL. Unknown requirements
retain UNKNOWN with no invented evidence. Education/experience facts have distinct
categories; screening still uses the separately confirmed profile.

A catalog supports matching without a base resume. The legacy base-resume context
and hash remain for old contracts; old reports keep their original display.
Raw-source matching remains available when no catalog exists, while the new prompt
requires constructing the catalog first. Updated catalog/source versions invalidate
previous report inputs.

The library separates skills/projects, GitHub sources and raw documents, with a
copyable synthesis prompt and CSRF-protected GitHub form. The JD prompt sequences
refresh → synthesis → fresh context → screening → skill matching → saved readback.
Reports show skills/projects first, original evidence in a disclosure. Candidate,
KEEP, application and Task state is preserved.

## Verification and pending acceptance

Shared assessment evidence and new MCP/Web authority entries justify full
regression. Final `npm run verify` passed **514 tests / 63 files**, both TypeScript
projects and build. Twelve new cases cover durable/reopened synthesis, stale/forged
evidence, duplicate/coverage rejection, rollback, isolation, commit pinning/reuse/
failures, unsafe paths/redirects/binary content, reauthorization/CAS, matching/history,
actual MCP invocation and scoped Web authority.

Synthetic desktop browser inspection verified library sections, copy success,
skill/project matching and expandable evidence without horizontal overflow. The
actual reader fetched public `octocat/Hello-World` README at commit
`7fd1a60b01f91b314f59955a4e4d4e80d8edf11d`, without a Workspace write. Narrow-viewport
and actual user-repository acceptance remain pending.

No real catalog, GitHub source or report was saved by these checks. User repository
selection, real synthesis and skill-based report-return acceptance are pending.

## Production release — September 12

- Release `skill-library-20260912-r1`, runtime commit
  `b8f09b51db9a794bb7af18d7e3fc470470140207`, pushed to GitHub main.
  Healthy cutover: `2026-09-12T11:19:27Z` (21:19 Sydney).
- Source archive SHA-256:
  `8f0909e94a3a05853cecce2af049887cf24d550cd1a5cc5cb750e83482eb25c5`.
  Image: `sha256:b4c8fc8d98ae89cc17b3f4463c6dafc302f87b00cfcb27a352ad2c37893541eb`.
- Backups `workspace-20260912T111902Z.db` and immediate pre-cutover
  `workspace-20260912T111920Z.db`. Both new and preceding
  `jd-chatgpt-handoff-20260912-r1` images passed copy recovery with unchanged
  **50 tables / 2,271 rows**. Migration 020 and existing volume/Web/Gmail overlays
  are retained. Temporary encrypted transfer object and local signed URL removed.
- Build/cutover/readback logs are under `/srv/paw/deployments/` with prefix
  `skill-library-20260912-r1-`. Shell syntax, archive checksum and five public
  checks passed. Production read-only MCP probe found **40 tools**, including all
  four additions. The deployed GitHub reader fetched the public example above.
- Authenticated library page and MCP agree: catalog **MISSING/version 0**,
  **38 raw sources / 2 confirmed**, no registered GitHub project. Copying the
  synthesis prompt shows success. The Google page retains the new analysis panel
  and no longer renders the old generic ChatGPT box.
- Readback preserved Google candidate v2/DISMISSED and its existing legacy
  assessment v1/CURRENT, B−, ID `40371a51-970d-484c-af5e-48f922b69db4`.
  That previously saved report is not a skill-catalog acceptance result.
  No candidate, application, source, catalog or report was written by release probes.
- ChatGPT's existing developer-mode PAW connection was refreshed through its
  management page. The advertised list changed from 36 to **40**, showing all
  four new tools. Permissions were unchanged; no ChatGPT prompt was submitted.
  This verifies metadata refresh, not actual model invocation or report return.
  Start the real trial in a new conversation, following the
  [official refresh workflow](https://developers.openai.com/plugins/deploy/connect-chatgpt).

Remaining real-use sequence: select repositories, synthesize existing documents,
read back the catalog, then save/read a SKILL-based JD report. Scheduled execution,
narrow-viewport inspection and the separate 8+/10+ FILTER → KEEP trial remain
unverified. These documentation updates do not invalidate final runtime checks.

## Incremental updates and daily GitHub checks — September 12 follow-up

### Continuity and benefits

Jun's real ChatGPT feedback reports a complete catalog v3 with 32 entries and six
projects, restored after an accidental empty-catalog replacement. Five registered
GitHub projects were unchanged; new screening/match writes failed because the
client did not consume a fresh manifest. The full original response is private.
An authenticated website read independently confirms 32 entries/six projects;
the exact v3 and failure narrative remain user-supplied evidence until readback.

This follow-up separates frequent project refresh, stable skill maintenance and
per-JD analysis. It adds server-side incremental merge, protects existing entries,
and offers compact exact write inputs. This enables a daily 07:45 Australia/Sydney
ChatGPT task and faster repeated JD analysis. Immediate benefits to verify are
retained entries and review coverage, no version churn for unchanged catalogs,
and identical full/compact manifests. Long-term, many jobs reuse one maintained
inventory. GPT still interprets evidence; PAW validates/saves it. Scheduling stays
with ChatGPT, following the existing ownership decision; no new scheduler or
model service is introduced. Candidate decisions and application/Task state remain
outside this daily task.

### Current contract (supersedes baseline per-JD refresh instructions)

- Website order: **GitHub projects and updates → My skills and projects → raw
  documents**. Per-repo checks stay with their source. Check-all runs existing
  scoped single-project writes sequentially, continues after failures, shows counts
  and individual outcomes, and retains failed sources. Buttons save source evidence;
  the adjacent GPT instruction performs semantic skill updates.
- Existing catalogs use `workspace_record_skill_library(updateMode=MERGE)`.
  `catalog` contains only changed skill/project upserts, actually reviewed changed
  source references and added limitations. The server retains all unaffected
  entries/coverage/limitations, drops coverage for sources no longer effective,
  then validates the complete merged result. Exact stale evidence must be repaired,
  not silently assigned a new hash. `changes` identifies added/updated/removed
  sources without requiring every old resume body again.
- REPLACE remains for initialization/complete deliberate correction, but cannot
  silently omit existing IDs. Removals require explicit `removeSkillIds`/
  `removeProjectIds` and `removalReason`; automated GitHub prompts prohibit these.
  Empty catalogs are rejected. Identical content retains source version/hash while
  saving an attributable command receipt. Preceding-release idempotency hashes
  remain compatible when new controls are omitted.
- `workspace_get_job_candidate(contextView=SKILLS, includeAssessmentContext=true)`
  returns JD, catalog, confirmed sources and exact manifest without duplicate raw
  resume bodies. `contextView=MANIFEST` returns compact current write inputs after
  evidence review; FULL retains old behavior. All views share admission inputs;
  projections change neither evidence snapshots nor hash checks. This mitigates
  oversized responses; it is not proof of the prior client's exact failure cause.
- JD prompts reuse CURRENT and stop for independent maintenance when stale or
  missing. They do not refresh GitHub or rewrite the skill library. Recent check
  times/failures are disclosed; absent daily checks do not establish missing ability.
- Daily GPT prompt checks registered repos, saves receipts, merges only affected
  GitHub evidence, and does no catalog write when there is no source difference.
  Missing/invalid catalog or unrelated document changes are reported for manual
  maintenance. No catalog initialization, removals, screening or match-report writes.
  CURRENT means source consistency, not personal confirmation or whole-repo audit.

### Verification and rollout

Focused checks passed: 62 tests across skill library, Web auth and MCP transport;
both TypeScript projects. Final `npm run verify` passed **518 tests / 63 files**,
both type checks and build. Synthetic desktop readback confirms section order and
maintenance prompt placement. Recovery, deployed behavior,
connector schema refresh, manual task trial and actual scheduled trigger are
separate gates. The 07:45 task is authorized but not yet created at this local stage.
