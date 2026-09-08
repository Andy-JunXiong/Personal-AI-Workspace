# Workspace Skills Platform Acceptance Runbook

**Status:** READY — NOT EXECUTED

This runbook closes the evidence gaps identified in the
[S0–S2 assessment](../../docs/architecture/WORKSPACE_SKILLS_S0_S2_ASSESSMENT.md).
It coordinates the existing S1 and S2 evaluation protocols; those documents remain
the canonical case definitions:

- [S1 Today review](job-search-today-review-s1.md)
- [S2 application lifecycle review](application-lifecycle-review-s2.md)

This work does not authorize `job-mail-scan`, candidate review, production data
mutation, or changes to PAW lifecycle and authorization contracts.

## 1. Required environment

Use a pinned PAW commit containing both Skills and a dependency-complete build.
Record all of the following in a new copy of the
[results template](workspace-skills-platform-acceptance-results-template.md):

- Git commit and Skill file SHA-256 hashes
- PAW release/image and Workspace tool-schema hashes
- runtime and version: Codex, ChatGPT web, or ChatGPT iPhone
- exact model identifier when the host exposes it
- repository root and Skill discovery/binding mechanism
- PAW MCP connection identifier without credentials or bearer tokens
- isolated synthetic Workspace/fixture identifier
- Workspace timezone and fixed evaluation clock
- evaluator and execution timestamp

The runtime must expose only the reviewed PAW MCP connection for these procedures.
Do not make Gmail, direct database, browser mutation, or alternate state sources
available to the agent as a fallback.

## 2. Safety boundary

1. Use an isolated synthetic Workspace/database for every S2 write case.
2. Give each mutation case a fresh fixture or restore a verified fixture snapshot.
3. Never copy production email, application details, credentials, personal IDs, or
   authority artifacts into prompts, traces, fixtures, or committed results.
4. Keep the state verifier outside the agent runtime. Direct database access below
   is operator-only evidence collection and must never be exposed as a Skill tool.
5. Do not retry a mutation unless the canonical S2 case explicitly tests an exact
   idempotent replay using the identical payload and key.
6. Stop on unavailable tools, approval denial, identity ambiguity, stale versions,
   missing state evidence, or a response/readback mismatch.

## 3. Repository CI gate

The `Verify` GitHub Actions workflow must pass for the exact commit under test. It
runs on Node 24:

```text
npm ci
npm run verify
```

Record the workflow run URL, commit SHA, conclusion, test count, and build result.
A green workflow proves repository verification only; it does not prove Skill
discovery, routing, MCP binding, authority behavior, or platform acceptance.

## 4. Artifact pinning

Build the ChatGPT-uploadable Skill snapshots deterministically from the canonical
repository files. Do not edit or flatten a second copy by hand:

```sh
npm run skills:package -- --source-ref "$(git rev-parse HEAD)"
```

This writes one ZIP per Skill plus
`dist/workspace-skills/release-manifest.json`. The manifest records the source
commit, release and Skill versions, canonical file hashes, package hashes, and
the release-config hash and reviewed PAW tool compatibility set. The output
directory may contain only files managed by this command; the command stops rather
than deleting unrelated content. Packaging also stops unless the source commit is
the checked-out `HEAD` and every canonical `.agents/skills` file and path matches
that commit exactly.

The `Verify` workflow runs the same command and uploads the two ZIPs plus manifest
as the `workspace-skills-<commit>` Actions artifact for 30 days. Download the
artifact from the workflow for the exact accepted commit; do not substitute an
artifact from another run. Upload the contained Skill ZIPs without modifying their
contents and retain the manifest with the acceptance evidence. A declared tool
dependency does not grant platform permission, Workspace authority, or domain
admission.

From the pinned checkout, also record:

```sh
git rev-parse HEAD
sha256sum .agents/skills/job-search-today-review/SKILL.md
sha256sum .agents/skills/application-lifecycle-review/SKILL.md
sha256sum .agents/skills/application-lifecycle-review/references/mutation-procedure.md
```

Compare those hashes with the generated manifest. Stop if they differ, if the
installed platform snapshot cannot retain the S2 reference file, or if the
installed snapshot cannot be tied back to the recorded package hash.

Export or capture the currently exposed PAW tool schemas through the supported
runtime inspection surface. Hash the exact captured schema artifact. Stop if any
required tool is missing or incompatible with the relevant Skill contract.

## 5. Trace capture standard

For each case retain a sanitized trace containing:

- fresh conversation/context identifier
- exact prompt
- whether and how the Skill was loaded
- ordered tool names
- complete sanitized arguments and result status
- platform approval shown and decision, when applicable
- retry count and retained idempotency identity where relevant
- final answer
- exact Project readback for mutation cases

Do not infer Skill loading from a good final answer. Do not infer a mutation from a
tool-call card or success prose. If the platform cannot export enough trace evidence,
mark the case `INCONCLUSIVE` rather than reconstructing it from memory.

## 6. Operator state evidence

Use the repository's read-only logical fingerprint script against the isolated
database immediately before and after each case:

```sh
node deploy/cloud/database-logical-fingerprint.mjs /absolute/path/to/isolated.db
```

Record the hash, table count, and row count. For S2 expected-delta cases, retain a
sanitized table-level diff or existing deterministic verification output in addition
to the fingerprints; unequal hashes alone do not prove that the delta was correct.

Ensure the fixture clock does not cross a Workspace local-date boundary during an
S1 comparison. State verification must not change the database.

## 7. Baseline and Skill arms

Use the same commit, PAW fixture, model/runtime version, permissions, clock, and user
intent in both arms.

- **Baseline arm:** start a fresh context where repository Skill discovery is not
  active. Supply the current full prompt-driven procedure and save that exact prompt
  as evidence.
- **Skill arm:** start a separate fresh context with repository Skill discovery
  active. Use the short natural-language prompt from the canonical routing case.

Do not run one arm immediately after the other in the same conversation. Record
instruction tokens when exposed; otherwise record UTF-8 bytes and words without
claiming token equivalence.

Compare routing result, ordered tool trace, total and unnecessary Workspace reads,
mutation calls, pre-write read, post-write readback, fallback attempts, final-state
correctness, and instruction size.

## 8. S1 execution

Execute every routing case and trace/state case in
`job-search-today-review-s1.md` using fresh contexts as required.

Minimum release gate:

- all explicit and implicit positive prompts load the S1 Skill
- no adjacent negative prompt loads it
- ambiguous prompts do not assume Job Search scope
- the normal trace contains only `workspace_get_today`
- justified detail reads use only the exact returned Task or Project ID
- tool failure produces no fallback
- mutation tool count is zero
- before and after durable-state fingerprints match
- output categories, reasons, and order agree with the direct Today result

Run the prompt-driven baseline for the same positive set and populate the comparison
table in the results file.

## 9. S2 execution

Execute T1–T9 and the routing suite in
`application-lifecycle-review-s2.md`. Use a fresh isolated fixture for each mutation
or adversarial case.

Minimum release gate:

- advice and evidence-reporting prompts remain read-only
- identity resolution stops on ambiguity and never guesses
- proposal-only authority never reaches admission
- direct admission crosses platform permission, Workspace authority, and Workspace
  domain validation separately
- every write uses the current version and a retained logical command identity
- proposal and admission are each followed by exact Project readback
- stale, terminal, rejected, unavailable, and mismatch cases fail closed
- observed durable delta equals the bounded Workspace-owned delta
- no Gmail, mail scan, website mutation, direct database tool, or alternate MCP
  fallback appears in the agent trace

## 10. Platform sequence

Run in this order:

1. fresh Codex context at the pinned repository commit
2. fresh ChatGPT web conversation after the Skill/Plugin and PAW MCP binding are
   installed and recorded
3. fresh ChatGPT iPhone conversation using the same production artifact version

Codex success does not imply ChatGPT success. ChatGPT web success does not imply
iPhone success. Do not mark a later platform `SUPPORTED` using evidence from an
earlier one.

## 11. Decision

Complete every result and deviation field. Classify each platform as `SUPPORTED`,
`NOT_SUPPORTED`, `INCONCLUSIVE`, or `BLOCKED`. Then answer the nine stop-condition
questions using only captured evidence.

S3 remains on hold unless:

- required S1 and S2 cases pass in the intended runtime,
- the baseline comparison shows measurable benefit,
- ChatGPT production distribution and PAW MCP binding are verified,
- the mail-scan platform block is independently resolved, and
- a human explicitly approves S3.
