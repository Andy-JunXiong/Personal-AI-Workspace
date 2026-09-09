# Backend-managed mail scan receipts

## Ongoing-only keyword follow-up — 2026-09-09

**Continuity and benefits:** Jun corrected bulk checks to stop tracking rejected
or ended applications and use keyword search rather than full-body acquisition.
The previous all-application manual check ignored existing rejection state and
flagged long/HTML-only messages as incomplete. The correction selects only ongoing
applications, blocks direct checks on ended records, and rechecks queued targets
before execution. It uses Gmail `format=metadata` with Subject/From headers and a
bounded snippet, without reading body MIME parts. This immediately removes
full-body length/HTML blockers and avoids repeat work on closed applications.
The next gate is production release and a fresh ongoing-only website check;
longer-term value is state-aware, bounded follow-up against the same evidence
ledger. No migration, new scheduler or lifecycle/task write authority is added.

New JOB_METADATA company/sender snapshots also exclude ended/paused applications;
generic discovery keywords remain, so an incidentally matching message about an
ended application is not evidence that the application should be reopened.
Previously saved run snapshots remain immutable. The hosted daily task's saved
prompt and full-source acknowledgement contract were not changed by this package.

The manual UI now says “补查进行中岗位的新邮件”. Direct terminal checks fail before
creating a run or contacting Gmail. A target closed while queued is SKIPPED, not
reported as a failed mailbox. During execution, state is revalidated before the
next search and before evidence writes. Email interpretation receives only the
subject and up to 600 snippet characters, with instructions not to invent omitted
content. Uncertain classification, provider failure and search pagination limits
still produce an honest incomplete result. Existing evidence deduplication and
quote validation remain; no keyword hit automatically changes application state.
The query coverage key is versioned to distinguish this new acquisition policy.

Provider contract: [Gmail messages.get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get)
supports selected headers with METADATA; [Message](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages)
includes the short snippet. The implementation requests only the needed fields.

Local verification passed: 369 tests in 44 files, server/browser type checks and build. Coverage includes terminal/paused exclusion, mid-queue closure, owner isolation, metadata-only reads, HTML/long-body independence and exact time bounds. Release and live acceptance
must be distinguished from these code checks. Historical releases follow below.

Deployment successor: [resume-20260909-r2](APPLICATION_RESUME_ASSOCIATIONS.md#validation-and-release-evidence)
adds Drive resume associations while preserving this mail contract and migration
014. The mail release/run/task evidence below retains its own scope; the resume
release did not run a scan or change either scheduled task.

Current change, 2026-09-09: Jun superseded whole-mailbox ingestion with
subject/company/exact-sender job search, normally 24 hours and at most 72 hours
for recovery. The implementation below passed 363 tests and is deployed as
`job-mail-20260909-r1`, migration 014. Live migration, 30-tool discovery and web
checks passed. The third hosted JOB_METADATA run is independently verified
COMPLETE/CLOSED for both matching-mail scopes, with zero pending/blocked sources
and unresolved actions. Website scope/status/counts match the persisted receipt.
The filtered manual coverage/readback gate is passed. The retained daily task
was updated and enabled on September 9 for 08:00 Australia/Sydney; the obsolete
task remains paused. Actual scheduled acceptance remains pending.
The previous seven-day release and acceptance evidence below remain historical.

### Previous whole-mailbox status and handoff

Previous production: `mail-body-20260909-r4` on 2026-09-09, migration 013,
30 live MCP tools. Production migration, health, contract and website readback
passed. Six actual ChatGPT BACKEND attempts closed PARTIAL; the sixth mailbox-2
receipt is COMPLETE through its cutoff. Fifty-two acknowledgements were independently
verified through run five; run six reports ten more. Hosted body continuation and HTML recovery were acknowledged. Full manual/scheduled acceptance remains pending. This Codex
conversation still exposes the 29-tool pre-release definitions.
The implementation was locally verified on September 8, based on main `9b3620a`.

End-of-day handoff: the user requested documentation updates and a commit/push
to GitHub main, then stopping work for today. The containing Git commit identifies
this source package; publication is not a deployment or task activation.
Resume at the deployment-copy migration/release gate below. Do not restart
strategy discussion or treat the synthetic checks as restored daily ingestion.

September 9 continuation: local verification, image build, actual deployment-copy
rehearsal and authorized production cutover passed. The user confirmed both tasks
paused before cutover. See the [current deployment record](#production-cutover-2026-09-09)
below. The later [body extraction repair](#body-extraction-repair--2026-09-09)
was followed by [MIME/object recovery](#mime-alternative-and-object-recovery---2026-09-09)
and the current [body-part release](#body-part-reading-and-html-diagnostics---2026-09-09).
Deployment itself performed no scan or task activation.

## Continuity and benefits

The [approved requirements](MAIL_SCAN_BACKEND_LEDGER_REQUIREMENTS_2026-09-08.md)
and [core workflow](CORE_JOB_WORKFLOW.md) require durable daily source coverage
without GPT assembling receipt totals. This package adds an opt-in backend
receipt mode, transactional business-write attribution, and recovery rules to
the existing services. It adds no scheduler, model executor or website scan entry.

Local tests establish automatic aggregation, honest incomplete results and
recoverable source processing. This enables a reviewed deployment followed by
[actual ChatGPT manual and scheduled acceptance](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md).
The expected long-term benefit is reliable daily accounting while retaining GPT
interpretation and the existing authorization boundary. Platform acceptance and
daily usefulness are still unverified.

## Ownership check

1. This is Job Search source coverage and business-record attribution, a domain
   responsibility. It is not a general agent runtime or execution-history service.
2. The [Platform Watch](../strategy/OPENAI_PLATFORM_WATCH.md) records platform
   capabilities separately from target-environment evidence. This package adds
   no new claim about OpenAI eligibility, API access or hosted-write compatibility.
3. Execution logs alone do not establish which Gmail sources produced PAW rows,
   whether required actions succeeded, or which mailbox interval was completed.
   PAW therefore owns this database transaction and its derived receipt.
4. Revisit the execution boundary when target-environment capabilities are
   verified. Retain domain evidence, ownership and checkpoint invariants even if
   the platform later owns more orchestration.

## Tool contract and compatibility

| Operation | Backend-mode contract |
| --- | --- |
| `workspace_start_mail_scan` | Existing authorized write; add `receiptMode: "BACKEND"`. Keep a stable UUID `runId` for retries. Stores original authority/origin, both configured account bindings, fixed cutoff and bounded scope before fetching Gmail. Does not itself fetch mail. |
| `workspace_next_mail_batch` | Same bounded acquisition inputs. Stores run-to-batch acquisition, page cursor, IDs, body completeness and source identity. Existing recent/backfill lanes and seven-day policy remain. |
| Seven existing business tools | Optional `scanContext: {runId, batchId, messageId, actionKey}` attaches each attempted action to a completely read, pending source. The original command still checks business authority, evidence, expected versions, privacy and idempotency. |
| `workspace_ack_mail_batch` | Backend items require `verified: true`, `requiredActionKeys: []` or the actual required keys, and `projectId` for relevant mail. Failed/pending attempts and absent required actions block acknowledgement. Conflicting application associations also block it. |
| Automatic settlement | After next/ack, both completely processed mailbox ranges cause backend receipt/checkpoint settlement. GPT supplies no totals or final coverage claim. |
| `workspace_close_mail_scan` | New explicit write for early closure, with existing user confirmation/authority plus a reason. Backend derives each mailbox's actual completeness; pending source work survives. Repeated closure reads the immutable result. |
| `workspace_get_mail_scans` / website | Read-only receipt and progress, including mode, fixed scope, heartbeat and expired-lease/unresolved-action diagnostics. Reads do not fetch Gmail or reap runs. |

The seven business tools are create/update application, record observation,
propose/admit transition, and create/update task. `actionKey` identifies one
source obligation. Successful keys cannot change operation or payload. Failed
attempts may be corrected under the same key/operation; attempt hashes and
statuses remain. Changed business commands need appropriate idempotency keys.
Duplicate warnings and rejected proposals retain their original command results
and remain unresolved ledger actions.

Relevant acknowledgements query persisted account-qualified Gmail evidence for
the selected application. `RECORDED` requires an actual new scoped evidence
insert; a previously stored observation uses `EXISTING`. Excluded advertising
uses `IRRELEVANT`, explicit confirmation and no business actions. Classification,
matching and the assertion that all necessary actions/readbacks are included
remain GPT responsibilities; the backend cannot independently prove semantic
correctness or detect a necessary action that was never declared or attempted.

Omitting `receiptMode` preserves `LEGACY`; its existing start/finish/next/ack
contracts remain. Manual finish cannot override a backend run. The workspace
serializes scans while a backend run is active; finish an existing legacy run
before opting in. Unresolved backend source actions cannot be skipped by a
later legacy acknowledgement. Ordinary business writes without `scanContext`
are not attributed to a backend run just because their timestamps overlap it.
Saved task prompts are unchanged: opt in only after deployment and refreshed
tool discovery, with actual authorization in the target environment.

All ledger-affecting tools retain explicit write metadata. The existing hosted
`workspace_start_mail_scan` refusal is unresolved. This functional redesign is
not a renamed retry or proof of platform recovery; a refused write must stop.

## Persistence and recovery

Migration 012 adds six ledger tables and four scoped capture triggers; it
does not rewrite historical runs, queues or business rows. The write scope
exists only inside a synchronous SQLite transaction. Actual application,
Gmail evidence and task inserts, and admissions excluding the initial `NONE`
transition, are linked to the action/run/source in that same transaction.
Replays and ordinary concurrent writes do not produce new counts. Minimal
result IDs and request hashes are saved, not mail bodies or command payloads.

An action intent is durable before the business transaction. Exceptions roll
back business rows, idempotency rows and captured effects together, leaving a
failed attempt. Source obligations follow mailbox/message identity across runs
and clipped replacement batches. Completed receipts retain their original
write ownership; new runs do not reclaim previous inserts.

The inactivity lease is 30 minutes, refreshed by authorized processing. It is
not evidence that a worker is currently alive. Reads expose `EXPIRED` without
writing. A new authorized backend start closes expired runs as PARTIAL, with
no timeout-derived checkpoints, before resuming retained work under a new UUID.
Late source responses are rechecked against the running lease before persistence.
No background timer or task configuration was added.

Complete mailbox ranges and a receipt commit atomically. Early closure can
preserve one proven mailbox checkpoint while the other remains partial.
Exclusions older than seven days remain visible and never count as scanning.
Exact acknowledgement retries, including after automatic completion, are
read-only replays. A closed run cannot accept new business actions.

## Local verification and release gates

- Type checking and production build pass; 41 test files / 340 tests pass.
- [Ledger integration tests](../../tests/integration/mail-scan-ledger.test.ts)
  exercise authorization, source completeness, empty scans, duplicate and actual
  writes, admission, rollback, restart/timeout, late responses, MCP transport,
  per-mailbox coverage and atomic checkpoint failure/retry. Existing batch tests
  retain pagination, seven-day expiration and binding-isolation coverage.
- [012 migration verifier](../../scripts/verify-mail-scan-ledger-migration.ts)
  passes on a populated version-11 copy: unchanged old rows/schema history,
  exact additive schema, empty new tables, integrity and foreign-key checks.
- [Previous-code compatibility check](../../scripts/verify-mail-scan-ledger-rollback.mjs)
  passes using built main `9b3620a`: read a closed backend receipt and application
  without writes, perform/replay an ordinary synthetic observation, then reopen
  with new code and retain the receipt. No live mailbox/database was accessed.

To reproduce: run `npm run typecheck`, `npm test -- --maxWorkers=2`, and
`npm run build`. Build an isolated checkout of `9b3620a`, then run
`node scripts/verify-mail-scan-ledger-rollback.mjs <built-previous-source-root>`.
For a prepared 011/012 database pair, run the built
`dist/scripts/verify-mail-scan-ledger-migration.js <before.db> <after.db>`.

Before release, take a SQLite-consistent backup and run that verifier on the
actual deployment copy; synthetic evidence does not substitute for this gate.
Keep task policies paused while changing runtime versions. Before reverting
to old code, close backend runs with new code and keep daily scanning paused:
old binaries can read the additive schema but do not enforce backend obligations.
Retain the upgraded database and ledger rows; restoring a pre-upgrade snapshot
after new business writes would discard those writes.

After deployment, refresh discovery, verify the optional schemas and 30-tool
inventory, then independently record an authorized ChatGPT manual run, database
and website readback, and a real scheduled run. The September 9 deployment below
supersedes `mail-layout-20260908-r2` / migration 011 / 29 tools.

## September 9 release preflight

### Continuity and benefits

The September 8 handoff requires the actual deployment-copy migration gate before
release. This continuation connects migration 012's existing verifier to
`rehearse-database-copy.sh` through `--mail-scan-ledger-upgrade`, prepares the
source candidate, and verifies it locally. It does not deploy, scan mail, change
business records or activate tasks. After the user restored AWS login, the package
also built the candidate and passed a fresh cloud backup and isolated
candidate/restart/previous-image rehearsal. The next gate is reviewed cutover
and the existing hosted acceptance procedure. The verified immediate benefit is
a runnable 012 rehearsal entry and demonstrated preservation of the actual
production-copy data. The expected durable
benefit is repeatable release evidence for backend-owned daily accounting;
live cutover and operational recovery still require their own results.
This preserves the ownership decision above and introduces no platform workaround.

### Verified on 2026-09-09, approximately 07:57–08:02 Australia/Sydney

- Fresh Workspace MCP reads: database available, one historical MANUAL/PARTIAL
  receipt, zero checkpoints, zero unfinished scans and no processing streams.
  The current connector still exposes 29 tools. Task switches and the production
  image were not independently inspected.
- Initial verification in the Windows working directory failed on canonical
  Skill CRLF/LF comparisons and had one unexpected test-worker exit. An isolated
  LF checkout with the exact helper change passed server/browser type checking,
  **41 files / 340 tests** with `--maxWorkers=2`, and the production build.
  Canonical Skill files were not edited and packaging comparisons were not relaxed.
- `bash -n deploy/cloud/rehearse-database-copy.sh` and `git diff --check` passed.
  The helper selects the 012 verifier and retains the existing three-start
  upgrade-copy procedure, disabled web access and network isolation. Shell syntax
  and local tests do not establish a successful cloud container rehearsal.
- Initial candidate source: `79bc3ff2fa35d7a9fd8c3b4149e9614c714f140e` plus only
  `deploy/cloud/rehearse-database-copy.sh`. All 291 archived tracked files were
  compared byte-for-byte with the LF verification tree; all other files match
  that commit. The source archive excludes untracked data, credentials,
  `node_modules` and build output. Later preflight documentation is not in this
  already-verified source archive.
- Source archive SHA-256:
  `1a399aa977d9bb7ed337d74eed41ef50fcbe84299b82140898273873e68d06ac`.
  Helper SHA-256:
  `d357a55e0dac9ed7acb164e5e31dfec6280a55782164cf73a2d4ddfaef640c95`.
  This initial archive is superseded by the normalized candidate below. Its
  helper retained mixed line endings, caught by the cloud checksum gate before
  build; passing shell syntax alone did not establish identical source bytes.

### Access recovery and normalized candidate

The first scoped Lightsail CLI read returned `paw-mvp` running. Direct SSH to
its returned address timed out, retaining strict verification against the stored
host key. A subsequent AWS CLI read reported no available credentials. The only
connected browser was Chrome; the Lightsail navigation reached AWS sign-in.
The user then restored AWS login. These were observed access
failures, not an automatic approval rejection or a proved firewall root cause.
Local Docker's Linux engine was unavailable; the build used the existing cloud
host through its authenticated browser SSH terminal. No firewall, credential or
infrastructure configuration was changed.

The initial helper checksum mismatch was traced to 175 CRLF lines in the local
helper. The helper was normalized to LF, and `.gitattributes` now pins `*.sh` to
LF. The 11 existing cloud deployment tests and Bash syntax check passed afterward;
the earlier full 340-test/typecheck/build evidence remains applicable to unchanged
application code. Canonical Skills and their byte-comparison rules were preserved.

The final source is the same exact commit plus only `.gitattributes` and the
rehearsal helper. A new local archive was verified against all 291 tracked files:

| Artifact | SHA-256 |
| --- | --- |
| Normalized source archive | `42a04c91f53fa25237222b87deb3d34d8be4e7df66e54a30ee789888ed00ea33` |
| `.gitattributes` | `94d183966d829b9fa9b822d728e857690ee21f67f2a7fbacc032edf674baffa2` |
| Rehearsal helper | `58a451e78c1838ad87a74f32bebb52888b9add322ba9a7f26ae86b7a3e1fa512` |
| Candidate image `paw:mail-ledger-20260909-r1` | `e85f6f768902ff32ab19b063590312df8ac7146cc5fcb44efa0daaf83fc2c1ee` |

The server cloned the exact published commit into `/opt/paw-mail-ledger-20260909-r1`
and reproduced the two reviewed changes, rather than uploading the archive. Both
override checksums and the exact changed-file list passed before image build.
The final source tuple is identical; the local archive itself was not transferred.

### Actual production-copy evidence — 08:10:56 Australia/Sydney

- Independently inspected production: `paw:mail-layout-20260908-r2`, image
  `d0875f9efdba699b00fab7550e9cc7e5614df710423811ed88cca6fe33a53d8c`, healthy.
  Compose uses the base, web-read and Gmail overlays from that release directory.
  `/srv/paw` is the mounted 7.8 GB persistent disk, with 7.4 GB available. Initial
  available host memory was 451 MiB with approximately 1.8 GiB free swap.
- The existing online backup command produced
  `workspace-20260908T221030Z.db`, integrity `ok`, migrations 001–011. Its configured
  retention removed the oldest backup `workspace-20260907T051525Z.db`; the new
  backup and retained images provide the current rehearsal baseline.
- Actual command, run from the candidate source directory:

  ```bash
  sudo bash deploy/cloud/rehearse-database-copy.sh \
    workspace-20260908T221030Z.db \
    mail-ledger-20260909-r1 mail-layout-20260908-r2 \
    --mail-scan-ledger-upgrade
  ```

- The 012 verifier returned `PASS`: all 27 pre-existing non-migration tables
  preserved, six new empty ledger tables, expected additive schema/migration.
  The upgraded copy contains 34 tables / 244 rows; the one added row records 012.
- Candidate upgrade startup, unchanged candidate restart and previous deployed
  image startup on the upgraded copy all returned healthy and integrity `ok`.
  The latter two starts retained the same 34 tables / 244 rows. Sampled container
  memory was approximately 36.16, 36.16 and 35.5 MiB respectively; these are startup
  observations, not load-capacity acceptance.
- Before/after live database fingerprints matched exactly: 28 tables / 243 rows.
  Production remained on the original healthy image. The rehearsal cleaned up
  its temporary copies/containers and did not fetch Gmail or run a scan.
- Build, backup, rehearsal and live-fingerprint evidence is retained under
  `/srv/paw/deployments/mail-ledger-20260909-r1-*` on the existing host.

### Pre-cutover handoff

This preflight handoff is retained as the record before user confirmation.
The production cutover below completes its deployment gate.

The actual deployment-copy gate is complete. Before production cutover, confirm
both Job Tracker tasks are still paused as required above and obtain disposition
of this concrete candidate. Their switches were not independently fetched here.
Use the existing base + web-read + Gmail overlays and retain secrets/mounts.
Refresh the backup if live data has changed since this rehearsal. Deploy the exact
built candidate, independently verify migration preservation, health/public read
boundaries and refreshed 30-tool contracts, then perform hosted manual and actual
scheduled acceptance separately. Do not replace the database with the old snapshot
after new business writes; preserve the ledger and follow the rollback rule above.

No production migration, cutover, scan, task-policy edit or task activation occurred.
The reported ChatGPT write block and manual/scheduled acceptance remain unresolved.

## Production cutover 2026-09-09

### Continuity and benefits

The approved backend receipt requirements and successful production-copy rehearsal
required this release before any hosted BACKEND-mode acceptance. The user confirmed
both Job Tracker tasks were paused and requested the next step. This package deploys
the existing opt-in ledger and earlier mail-check diagnostics/filtering, retaining
GPT interpretation, existing business authority and the reporting website.
The verified immediate benefit is production migration compatibility and a live
30-tool backend contract; mechanical receipts are now available for an authorized
run. The next gate is refreshed ChatGPT discovery and actual manual/scheduled
execution. Durable, auditable daily accounting is the expected long-term benefit;
no successful daily ingestion or cleared platform refusal is claimed here.

### Release and preservation evidence

- Cutover checks completed at **08:19:11 Australia/Sydney** (September 8 22:19:11
  UTC). Active image is `paw:mail-ledger-20260909-r1`, SHA-256
  `e85f6f768902ff32ab19b063590312df8ac7146cc5fcb44efa0daaf83fc2c1ee`, from the
  exact source tuple recorded above. `/srv/paw/deployments/active-image-tag`
  records the same tag; the previous release remains retained.
- Live data still matched the rehearsal fingerprint before switching. A fresh
  consistent backup, `workspace-20260908T221808Z.db`, passed integrity checking
  with migrations 001–011. Existing retention removed `workspace-20260907T064416Z.db`.
- The first Compose attempt stopped at protected `/etc/paw/paw.env` access before
  changing the container. The authorized deployment resumed with `sudo env
  PAW_IMAGE_TAG=mail-ledger-20260909-r1 docker compose`, using the existing base,
  web-read and Gmail overlays with `up --detach --no-build --wait paw`.
  Permissions, secrets, mounts, ingress and scheduled tasks were not changed.
- The actual pre-cutover-backup/live-database 012 verifier returned `PASS`: all
  27 pre-existing non-migration tables and their rows preserved; six empty ledger
  tables and the expected additive schema added. Counts changed from **28 tables /
  243 rows to 34 tables / 244 rows**, solely the migration-record insertion.
  Later browser authentication may change session data; these are cutover counts.
- The new container is healthy; `/healthz` reports database available.
  `web:check --writes off` passed all five public HTTPS checks: signed-out access,
  route isolation, absent general write route, OAuth start and unsafe return-path
  rejection. This does not disable the previously authorized manual Gmail check.
- Read-only MCP probe against the running server passed: **30 tools**;
  `receiptMode` supports LEGACY/BACKEND and defaults to LEGACY; all seven business
  tools expose optional `scanContext`; backend acknowledgement fields and
  `workspace_close_mail_scan` exist; write annotations remain explicit.
  Both configured Gmail slots returned AVAILABLE without listing or reading mail.
- Independent connector ping and ledger readback succeeded after cutover. The
  historical receipt is still LEGACY/PARTIAL, with zero unfinished runs,
  checkpoints or processing streams. The current conversation's cached discovery
  still has 29 tools; direct server discovery is not proof of ChatGPT refresh.
- Authenticated production Today readback at approximately **08:21 Sydney**
  showed the existing attention items. Both collapsed and expanded mail cards
  retained the historical incomplete daily scan and incomplete application-scoped
  website check, with their original times and coverage limitations. No manual
  email-check control was invoked.
- Existing local evidence remains 41 files / 340 tests, both type checks and build;
  the shell normalization follow-up passed its 11 deployment tests. No application
  code changed during cutover. Host evidence is stored in the existing
  `mail-ledger-20260909-r1-cutover-*`, `-web-check.json` and `-mcp-contract.json`
  files under `/srv/paw/deployments`.

### Next gate and rollback

Keep both tasks paused as confirmed by the user; no task prompt or switch was
changed. Refresh discovery in the actual ChatGPT execution context and verify the
30-tool schema before opting into BACKEND. Existing saved policies still use
LEGACY-compatible commands. The reported hosted write refusal must be investigated
and recorded in that context; never route a refused scan through server-side code.
Then complete the [manual and actual scheduled acceptance](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md)
with independent receipt, source coverage, business and website readback. M4 v0.3
has not started. This release is not a completed mail scan.

If rollback is required, use retained `mail-layout-20260908-r2` with the same three
Compose overlays and the upgraded database. Close any BACKEND runs with the new
code first and keep scans paused. Do not restore a pre-upgrade snapshot after new
business writes. The successful previous-image rehearsal establishes startup/read
compatibility, not old-code enforcement of new backend source obligations.

### Hosted partial execution follow-up ? September 9

At 08:47?08:50 Sydney the user executed the complete BACKEND manual policy in
ChatGPT. Independent MCP, read-only database aggregates and the authenticated
website verified the closed PARTIAL run, nine IRRELEVANT acknowledgements, four
active streams, no receipt coverage/checkpoints and zero business actions. A
mailbox-2/BACKFILL call returned a reported HTTP 504; three body-read flags persisted
without any acknowledgement for that batch. No authorization refusal was reported.
This establishes partial hosted execution and honest reporting, not full manual,
business-write or scheduled acceptance. See the maintained
[diagnosis and limit=1 resumption gate](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md#september-9-partial-run-and-timeout-diagnosis).
The source release and both task settings remain unchanged.

The subsequent 09:03?09:09 Sydney limit=1 attempt persisted twelve further
IRRELEVANT acknowledgements without a reported 504. One unacknowledged HTML body
remains incomplete; an independent read reproduced a 24,000-character response
with bodyComplete=false. The [second-attempt diagnosis](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md#september-9-limit1-resumption-and-incomplete-body)
records the body-retrieval gap and next engineering gate. Neither scan was complete.

## Body extraction repair ? 2026-09-09

### Continuity and benefits

The [second hosted attempt](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md#september-9-limit1-resumption-and-incomplete-body)
left one HTML source incomplete at the raw 24,000-character cap. This package
extracts bounded readable HTML content before applying the existing output limit
and reports concrete incompleteness reasons. It retains GPT classification,
source identity, attachment exclusions and the complete-source-before-ack rule.
The immediate verified benefit is synthetic recovery of long layout-heavy HTML
without certifying genuinely truncated or missing text. The next gates are an
exact-source read-only candidate check, deployment preservation and a hosted
batch reread/classification/ack. Durable diagnosability and fewer redundant retries
support reliable daily coverage; full throughput and scheduled acceptance remain
unverified. No schema migration or scheduler change is part of this package.

### Contract and verification

- `src/gmail/message-body.ts` parses inert HTML with pinned parse5 8.0.1. It never
  renders HTML, executes scripts or fetches links/images. HTML5 parsing behavior
  follows the [parser's documented options](https://parse5.js.org/interfaces/parse5.ParserOptions.html).
- HTML output is TEXT, with paragraph/table boundaries, decoded entities, anchor
  targets, image alt labels and supported Outlook conditional text. Hidden text
  is retained conservatively. Script/style/head contents are excluded; image-only
  and unsupported embedded content remain incomplete. Alt labels are not image OCR.
- MIME alternatives prefer available plain text; separate mixed body parts are
  retained. Named or disposition-marked attachments remain excluded. Missing
  external body parts are diagnosed, not fetched. Declared charsets are decoded
  with a fatal decoder so invalid text is not silently certified.
- `bodyDiagnostics` adds issues, sourceFormat and decoded/extracted/returned
  character counts plus outputLimit. SourceFormat may be TEXT, HTML or MIXED;
  extracted output bodyFormat is TEXT. Counts describe decoded/extracted work,
  not bytes or the full original size after an input/traversal limit.
- Issue codes are BODY_EMPTY, BODY_TOO_LONG, BODY_PART_MISSING, MIME_LIMIT,
  BODY_INPUT_LIMIT, BODY_ENCODING_INVALID, HTML_LIMIT and HTML_UNSUPPORTED_CONTENT.
  Nonempty issues imply bodyComplete=false and processable=false. The batch stores
  the stable reasons in last_error without storing mail bodies.
- Limits remain 24,000 returned characters, with additional 1,000,000-character
  decoded-input budget, bounded encoded-part input, 200 MIME nodes / depth 20,
  and 20,000 visited HTML nodes per part. Genuinely longer usable text is still
  incomplete; this package adds no chunked-reader or attachment authority.
- A standalone successful diagnostic read cannot satisfy the batch obligation.
  The current authorized run must read the source through next_mail_batch before
  acknowledgement. No source is classified or auto-acknowledged by extraction.
- Local LF release checkout passed **42 files / 349 tests**, both type checks and
  build. Focused Gmail/body/batch/ledger verification passed **36 tests**. Coverage
  includes evidence at the end of long layout HTML, links/entities, mixed MIME,
  missing and invalid bodies, traversal caps, and blocked-source ack enforcement.

Candidate runtime source is base commit `79bc3ff2fa35d7a9fd8c3b4149e9614c714f140e`
plus the recorded source patch, SHA-256
`65374d2fab101b251d4125aca3355a778e9daba2ccad7893c6fbd8fd7cde2400`.
The patch includes the two previously release-verified shell/LF overrides and this
package's dependency/reader/batch/MCP files. Full local tests also include the new
body tests and backend source-obligation regression. Candidate image tag is
`mail-body-20260909-r1`; production cutover is not yet claimed in this entry.

### Exact-source candidate evidence

The first candidate r1 extracted the real blocked HTML from 81,642 decoded
characters to 13,767 returned text characters, but conservatively flagged Outlook
revealed opening comment markers as unsupported. Structural-only diagnosis found
no unsupported embedded tags; the incomplete flags came from those boundary
markers. The correction recognizes markers containing no body while retaining
the ordinary sibling content and hidden conditional branches. A synthetic
regression covers both revealed and hidden forms and still rejects unclosed
hidden evidence. The final full suite passed 349 tests after this correction.

Final candidate `mail-body-20260909-r2` has image ID
`sha256:d125ddaaf4b031c58fb097299769ca6e7dc0100d03b9ba460e1c9548928a8dd6`.
Its source is the r1 patch above plus message-body.ts SHA-256
`ee06b324d4a222de8dd9027abd1038312b512bf9b6a534eae2cbfc47875921af`.
The isolated exact-source check used the candidate image, read-only production
mounts and SQLite readonly mode, and the existing Gmail consent. It returned
bodyComplete=true, bodyFormat=TEXT, issues=[], 81,642 decoded characters and
13,767 extracted/returned characters in 1,495 ms; database total_changes was 0.
Only metadata was retained in `mail-body-20260909-r2-source-check.json` under the
private deployment evidence directory. This proves readable content retrieval for
that source, not its semantic classification or processing acknowledgement.

### Production cutover and remaining acceptance

- Cutover completed at **2026-09-09 09:30:35 Australia/Sydney**. Active container
  and `/srv/paw/deployments/active-image-tag` identify `mail-body-20260909-r2`, with
  the exact image ID above. The previous `mail-ledger-20260909-r1` is retained.
- Fresh backup `workspace-20260908T232814Z.db` passed integrity checks with
  migrations 001?012. Existing retention removed `workspace-20260907T065928Z.db`.
  Candidate and previous-image isolated copy startups both passed healthy,
  integrity and unchanged-data checks at **34 tables / 508 rows**, using about
  37.4 / 37.55 MiB respectively. No migration was introduced.
- Actual live precheck and post-cutover fingerprints matched exactly:
  `3445a1016e5d46af2ff520a5e6bff0cb5769f5d53661cf79ddf90d950e40155c`,
  34 tables / 508 rows. This preserves all three historical receipts, 21 source
  acknowledgements, pending items and business rows. Later web login may change
  authentication/session rows; these counts refer to the guarded cutover interval.
- Existing base + web-read + Gmail Compose overlays, mounts, secrets and ingress
  were retained. The container is healthy and all five public web checks passed.
  Neither scheduled task was edited or activated; the user-confirmed pause persists.
- Independent deployed Workspace read_mail_message returned bodyComplete=true,
  TEXT, issues=[], and the same 81,642 / 13,767 source/extracted character counts.
  Independent ledger readback still shows three PARTIAL receipts, no unfinished
  run or checkpoint, and pending counts 44/44/2/1. The blocked-source row remains
  pending until an authorized batch reread and acknowledgement; diagnostics do
  not mutate processing state.
- Private evidence is under `/srv/paw/deployments/mail-body-20260909-r2-*`:
  source-check.json, backup.json, build.log, rehearsal.log, live-before.txt,
  cutover-before.txt, cutover-after.txt and web-check.json. Earlier candidate r1
  was superseded before production. Source and tests remain local working-tree
  changes; no Git commit/push is claimed for this package.

The [complete manual policy](../mvp/UPDATE_JOB_TRACKER_BACKEND_MANUAL_ACCEPTANCE.txt)
now targets the deployed body repair, prioritizes the blocked BACKFILL source and
requires new-run next_mail_batch body diagnostics before classification/ack.
Business sections 2?4 were compared and retained exactly. Full manual coverage,
required business-write scenarios and actual scheduled acceptance remain pending;
this release does not establish a general 504 fix or sufficient daily throughput.
If rollback is needed, use retained mail-ledger-20260909-r1 and the same overlays
with the current database. Preserve receipts and never restore an older snapshot
over new source acknowledgements or business data.

Post-cutover server discovery independently returned 30 tools, the updated
bodyDiagnostics read description and explicit close-tool write metadata. After
restoring the existing Google sign-in, authenticated Today and its expanded mail
card still showed the 09:03?09:09 incomplete run, absent mailbox receipt coverage
and zero business counts. Deployment did not replace the scan result. Final
maintenance checks resolved 382 relative documentation links and git diff --check
passed. The complete manual policy's business sections 2?4 remain unchanged.


## MIME alternative and object recovery - 2026-09-09

### Continuity and benefits

The [daily acceptance](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md) third hosted BACKEND
attempt recovered and acknowledged the original long HTML source, but exposed
resource-free object wrappers falsely marked unsupported and a CSS-heavy plain
alternative hiding substantive HTML text. This increment repairs extraction and
adds representation/image diagnostics. It enables a new authorized batch reread
and classification of the remaining sources; it adds no scheduler, image fetch,
OCR, business classification, acknowledgement or database migration. Immediate
verified benefits are targeted regression coverage and explicit text-versus-image
limits. Long-term value is fewer repeated extraction blockers in daily ingestion;
full seven-day throughput and actual scheduled execution remain unverified.

### Extraction contract and local evidence

- MIME alternatives select the final nonempty supported representation, following
  [RFC 2046 section 5.1.4](https://www.rfc-editor.org/rfc/rfc2046#section-5.1.4).
  Separate mixed body parts remain concatenated. Issues from all inspected parts
  remain conservative, so fallback cannot hide a missing or unsupported body.
- Resource-free HTML object wrappers retain their fallback children. Objects with
  data/type or legacy resource declarations, param elements and other unsupported
  embedded content remain incomplete. This follows the fallback distinction in
  the [HTML object processing model](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#the-object-element);
  no HTML is rendered, executed or fetched.
- bodyDiagnostics adds selectedFormat, imageCount and imagesWithoutAlt for the
  selected representation(s). Counts include tracking images and count parsed
  occurrences, not unique URLs. Images are not read, and blank alt text is not
  proof of decoration. Existing sourceFormat describes inspected MIME types.
- bodyComplete continues to mean bounded text extraction without reported issues,
  not semantic sufficiency or image OCR. The returned note and complete manual
  policy explicitly require withholding ack when classification needs unread
  content, including when only CSS, footer or inadequate link context is returned.
- The LF release checkout passed 42 files / 352 tests, both type checks and build.
  Targeted body, Gmail and ledger checks passed 30 tests. New cases cover CSS-heavy
  plain alternatives, MIME ordering, selected image diagnostics, missing fallback
  bodies, malformed/nested resource-free objects and unsupported resource forms.
  Existing current-run batch reread/ack enforcement remains tested.

Candidate source inherits deployed r2, overriding three LF source files:
message-body.ts dc0c881bd1d05b019e9a27d9fe018ebc60f4d924e93e6a6ff5608dc42ac5dabf;
mcp-reader.ts d84b1685782d6a260ba7a142562e6e5a7af1338e0de531b7c7fcbe3e953e123b;
create-server.ts bfc6b11c96309f6595218b4fb4320d80d891c5ed73e6cc490e7a73399de976c7.
Cloud candidate directory: /opt/paw-mail-body-20260909-r3. No new Git commit or push
is claimed. Deployment and exact-source evidence will be recorded below.


### Exact-source candidate and copy evidence

Candidate r3 returned issues=[] and bodyComplete=true for all three source checks:
resource-free object source 12,931 decoded / 7,414 extracted characters (1,330 ms);
CSS-alternative source 38,401 decoded / 5,635 extracted characters (477 ms), selected
HTML, substantive explanatory text present and CSS absent; original recovered
source 81,642 / 13,767 characters (646 ms). The CSS source contains 15 parsed images,
all without alt text; the original source contains 16 images, eight without alt.
No image pixels were fetched. No bodies were retained in deployment evidence.
Read-only SQLite total_changes was zero. Stored third-run acknowledgements were
six IRRELEVANT (mailbox-1 BACKFILL three, mailbox-2 BACKFILL one and RECENT two),
with zero business actions. Both new target sources remained unacknowledged.

Fresh backup workspace-20260909T000540Z.db passed integrity and migrations 001-012.
Candidate r3 and retained r2 copy startups both passed unchanged-data, health and
integrity checks at 34 tables / 602 rows, approximately 36.75 / 37.2 MiB. Existing
backup retention applied. These results use isolated database copies, not live
startup writes or source acknowledgements. Private metadata evidence is stored
under /srv/paw/deployments/mail-body-20260909-r3-*.


### Production cutover and independent readback

Cutover completed at **2026-09-09 10:07:36 Australia/Sydney** (00:07:36 UTC).
Active container and active-image-tag identify mail-body-20260909-r3, image ID
sha256:37e7aaa52f8a71d7c6cea8b005caf30fbc4c3a9327043a8db1604107aae39136.
Retained r2 is the immediate rollback version. Actual live fingerprints before
and after cutover were identical at 34 tables / 602 rows:
2d428fcc66cd2ab4ef922cb3d03cf343a863487521767dbebb382f4783c74775.
These counts refer to the guarded cutover interval; subsequent Google login can
change session rows. The same base + web-read + Gmail overlays, mounts, secrets
and ingress were retained. No migration, scan, business write or task change was
performed by this release.

Independent production Workspace reads reproduced candidate results for both new
targets: HTML, bodyComplete=true, issues=[], 7,414 / 5,635 returned characters,
with the new selected representation and image diagnostics. The latter now
returns a substantive collection description and links, with 15 unread images
explicitly disclosed. This is text recovery, not OCR or a persisted classification.
Ledger readback retained all four closed PARTIAL receipts, no unfinished run or
checkpoint, null mailbox receipt coverage and pending counts 44/41/0/5. The saved
blocked flag remains until an authorized batch reread; standalone diagnostics do
not update it. Neither target was acknowledged by deployment.

The [complete manual policy](../mvp/UPDATE_JOB_TRACKER_BACKEND_MANUAL_ACCEPTANCE.txt)
now targets r3, retires the original already-acknowledged recovery obligation,
identifies both new source obligations and requires adequate source text before
ack. Business sections 2-4 remain byte-equivalent after newline normalization.
Next gate: actual hosted new-run batch reread/classification/ack and remaining
seven-day coverage, followed by required business-write and scheduled acceptance.
If rollback is needed, use retained r2 with the same overlays/current database;
never restore an old snapshot over newer scan or business records.


Post-cutover server discovery returned 30 tools, the updated text/image read
contract, BACKEND start support and close-tool readOnlyHint=false. All five public
web checks passed with writes off. Authenticated Today at approximately 10:09
Sydney displayed the stored 09:44 incomplete daily scan, distinct from the latest
page-read time. No new scan was substituted for that receipt. Private contract and
public-check evidence are in r3-contract.json and r3-web-check.json alongside the
source, build, backup, rehearsal and cutover fingerprint records.

Expanded website readback also matched the 09:44-09:47 MANUAL/PARTIAL receipt,
both absent successful mailbox coverage values, zero business counts and four
historical receipts. Final maintenance validation resolved 403 relative document
links with no missing files; git diff --check passed. The full manual policy's
business sections 2-4 were rechecked unchanged.


## Body part reading and HTML diagnostics - 2026-09-09

### Continuity and benefits

The fourth hosted BACKEND attempt passed both r3 source-recovery obligations,
but retained a 27,337-character extracted body and an HTML conditional-comment
blocker. The [daily acceptance](../mvp/DAILY_WORKFLOW_ACCEPTANCE.md) requires all
source text before classification/ack. This increment adds bounded, versioned
parts and durable contiguous delivery progress, and pinpoints unsupported HTML.
It enables hosted reread/review/ack of those sources and future long mail without
raising every tool response limit. Immediate benefits are reproducible no-skip,
no-stale-run and restart tests; expected long-term value is fewer repeated mail
format fixes during daily coverage. Image/OCR support, semantic classification,
new business authority and task activation are outside this package. Backend
metadata proves contiguous reads, never that GPT understood or reviewed them.

This remains domain-specific source-obligation bookkeeping in the existing
backend ledger: GPT interprets source facts and invokes authorized operations.
MCP carries optional structured continuation fields; it does not provide PAW's
owned-source read ledger. No replacement scheduler or platform executor is added.

### Body-part contract

- The server remains at 30 tools. workspace_next_mail_batch adds optional
  bodyContinuation={batchId,messageId,bodyVersion,offset}; the same tool, run,
  mailbox, lane and authorization continue one source. No arbitrary new source
  can be read through this parameter. The caller must use the returned object.
- Every read returns at most 24,000 UTF-16 characters, preserving surrogate pairs.
  bodyPage includes version, offset, end, totalCharacters, nextOffset and
  sourceComplete. The SHA-256 version binds the extraction revision, full text
  and extraction issue set. Input and traversal limits remain in force.
- BODY_TOO_LONG describes bounded delivery, while bodyPage.sourceComplete
  distinguishes a fully extracted long source from missing/unsupported content.
  Only a fully extracted long source receives a batch bodyContinuation.
- Migration 013 adds mail_body_read_progress with owned batch/source references,
  run ID, version, total length and contiguous next offset. No body is persisted.
  Partial reads keep mail_scan_batch_items.body_complete=0, preserving existing
  business-write and acknowledgement guards, including when rolling back to r3.
- A continuation cannot skip past saved progress, change source/batch/mailbox/lane,
  reuse another run's reads, or access processed/expired sources. Earlier parts
  can replay without moving the frontier backwards. Changed or failed source
  reads invalidate the pending proof and require an ordinary first-part reread.
- On complete contiguous delivery, the batch response sets bodyReadProgress.complete,
  bodyComplete and processable true and removes only BODY_TOO_LONG from aggregate
  diagnostics. Its text still contains only that response's part. The caller must
  review all parts in that execution before any business write or ack. The backend
  never performs classification or automatic source acknowledgement.
- workspace_read_mail_message adds optional bodyOffset/bodyVersion for read-only
  diagnostics. A standalone tail remains bodyComplete=false and cannot satisfy
  batch proof. A new run or lost caller context requires a first-part reread.

### HTML diagnosis and verification

The real HTML blocker contained ten HTML5-parsed Outlook comment fragments made
solely of closing VML tags. These contain no omitted text and are now recognized
conservatively. Fragments with actual unparsed text still block. htmlDetails
reports up to 32 distinct reason/part/tag groups with occurrence counts; no raw
comment content, attributes or URLs are saved there. Reasons distinguish unparsed
conditional comments, embedded elements, object resources and image-only parts.

The LF release checkout passed 42 files / 357 tests, both type checks and build.
Focused body/Gmail/batch/ledger checks passed 45 tests. Coverage includes three-part
assembly with evidence at the end, Unicode boundaries, restart/replay, standalone
read exclusion, skipped offsets, changed versions, closed/foreign runs, business
write/ack gating, migration preservation and old-loader restart. The backup
assertion was updated to include migration 013. Historical 011-to-012 verification
uses its frozen migration directory; 012-to-013 has a separate additive verifier.
The deployment-copy helper adds --mail-body-read-upgrade to use that verifier.


### Candidate source and exact-source evidence

Candidate mail-body-20260909-r4 inherits r3 in
/opt/paw-mail-body-20260909-r4, with image ID
sha256:18965f614a72eaaf244cfa86500ec067abe8ab62c1596ad04114e50d55323089.
The source remains working-tree changes, with no new Git commit/push claimed.
LF override SHA-256 values:

- src/gmail/message-body.ts: 3005e067519f7861fdab67a6cdaa536ee642c41912fd6775cb80123e7d9eabe9
- src/gmail/mcp-reader.ts: 0412f95c36728e6b19ed0481b77a5cb6d0c34991f31fede1d68a06950f06bb0c
- src/application/mail-batch-service.ts: b7c653452f3e5e9c4d8fcb0f8dbdcbba92b60114fa4de40a7c2bd2183437d739
- src/mcp/create-server.ts: d3731e1235f37fd6ed9dc0c9feec793fbdc4af28e7fcb4b098300c8c30e3b45e
- db/migrations/013_mail_body_read_progress.sql: 8130d5eb371ad1c85eb4b54f39d22d66aa3960c76457460778d8fc7b794c80ac
- scripts/verify-mail-body-read-migration.ts: 9d4724de1b9ccb441391bf370026b60adbb444f544f0f0e5b172e23f78c95776
- deploy/cloud/rehearse-database-copy.sh: 7dcb04a1cd5de1adc32f0627440b834be20e40315cec66224c48f66de2919ef5

Candidate real-source reads passed without production database changes. The long
HTML source has 115,813 decoded / 27,337 extracted characters and was returned as
24,000 plus 3,337 characters with an identical body version and no gaps. Both
standalone responses intentionally have bodyComplete=false; sourceComplete=true
means the text extraction itself is complete. The HTML conditional source has
84,891 decoded / 10,453 returned characters, bodyComplete=true, issues=[] and
htmlDetails=[]. Its 28 images remain unread. The long source has 21 images, one
without alt. Image metadata is not OCR or semantic classification.

The same read-only check verified fourth-run database counts: eleven IRRELEVANT
acknowledgements (mailbox-1 RECENT three/BACKFILL four; mailbox-2 BACKFILL four),
zero business actions and SQLite total_changes=0. Four BACKEND attempts retain
38 stored acknowledgements. Fresh backup workspace-20260909T003753Z.db passed
integrity with migrations 001-012; existing retention applied. Only metadata is
retained in private r4-source-check.json and r4-backup.json under the deployment
evidence directory. The production source obligations were not acknowledged.


### Production migration and cutover

The real database-copy rehearsal passed upgrade, repeated r4 startup and retained
r3 startup against the migrated copy: 35 tables / 697 rows, approximately
37.99 / 37.05 / 37.27 MiB. The additive verifier preserved 33 existing tables
(excluding migration history, which was separately preserved), added only the
empty mail_body_read_progress table and migration 013. The live pre-cutover
fingerprint exactly matched the tested backup; no run was unfinished.

Cutover completed **2026-09-09 10:41:03 Australia/Sydney** (00:41:03 UTC).
The healthy active container and active-image-tag identify mail-body-20260909-r4,
with the candidate image ID above. Retained r3 is the immediate rollback image.
Actual live additive verification passed against the fresh backup. The database
changed only by the new empty table and migration-history row: 34 tables / 696
rows before, 35 tables / 697 rows after. Fingerprints intentionally differ:

- Before: 26344a66914ba999ccff3056969ec9e5603c1087d0b5dc2189ecb2dc0d3a1c67
- After: 31b263a5ebc080de1d6a56a3296698e557662d08b72203986a8c6b9fadd2a77a

Existing receipts, acknowledgements, pending sources and business rows were
preserved. Base + web-read + Gmail overlays, mounts, secrets and ingress were
retained. No scan or source acknowledgement was executed by this deployment;
both scheduled tasks remain paused. Later website login may update session rows;
these counts refer to the guarded cutover interval.

Independent Workspace MCP reads confirmed the long source's first 24,000-character
part with sourceComplete=true and nextOffset=24000, and the repaired HTML source
as 10,453 complete characters with empty issues/htmlDetails. The long first part
correctly remains bodyComplete=false; only a full same-run batch continuation
sequence can satisfy its processing obligation. The saved blocked rows remain
pending until that authorized execution. No general timeout fix is claimed.

The [complete manual policy](../mvp/UPDATE_JOB_TRACKER_BACKEND_MANUAL_ACCEPTANCE.txt)
requires migration 013 and actual bodyContinuation schema discovery, despite the
unchanged 30-tool count. It requires immediate same-run continuation, review of
all parts and complete aggregate read progress before any business write/ack;
old recovered targets are no longer listed as pending. Sections 2-4 are unchanged.
Actual hosted continuation/ack, complete seven-day coverage, required business
scenarios and scheduled acceptance remain pending. Rollback keeps the current
database and uses r3 with the same overlays; never overwrite newer records with
an old snapshot. r3 lacks body continuation but retains the partial-read ack guard.


Post-cutover server discovery confirmed 30 tools with next_mail_batch.bodyContinuation
and read_mail_message.bodyOffset. The running MCP endpoint returned the remaining
3,337 characters using the version from the independent connector's first-part
response; version/end/length checks passed and standalone bodyComplete remained
false. This diagnostic used no batch write or acknowledgement. All five public
web checks passed with writes off. Authenticated Today at 10:44 Sydney retained
the latest 10:13 incomplete scan, separate from page-read time. Overview retained
five closed PARTIAL receipts, no unfinished run/checkpoint and pending 41/37/0/1.
Private evidence includes r4-contract.json, r4-web-check.json, r4-live-migration.json,
source-check, build, backup, rehearsal and pre/post fingerprints under
/srv/paw/deployments/mail-body-20260909-r4-*.

Expanded website readback matched the 10:13-10:19 MANUAL/PARTIAL receipt, absent
successful coverage for both mailboxes, zero business counts and five receipts.
Final validation resolved 406 relative documentation links with no missing files;
git diff --check passed and complete-policy sections 2-4 remained unchanged.

## ChatGPT schema refresh - 2026-09-09

Continuity and benefits: the r4 manual precheck exposed a stale host-side schema
before any new run. This maintenance refreshed the existing ChatGPT development
connection so a new conversation can discover the deployed body-part contract.
The immediate verified benefit is matching saved connection metadata; the next
gate remains actual conversational discovery and manual continuation/ack. Keeping
deployment evidence separate from host metadata supports repeatable future release
handoffs. No scan, mail read, acknowledgement, business mutation, deployment,
permission-setting change or scheduled-task change was performed by this repair.

At 2026-09-09T00:54:34.702Z (10:54 Sydney), direct tools/list from the running
production MCP returned 30 tools with next_mail_batch.bodyContinuation containing
batchId, messageId, bodyVersion and offset, plus read_mail_message.bodyOffset.
Read-only database inspection returned migrations 001 through 013. Docker reported
healthy paw:mail-body-20260909-r4 with the same image SHA recorded above. The fixed
application version 0.1.0 in ping is not a deployment or migration identifier.

The authenticated ChatGPT development connection management page initially showed
neither bodyContinuation nor bodyOffset. The existing Refresh action was executed.
At 2026-09-09T00:56:27.160Z its visible input schemas showed bodyContinuation and
bodyOffset/bodyVersion; the tool count remained 30. This confirms stale saved
connection metadata and its refresh, but does not establish that a previously
started conversation has replaced its callable tools. No new hosted conversation
was submitted during this repair. The user's latest persisted receipt remains the
fourth PARTIAL run according to their read-only precheck report.

The [official metadata refresh procedure](https://developers.openai.com/plugins/deploy/connect-chatgpt#refresh-metadata)
requires refreshing the connection, confirming changed metadata and starting a new
conversation for affected tests. The complete manual policy now includes this
handoff evidence and retains its actual-schema gate and all business rules.

## Fifth hosted BACKEND attempt - 2026-09-09

Continuity and benefits: the refreshed r4 connection enabled the next real manual
attempt. This read-only reconciliation confirms a persisted complete body-part
read and acknowledgement, providing real execution evidence beyond synthetic and
standalone-source checks. The immediate next step is continued bounded processing
of the remaining lanes; the durable benefit is a traceable distinction between
source recovery, scan coverage and scheduled acceptance. No code, deployment,
business state or scheduler setting changed in this reconciliation.

Exact MCP readback of `25fc1cf9-2910-4166-8772-3f889de872f5` confirmed
MANUAL/BACKEND, PARTIAL/CLOSED, 2026-09-09T01:00:46.314Z through
01:06:01.432Z, zero unresolved actions and zero applications/evidence/transitions/
tasks. Both final mailbox coveredThrough fields remain null. The user reported
no tool error, refusal or 504, and no website readback; this is not general timeout
or scheduled acceptance. Processing stopped within the configured time budget.

Read-only database checks independently confirmed:

- Fourteen IRRELEVANT acknowledgements in this run: mailbox-1 nine, mailbox-2 five.
  Counts by the five known BACKEND run IDs are 9 + 12 + 6 + 11 + 14 = 52.
- mailbox-2/BACKFILL `1a0650a8523b0382`: acknowledged in this run, body_complete=1,
  last_error=null, outside_range=0. The user reported empty issues/htmlDetails.
- mailbox-1/BACKFILL `1a064b6db7116134`: acknowledged in this run, body_complete=1,
  last_error=null, outside_range=0 and read progress 25,323/25,323 bound to this run.
  The user reported reviewing both contiguous parts. Database metadata establishes
  completed delivery and ack, not an independent audit of semantic review.
- mailbox-1/RECENT `1a07de24cec8dbf7`: no acknowledgement or body-progress row;
  read_run_id is still the fourth run, body_complete=0, outside_range=0 and the
  previous BODY_TOO_LONG error remains. It was not newly read in the fifth run.
  There are 34 listed unblocked sources ahead under the existing error-last order;
  listing_complete is false, so this is not a guaranteed number of calls to reach it.

The initial diagnostic mistakenly queried receipt_mode on mail_scan_runs, which
does not contain that column. It failed read-only after returning the per-mailbox
ack counts. The corrected diagnostic grouped by the five already verified run IDs
and completed the source/progress checks. It performed no migration or write.

Latest listed pending counts are 35/34/0/1; blocked counts are 1/0/0/0, ordered
mailbox-1 RECENT/BACKFILL then mailbox-2 RECENT/BACKFILL. These are active-batch
counts only. mailbox-2 RECENT reached the run cutoff and its BACKFILL frontier
reached 2026-09-03T23:44:00.233Z (September 4 09:44 Sydney). The current run floor
is 2026-09-02T01:00:46.314Z; mailbox-2's historical excludedBefore remains
2026-09-01T23:44:00.233Z. Older records do not expand the run scope.

The complete manual policy now retires the recovered HTML target, records the
successful long-source case and continues normal queue processing. It retains
limit=1, same-run part review, bounded closure, business authority and paused tasks.
The original long target, full coverage, relevant business cases and actual
scheduled execution remain pending. No further deployment is indicated by this run.


## Sixth hosted BACKEND attempt - 2026-09-09

Continuity and benefits: continued bounded processing now provides a COMPLETE
mailbox receipt. This read-only reconciliation narrows remaining work to mailbox-1
and the original long target while preserving prior recovery evidence. Separating
per-mailbox coverage from whole-task acceptance improves subsequent handoffs.
No scan, source read, business write, deployment or scheduler change was performed.

The sixth run `e089decc-61aa-4436-918d-9d0c0098178f` is independently read back
as MANUAL/BACKEND PARTIAL/CLOSED, 2026-09-09T01:14:22.579Z to 01:19:20.584Z
(11:14-11:19 Sydney), with zero business counts and zero unresolved actions.
Mailbox-2 has a COMPLETE final mailbox receipt through 01:14:22.579Z and completed
BACKFILL with no active batch. Mailbox-1 remains PARTIAL with null final coverage,
31 listed RECENT pending (one blocked) and 30 BACKFILL pending; both listings are
unfinished. These counts do not represent the whole mailbox.

The user and saved run note report ten reviewed IRRELEVANT acknowledgements,
no return of `1a07de24cec8dbf7`, and no 504 or permission refusal. This check did not
query per-source rows or inspect the website. The previously verified other long
source's 25,323/25,323 reading and ack remain valid; the original target remains
unverified. Scope is September 2 through September 9 at 01:14:22.579Z.
Continue the same manual policy, checking both RECENT lanes at each new cutoff
before processing remaining work. Do not repeatedly poll a lane already complete
within the run or restart completed BACKFILL. Both scheduled tasks remain paused.

## Job metadata search - 2026-09-09

### Continuity and benefits

Jun's explicit September 9 instruction replaces exhaustive mailbox reading with
subject keywords, existing application companies and exact linked sender addresses.
The upstream problem was repeated multi-part reading and HTML recovery for unrelated
mail. This package delivers query filtering plus metadata screening before body
acquisition, normal 24-hour windows and recovery capped at 72 hours. The next gate
is one actual hosted JOB_METADATA run, then separately authorized daily activation.
Synthetic evidence verifies skipped body fetches and contact-based follow-up; real
runtime savings remain to be measured. Persisted policy and source metadata support
repeated daily follow-up without a second scheduler or model service. Original
business authority, ownership, deduplication and full-body acknowledgement remain.

### Delivered behavior

- Start with BACKEND and searchMode=JOB_METADATA. The server snapshots companies
  from owned applications (including closed ones), exact senders linked by verified
  relevant acknowledgements, query text and per-mailbox time bounds. Subject
  keywords include job/jobs, interview/interviews, application/applied/applying,
  assessment, offer, recruiter/recruitment and Chinese job terms. They remain in
  every run so new applications can be discovered.
- Gmail performs the subject/sender query first. For returned IDs, the server reads
  Subject/From metadata and checks literal subjects or exact sender addresses.
  Query operators cannot be injected through application company metadata.
  Only matches get a full-body request. Nonmatches are recorded as scope exclusions,
  never IRRELEVANT acknowledgements or proof of full-body review.
- Metadata stores only mailbox-qualified source ID, thread, subject, exact sender,
  timestamp and an optional verified application association; no body is retained.
  The association is learned on successful relevant ack with projectId. Existing
  evidence that retained only sender domains is not falsely treated as an exact
  sender address; company/keyword matches can establish future associations.
- Normal scope starts 24 hours before cutoff. If an earlier stream frontier is
  unfinished, it extends only as far as cutoff minus 72 hours. A new run snapshots
  a fresh query/window and supersedes active older batches as EXPIRED; source,
  acknowledgement and receipt rows remain intact. Previously acknowledged IDs
  are skipped. Unacknowledged matching sources are acquired again within the new
  scope. Excluded older time ranges never become successful coverage.
- RECENT handles each mailbox's complete fixed search window; BACKFILL is a completed
  compatibility lane. Completion derives from both RECENT scopes and action/ack
  checks and is labelled MATCHING_JOB_MAIL_ONLY in the receipt and reporting UI.
  Once a workspace starts this mode, new whole-mailbox runs are rejected.
- Migration 014 adds only job_mail_search_runs, job_mail_metadata and
  job_mail_screening. Historic tables and records are not rewritten by migration.
  Mode activation changes query progress only through an authorized start tool.
- The public contract remains 30 tools. Start adds searchMode; ping exposes
  mailSearchContract job-mail-search-v1, migration 014, normalHours=24,
  maxLookbackHours=72 and metadataFirst=true. Refreshed actual tool discovery remains
  required. Both maintained prompts now use the new mode and preserve business
  sections 2-4; saved scheduler settings have not been changed.

### Verification and limits

The LF verification checkout passed all 363 tests in 43 files, typechecks and
build. Six new tests cover no full-body read for excluded metadata, truthful
filtered completion, exact sender learning after verified evidence/ack, duplicate
avoidance, recovery capped at three days after a five-day interruption, mode
immutability/downgrade rejection, multipart ack guards and additive migration with
repeat/older startup. A final applying-keyword addition passed all six targeted
tests. Historical 012-to-013 migration checks use a frozen v13 source set.

Candidate source is /opt/paw-job-mail-20260909-r1, inherited from r4 with ten
reviewed source overrides. Source hashes and deployment checks are retained under
/srv/paw/deployments/job-mail-20260909-r1-*. A fresh r4 backup
workspace-20260909T015906Z.db passed integrity checks with migrations 001-013.
Deployment and hosted discovery results follow below; no new hosted scan is claimed
by these local tests or the deployment.

### Production release and refreshed discovery

At 2026-09-09T02:05:51Z (12:05:51 Sydney), production switched to
`paw:job-mail-20260909-r1`, image
`sha256:4e090adb692f135dbf92128386f8a35fa64015ddccbac3e5bc765ed54c0a482e`.
The base, web-read and Gmail overlays were retained. Container health is healthy;
the retained r4 image is the immediate rollback version.

The actual production-copy rehearsal passed the 013-to-014 additive verifier,
candidate repeat startup and r4 startup against the upgraded copy. All checks
preserved old records. Before cutover, the live database exactly matched the
tested backup: 35 tables / 1,003 rows, fingerprint
`4e7130744b2c5dce1fcd639256bc65bb37545ac15cebb01287f8632a0f6193ec`.
The live additive verifier then returned PASS: 34 pre-existing non-migration
tables preserved, only three empty search tables and migration 014 added.
After cutover: 38 tables / 1,004 rows, fingerprint
`43a3ab00458c26aab913fa0b28fbe4f2753d384cc03a30b51c7e21e2aaf469f7`.
These are guarded cutover counts, not an enduring database size claim.

Running-server MCP discovery at 02:06:35Z confirmed 30 tools, the start
searchMode constant JOB_METADATA, BACKEND receipt mode and bodyContinuation.
Both direct server ping and the independent connected ping returned
mailSearchContract job-mail-search-v1 / 014_job_mail_search.sql / 24 / 72 /
metadataFirst=true. All five public website release checks passed with writes off.
Private deployment evidence also includes `-live-migration.json`,
`-cutover-before.txt`, `-cutover-after.txt`, `-mcp-contract.json` and
`-web-check.json` under the existing release prefix.

In the signed-in ChatGPT plugin management dialog, cached definitions initially
lacked JOB_METADATA. Refresh completed successfully; the displayed 30 actual
tool definitions now include start.searchMode=JOB_METADATA and bodyContinuation.
No scheduled-task prompt or pause setting was changed. Both maintained local
prompts and current documentation/index now describe the filtered policy.

No production scan was created, source acknowledged or business record changed
by this deployment. Readback before cutover confirmed zero unfinished runs and
latest receipt 0a753277-876f-478f-b560-7aa85aa2dcea still PARTIAL/CLOSED.
The active Codex conversation retains its old static write schemas, so actual
manual execution uses the refreshed ChatGPT connection and complete revised
manual prompt in a new conversation. This remaining host execution gate is not
passed by deployment, tool refresh or synthetic tests. Actual runtime savings
and real sender-follow-up learning remain to be measured there.

### First hosted JOB_METADATA run - 2026-09-09

Read-only MCP inspection of run 0de5b9a4-0cb5-4847-9d49-ee43ef84a9cd
confirms MANUAL/BACKEND/JOB_METADATA, MATCHING_JOB_MAIL_ONLY, PARTIAL/CLOSED,
2026-09-09T02:15:03.355Z to 02:20:25.250Z (12:15-12:20 Sydney;
5 minutes 21.895 seconds). Mailbox-1 searched from 2026-09-06T22:47:05.086Z,
about 51 hours 28 minutes, within the 72-hour recovery cap. Its listing is
complete with 31 pending sources, no backend incomplete-body blockers, and no
final coveredThrough. Mailbox-2 searched exactly 24 hours and is COMPLETE
through the fixed cutoff. Both compatibility BACKFILL lanes are complete.

Both persisted queries contain the same 15 subject keywords and 23 existing
application company names, with no learned exact senders yet. The run stores
metadataChecked=13 and excludedWithoutBody=0. This does not measure mail excluded
by Gmail's query, which was never listed, and does not prove filtering failed.
All four business counts and unresolvedActions are zero; this does not mean
there are no unresolved source classifications.

The user and saved closure reason report 13 distinct fully reviewed text bodies,
11 IRRELEVANT acknowledgements, one complete two-part 43,455-character body,
and two reviewed recruiter replies awaiting application identification. The
remaining 29 sources are reported unread. Per-source acknowledgements and
semantic classifications were not independently re-audited in this readback.
The user reports no 504, write refusal, Gmail change or scheduled-task operation.

This verifies real hosted query-scoped execution and one completed mailbox,
advancing the user-approved metadata-first daily workflow. It does not yet
establish efficiency gains or exact-sender follow-up learning: most reported
reviewed sources were alerts/promotions and no application association was added.
The next gate is resolution of the two application associations and completion
of remaining matching work within the rolling authorized bounds. Read-only
inspection confirms the current relevant-ack contract requires an application;
the separate candidate service does not provide a candidate-only scan receipt.
No candidate/application creation or acknowledgement is implied by this diagnosis.
The user has been asked whether the Senior Agent AI Engineer role was actually
applied to and, if so, its company. This check updated evidence/status documents
only, with no code, production data, deployment or scheduler change.

### Confirmation rule correction after the first filtered run

Jun clarified that he did not apply for the Senior Agent AI Engineer role and
that a submission-confirmation email is required to establish a new application.
The previous request for user clarification was unnecessary: a recruiter reply
or request for a CV alone must not create an application or indefinitely block
tracking as an unidentified application. The maintained manual and future daily
prompts now require explicit confirmation content for new automatic registration.
Fully reviewed pre-application contact without an existing application match uses
the existing IRRELEVANT outcome (outside this tracker, not spam). Existing
applications still accept subsequent follow-up without a fresh confirmation;
only the reviewed message is deduplicated, so later confirmation is discoverable.

The [core rule](CORE_JOB_WORKFLOW.md#application-confirmation-clarified-by-jun--2026-09-09)
records this authority. The two sources are now semantically resolved as
pre-application contact; their database acknowledgements remain pending a valid
current-run read and ack in the refreshed execution context. The closed receipt
is not reopened. No new record type, runtime migration, business record change
or actual scheduler-policy edit was needed or performed. This bounded prompt
correction enables continuation of matching-mail processing and avoids recurring
user questions while preserving confirmation-based application history.

### Second hosted JOB_METADATA run - 2026-09-09

Read-only MCP verification of b22fd010-bf80-4438-a939-9c5bb479ab29 confirms
MANUAL/BACKEND/JOB_METADATA, MATCHING_JOB_MAIL_ONLY and PARTIAL/CLOSED.
The run lasted 2026-09-09T03:52:12.038Z to 03:57:42.897Z (13:52-13:57
Sydney, 5 minutes 30.859 seconds). Mailbox-1's fixed scope began at
2026-09-06T22:47:05.086Z, within the 72-hour recovery cap. Its listing is
complete, with 7 pending sources and zero backend body blockers; final coverage
remains null. Mailbox-2's exact 24-hour matching scope is COMPLETE through the
run cutoff. Both compatibility BACKFILL lanes are complete.

The persisted run stores metadataChecked=24, excludedWithoutBody=0, all four
business counts zero and unresolvedActions=0. Its query snapshot contains the
same 15 keywords and 23 company names, with no exact senders at START. This
snapshot is immutable and does not expose sender associations learned later in
the run. The next run's snapshot is the appropriate observable check for newly
learned exact senders; an empty current snapshot does not prove learning failed.

The user and stored closure reason report 24 fully reviewed acknowledgements:
17 alerts and 6 pre-application recruiter contacts as IRRELEVANT, plus one SEEK
activity source as EXISTING, with matching saved evidence on two applications.
Two multipart bodies reportedly completed at 24,968 and 43,516 characters.
Seven remaining sources are reported unread. This readback verified the stored
receipt and processing counts; it did not independently audit per-source ack
rows, source bodies, evidence links or sender metadata. No 504, write refusal,
Gmail mutation or task operation is reported.

This advances the confirmation-based filtered workflow: listed pending work
fell from 31 to 7, and pre-application contact no longer requires invented
applications. Continue the maintained manual policy in a NEW run, reviewing the
remaining eligible sources and any newly arrived matches in both mailboxes;
retain closed receipts and normal deduplication. After both matching scopes
complete, verify website readback and the next sender snapshot before separately
updating/enabling the daily task. Real scheduled execution remains its own gate.
This check changed documentation only, with no new scan, code, deployment or
scheduler operation; it establishes progress, not complete manual acceptance
or general performance gains.

### Completed filtered manual coverage and website readback - 2026-09-09

Exact MCP readback of 6933e727-e6c8-4f48-9fdd-5913724a7e60 confirms
MANUAL/BACKEND/JOB_METADATA, MATCHING_JOB_MAIL_ONLY, COMPLETE/CLOSED.
The run lasted 2026-09-09T04:02:00.868Z to 04:03:53.680Z (14:02-14:03
Sydney, 1 minute 52.812 seconds). Both mailbox receipts and successful
checkpoints cover through 04:02:00.868Z with this exact runId. Mailbox-1 starts
at 2026-09-06T22:47:05.086Z; mailbox-2 starts at 2026-09-08T04:02:00.868Z.
All streams have no active batch, zero pending sources and zero body blockers.
The overview confirms zero unfinished runs; unresolvedActions and all four
business counts are zero. Historical partial receipts remain retained.

Both query snapshots retain 15 subject keywords and 23 companies. Mailbox-1 now
includes the previously learned exact SEEK notification sender in both its
criteria and from query; mailbox-2 has no exact sender. This verifies persisted
sender reuse in the next search, not that any source in this run matched solely
through that clause. Sender matching remains a discovery aid, not proof of an
application event. The run stores metadataChecked=7 and excludedWithoutBody=0.
The user reports seven full reviews/IRRELEVANT acknowledgements, all job alerts,
and complete multipart review of a 25,137-character body. This check did not
independently reread private bodies or query per-source ack rows.

Using the existing linked Google account, the signed-in Today website was read
and its daily mail panel expanded. It displays both mailboxes complete, manual
execution ending 14:03, the same per-mailbox starts and 14:02 coverage cutoff,
zero business additions and explicit keyword/company/linked-sender-only scope
with normal 24-hour / maximum 72-hour recovery. The page-read timestamp (14:05)
is separate from scan time. The older September 8 incomplete on-demand web check
remains separately displayed and does not overwrite daily scan completion.

This completes the user-approved filtered manual coverage and website readback
gate. The sequence reduced pending work from 31 to 7 to 0 and now demonstrates
saved sender reuse, supporting the intended incremental daily workflow. No new
live application/evidence/transition/task creation scenario occurred in this
final run, and no general throughput or scheduled-execution claim follows.
Next: save the maintained daily policy to the retained task and separately
activate it for 08:00 Australia/Sydney, keeping the obsolete task paused; then
correlate its first real scheduled execution with its durable receipt. M4 v0.3
remains not started pending the recorded operational baseline/gates. This
verification made no scan, code, deployment, Gmail or scheduler changes; website
sign-in used the existing linked account. Actual task pause settings were not
re-fetched or edited.

### Daily task activation - 2026-09-09

After the completed manual/website gate, Jun instructed the assistant to perform
its stated next step: save the revised daily prompt and enable the retained
08:00 Australia/Sydney task, leaving the obsolete task paused. This supersedes
the earlier two-task pause arrangement only for the retained task.

Tool discovery found no callable scheduler management connector in this Codex
context. The existing signed-in ChatGPT Scheduled UI was used. Current official
[scheduled-task guidance](https://learn.chatgpt.com/docs/automations) was consulted
for saving durable web-task prompts and reviewing initial runs; the task-specific
results below come from actual UI inspection, not that documentation.

- Retained task: 6a9f456860248191b81d0361dd42cad3, title Update Job Tracker.
  The actual task-editor URL confirmed its ID. It was paused with the old
  seven-day/LEGACY prompt; schedule controls showed daily 08:00, no end.
- The complete maintained UPDATE_JOB_TRACKER_WORKSPACE_PROMPT.txt was saved,
  then reopened and compared exactly, and compared again after a full page
  reload. All 13,469 characters matched after local LF normalization/trim.
  SHA-256 of that normalized saved text:
  f988bffb0203272d2b4a8dbbca329d3cc6620db86e66cf50a50b1182b094ebf4.
- Restore was clicked only on the retained task. Readback changed to Pause and
  showed next run in about 18 hours; the reloaded editor showed daily 08:00 and
  the time picker had 08:00 selected. Frequency/time/end controls were not
  edited; the recorded Australia/Sydney schedule was preserved. At the check
  time of September 9 approximately 14:14 Sydney, the next planned occurrence
  is September 10 08:00 Sydney (September 9 22:00 UTC). The UI gives a rounded
  countdown, not an independently exposed exact scheduler timestamp/timezone.
- The paused-task filter and original task-editor URL independently confirmed
  original ID 6a96859d64fc81918dda300e7262b74e, title
  Update Job Tracker - old environment disabled (Chinese title in UI), remains
  paused. Its prompt and settings were not changed. There is one enabled Job
  Tracker, not two. Other tasks were not edited.

The saved policy uses SCHEDULED/BACKEND/JOB_METADATA, two mailboxes, normal
24-hour windows and a hard 72-hour recovery cap. New applications require
explicit submission-confirmation evidence; pre-application contacts can finish
outside tracking scope; existing applications use stored metadata for follow-up.
Its business authority, evidence/ack guards and quiet-on-complete-no-change
reporting are retained. Executions must not alter their own schedule.

This activation turns the verified manual workflow into a configured daily
operation using the existing ChatGPT host and Workspace state, with no extra
scanner or local runtime. It enables the first actual scheduled-execution gate;
configuration success is not proof that the first unattended run can use the
current tools and complete all work. Verify its real execution reference, mode,
scopes and persisted result after it runs, then assess daily reliability under
the prospective evaluation. No synthetic or manually launched scan was used as
scheduled evidence. Immediate Workspace readback still shows latest MANUAL
COMPLETE run 6933e727-e6c8-4f48-9fdd-5913724a7e60 and zero unfinished runs.
No application code, production deployment, Gmail data or business records changed.
