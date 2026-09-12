# Daily workflow recovery and acceptance

**Status:** Filtered manual coverage and website readback passed. September 12 exact readback now verifies a persisted SCHEDULED-labelled COMPLETE/CLOSED receipt for both mailboxes with no pending/blocked sources or unresolved actions. Independent platform-trigger correlation and scheduled website acceptance remain pending; see the latest evidence below. Retained daily task configuration was last verified enabled, with the obsolete task paused.
**Last checked:** 2026-09-12, approximately 13:13 Australia/Sydney, read-only Workspace MCP receipt check. Task configuration was not rechecked.

## Continuity and benefits

The [core workflow](../architecture/CORE_JOB_WORKFLOW.md) requires daily GPT
ingestion, durable state and website readback. The [recovery record](JOB_TRACKER_RECOVERY_2026-09-08.md)
documents a reported platform refusal despite explicit approval. This procedure
consolidates the next engineering gate and records a fresh read-only ledger check.
It enables the prospective [v0.3 evaluation](../dogfood/M4_REAL_USE_EVALUATION_v0.3.md)
only after actual execution acceptance. The immediate benefit is a verifiable
definition of recovery; the expected long-term benefit is evidence of reliable
daily use. Following successful manual/website acceptance, Jun authorized saving
and enabling the retained daily task; this configuration result is recorded
separately from the still-pending first real scheduled execution.

## September 12 receipt readback

### Continuity and benefits

The [September 11 handoff](../HISTORY.md#september-11-session-closeout) retains O1
as an independent acceptance track. This read-only follow-up records the existing
receipt and processing state, enabling the remaining platform-trigger and website
correlation without starting another manual scan. The verified immediate benefit
is a concrete run ID, bounded coverage and empty queues; durable operational
confidence still requires independent trigger evidence and sustained use. No
business records, task configuration or runtime code were changed.

Exact `workspace_get_mail_scans` readback for
`91f98d36-d6b9-46f3-8db8-977950e42e48` returned:

- September 12 08:00:24.632–08:02:19.247 Sydney
  (`2026-09-11T22:00:24.632Z`–`2026-09-11T22:02:19.247Z`).
- `triggerType: SCHEDULED`, `receiptMode: BACKEND`, `status: COMPLETE`,
  ledger liveness `CLOSED`, and zero unresolved actions.
- Both mailboxes COMPLETE for their matching-job-mail scope, from September 11
  08:00:24.632 to September 12 08:00:24.632 Sydney; `JOB_METADATA`, 24 hours.
  This is not whole-mailbox coverage.
- Seven metadata checks; zero excluded-without-body in that counter. Both RECENT
  streams reached the cutoff. All four streams have zero pending and blocked
  messages and no active batch. No application, evidence, transition or Task
  additions are recorded in this run.
- `executionReference` is empty. The stored trigger label and timing alone do
  not independently establish which hosted task execution produced the receipt.

Next: correlate this exact run with the retained task's execution output and
check the website's same-run display. This session did not inspect individual
message acknowledgements or hosted task execution, and does not claim the complete
unattended acceptance gate, new-write behavior, or M4 v0.3 start. Documentation
diff/reference checks are sufficient for this record; no runtime tests are needed.

## September 9 evidence and next gate (historical)

End-of-day handoff: production is now
[`resume-20260909-r2`](../architecture/APPLICATION_RESUME_ASSOCIATIONS.md#validation-and-release-evidence),
which retains the verified mail contract and migration 014. Its interactive
Drive association feature did not change the saved daily task or run another
scan. After the next planned September 10 08:00 Sydney execution, read its real
execution reference and Workspace run; verify SCHEDULED/BACKEND/JOB_METADATA,
both fixed matching scopes, pending/blocked sources, business actions and website
readback. A PARTIAL/FAILED result is resumable work, not scheduled acceptance.
No new scheduled result is claimed by this documentation/publication step.

Exact readback confirms run 6933e727-e6c8-4f48-9fdd-5913724a7e60 is
MANUAL/BACKEND/JOB_METADATA COMPLETE/CLOSED. Both matching-mail receipts and
checkpoints cover through 2026-09-09T04:02:00.868Z; all queues and unresolved
actions are empty. The next query successfully reused the learned SEEK sender.
The authenticated website displays the same manual completion, ranges, zero
business additions and explicit filtered scope. The user reports seven reviewed
alert acknowledgements; no new live business creation scenario occurred.
See the [completed manual gate](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#completed-filtered-manual-coverage-and-website-readback---2026-09-09).

The maintained daily policy is now saved and exactly verified on retained task
6a9f456860248191b81d0361dd42cad3, enabled for the preserved daily 08:00
Australia/Sydney schedule. The next planned occurrence is September 10; original
task 6a96859d64fc81918dda300e7262b74e remains paused. See the
[activation record](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#daily-task-activation---2026-09-09).
Verify its first actual scheduled receipt after execution; M4 v0.3 has not started.

### Previous second filtered run

Run b22fd010-bf80-4438-a939-9c5bb479ab29 is independently verified
PARTIAL/CLOSED with 7 listed pending mailbox-1 sources, no backend body blockers,
and mailbox-2 COMPLETE through 03:52:12.038Z. The user and stored reason report
24 full reviews/acks, including 6 pre-application contacts and one existing SEEK
evidence source; business counts remain zero. The empty exact-sender list is the
run's immutable START snapshot, not a readback of contacts learned during it.
Continue the same manual policy in a new run for remaining and new matching work.
See the [second filtered run](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#second-hosted-job_metadata-run---2026-09-09)
for verified fields and evidence limits. Both tasks remain paused.

### First filtered run and subsequent rule correction

Run `0de5b9a4-0cb5-4847-9d49-ee43ef84a9cd` confirms real
MANUAL/BACKEND/JOB_METADATA execution. Mailbox-1's approximately 51.5-hour
recovery window remains incomplete; mailbox-2's 24-hour query scope is complete.
The persisted query uses 15 keywords, 23 company names and no exact senders.
Metadata screening checked 13 sources and excluded zero; Gmail query exclusions
are not included in that counter. The reported reviews comprise 11 irrelevant
acknowledgements and two recruiter replies requiring application clarification;
29 more sources are reported unread. No business changes are stored. See the
[first filtered run](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#first-hosted-job_metadata-run---2026-09-09)
for independently verified fields and reported-only evidence. Exact-sender
learning and runtime savings are not yet established.

Subsequent user clarification resolves the two replies: Jun did not apply.
New automatic application registration requires an explicit submission-confirmation
email. The revised manual/daily prompts classify fully reviewed pre-application
contact outside applied-application tracking, using IRRELEVANT without business
writes. These two acknowledgements remain pending valid current-run reads; they
no longer require an application match or another question to Jun. Existing
application follow-up does not need its original confirmation reread in the
current daily window. See the
[confirmation rule](../architecture/CORE_JOB_WORKFLOW.md#application-confirmation-clarified-by-jun--2026-09-09).

Jun replaced the exhaustive seven-day requirement with keyword/company/exact-sender
search, normally 24 hours and recovery capped at 72 hours. This is the authoritative
next acceptance scope. The implementation passed 363 tests and is deployed;
live additive migration, 30-tool discovery and website checks passed.
Use the revised complete manual policy with searchMode=JOB_METADATA;
verify query-scoped coverage, matching body reads and acknowledged-source deduplication.
Old unrelated HTML/long-source targets are no longer mandatory acceptance targets.
Business invariants and task-pause boundaries remain. See the
[search release](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#job-metadata-search---2026-09-09).

### Previous whole-mailbox run evidence

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

### Fifth-run evidence (historical)

The fifth MANUAL/BACKEND run, `25fc1cf9-2910-4166-8772-3f889de872f5`, ran
11:00:46.314-11:06:01.432 Sydney and is independently read back as PARTIAL/CLOSED,
with zero business counts, zero unresolved actions and null final coverage for
both mailboxes. Read-only database verification found 14 IRRELEVANT acknowledgements
(mailbox-1 nine, mailbox-2 five), bringing five BACKEND runs to 52 acknowledgements.
The HTML target is acknowledged. The other long source has persisted current-run
read progress 25,323/25,323, complete body state and an acknowledgement; the user's
report supplies the two-part review evidence. This passes one real hosted
continuation/ack case, while the original 27,337-character target remains pending.

Current listed pending counts are 35/34/0/1 (mailbox-1 RECENT/BACKFILL,
mailbox-2 RECENT/BACKFILL), with one old blocked mailbox-1 RECENT item. Its read run
is still the fourth run and its old error is BODY_TOO_LONG. Queue ordering places
34 currently listed unblocked sources first and listing is unfinished; absence
from this attempt is not a new failed read. Continue the existing bounded policy
without forcing IDs. Both final mailbox receipts remain uncovered; mailbox-2
RECENT reached 11:00:46 Sydney and its BACKFILL frontier reached September 4 09:44.
The current run floor is September 2 11:00:46.314; mailbox-2's older excludedBefore
is historical and does not expand this authorization. Full seven-day coverage,
the remaining target, business scenarios and scheduled acceptance remain pending.
No website readback was performed for this fifth run. Both tasks remain paused.

### Prior recovery evidence (superseded by the fifth-run status above)

The next hosted attempt stopped before creating a run because its callable schema
lacked bodyContinuation. At 10:54 Sydney, the running production MCP independently
returned 30 tools including that field, and read-only database inspection confirmed
migration 013; the healthy active image remained r4. ChatGPT's development connection
management page also lacked the new fields before Refresh. After the supported UI
refresh, its saved schemas displayed bodyContinuation and bodyOffset/bodyVersion,
with 30 tools, verified at 10:56. The next gate is a new conversation's actual tool
schema precheck and then the existing manual policy. No scan, acknowledgement,
business write, deployment or scheduled-task change occurred during this repair.
See the [refresh evidence](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#chatgpt-schema-refresh---2026-09-09).

The fourth September 9 ChatGPT MANUAL/BACKEND attempt ran 10:13:56.614 to
10:19:57.638 Sydney and closed PARTIAL. MCP readback confirmed the run, zero
business counts, null final mailbox coverage and pending listed counts 41/37/0/1
(mailbox-1 RECENT/BACKFILL, mailbox-2 RECENT/BACKFILL). Read-only database counts
confirmed eleven new IRRELEVANT acknowledgements: mailbox-1 RECENT three and
BACKFILL four, mailbox-2 BACKFILL four. There were zero business actions. Four
BACKEND attempts now retain 38 acknowledgements. The two r3 MIME/object targets
were reported reviewed and acknowledged; both new blocked targets remain pending.

Mailbox-2 RECENT reached the cutoff. Current scope begins September 2
10:13:56.614 Sydney for both mailboxes. Mailbox-1 excludedBefore matches that
floor; mailbox-2 retains its historical September 2 09:44:00.233 exclusion boundary
because its already-processed BACKFILL frontier is later than the new floor.
excludedBefore records past exclusion, not a guarantee that every run uses the
same lower bound. The active query and current run scope still enforce seven days.
Older work is excluded, never counted as processed.

New blockers were a 27,337-character extracted body returned only through 24,000
and ten closing-only Outlook comment fragments reported unsupported. The
[body-part recovery](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#body-part-reading-and-html-diagnostics---2026-09-09)
adds same-run contiguous reads and specific HTML diagnostics. Candidate real-source
reads returned the full long body as 24,000 plus 3,337 characters and the repaired
HTML as 10,453 characters with no issues. Standalone parts intentionally remain
incomplete for acknowledgement purposes. Actual hosted bodyContinuation, full
review and ack remain required after actual bodyContinuation schema discovery.
The production release and additive migration are independently verified.

The user reported no 504 or permission refusal. This does not establish all
business-write scenarios, general timeout resolution or scheduled acceptance.
Both tasks remain paused by user confirmation; no settings were fetched or
modified. This Codex session still exposes old schemas, so it cannot perform the
hosted BACKEND scan or new continuation writes. Development source checks are
read-only and do not acknowledge production sources through another interface.

## Ordered acceptance gates

| Gate | Action and required evidence | Completion condition |
| --- | --- | --- |
| 1. Execution readiness | In the actual ChatGPT execution context, verify current tool discovery, both existing Gmail bindings, current image/contracts, saved policy and documented resolution or authorized investigation of the host refusal | Required calls are available and their declared write effects receive actual authorization; an error is recorded as a blocker |
| 2. Filtered manual scan | Use the complete [BACKEND manual policy](UPDATE_JOB_TRACKER_BACKEND_MANUAL_ACCEPTANCE.txt) with searchMode=JOB_METADATA, both mailboxes, normal 24-hour windows and recovery capped at 72 hours. Verify subject/company/exact-sender filtering before full-body reads | Exact BACKEND readback includes immutable searchPolicy, MATCHING_JOB_MAIL_ONLY scope, both query ranges and truthful settlement. All matching sources and required business writes are verified; excluded mail is not claimed as reviewed |
| 3. Resume / retry | Use legitimate matching work or controlled synthetic evidence to verify stored metadata, exact-sender follow-up, acknowledged-ID deduplication and bounded recovery; retain historical receipts | No duplicated business records or false full-mailbox coverage. Out-of-scope old sources need no forced recovery; an unread matching source remains pending within its authorized window |
| 4. Real scheduled execution | After manual acceptance, use the existing replacement task and saved [daily policy](UPDATE_JOB_TRACKER_WORKSPACE_PROMPT.txt); preserve 08:00 Australia/Sydney and keep the obsolete task paused | An actual scheduler execution reference is correlated to its durable receipt, both mailbox results and independent business readback; a manual run cannot satisfy this gate |
| 5. Website and evaluation start | Independently read the shared stored results and coverage in the website; record actual release/policy baseline and acceptance exclusions in v0.3 | Website matches persisted results and distinguishes refresh from scan time; only then set the new prospective Day 1 |

Task configuration must follow existing task-management authority and acceptance
conditions. This procedure itself does not activate a schedule. If completion
requires bounded resumption, preserve each partial receipt and link the final
verified coverage; elapsed time or a quiet task output is not completion.

For each attempt, retain a private exact run/execution reference and sanitized
public evidence: time/timezone, trigger, image/policy version, both mailbox
ranges, pagination/body/ack status, excluded older work, created versus replayed
record counts, checkpoint readback, website result and precise failure stage.
Zero relevant changes is acceptable only after required source processing is
complete. Manual per-application checks cannot advance global daily coverage.

## Engineering order

1. Resolve the actual ChatGPT authorization/execution blocker and execute gates
   1–4. Existing tests and Codex connectivity do not resolve a host-context failure.
2. Backend-owned receipts are deployed with explicit write metadata. Refresh
   actual ChatGPT discovery before opting into BACKEND and preserve the authorized
   scope of the existing manual policy; do not use legacy finish for a backend run.
   Its platform acceptance remains separate; receipt redesign does not prove recovery.
3. The deployed [manual-check diagnostics/filtering](MAIL_CHECK_DIAGNOSTICS_2026-09-08.md)
   can improve the secondary website check after live-mail
   validation. It is not a prerequisite or substitute for ChatGPT daily acceptance.
4. After acceptance, measure sustained scheduled operation and utility under
   v0.3. Defer unrelated UI expansion and shared infrastructure extraction.

## Attempt ledger

| Time (Sydney) | Check | Result | Next dependency |
| --- | --- | --- | --- |
| 2026-09-08 19:48 | Live service and scan-ledger reads from Codex | Service available; one historical PARTIAL run, no checkpoints or processing streams | Actual ChatGPT host recovery and execution access; manual/scheduled gates remain pending |
| 2026-09-09 approximately 07:57 | Fresh service and scan-ledger reads; backend receipt release preflight | Database available; still one historical PARTIAL receipt, zero unfinished scans, no checkpoints or streams; local 340-test candidate verified | Cloud operator login/connectivity for actual deployment-copy gate; [preflight](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#september-9-release-preflight). No scan or scheduler changes performed |
| 2026-09-09 08:10:56 | Restored AWS login; candidate build and actual production-copy rehearsal | 012 migration, candidate restart and previous-image startup passed; live 28 tables / 243 rows and fingerprint unchanged; production remains 011 | Reviewed cutover after confirming tasks remain paused; then refreshed discovery and hosted manual/scheduled gates. No production scan or task changes |
| 2026-09-09 08:19–08:21 | User-confirmed task pause, authorized cutover, server/MCP and website checks | mail-ledger-20260909-r1 / migration 012 / 30 server tools; all prior rows preserved; Gmail slots AVAILABLE; historical LEGACY/PARTIAL receipt and website limitations retained | Refresh cached ChatGPT discovery, then separately authorize/verify actual manual BACKEND processing and a real scheduled run. No scan, task prompt edit or activation occurred |
| 2026-09-09 approximately 08:40 | User confirmed ChatGPT displays 30 tools; checked current Codex definitions and live scan ledger | Codex still has 29 old definitions; missing BACKEND write/close contracts. Readback still contains one historical LEGACY/PARTIAL run, no checkpoints, streams or unfinished runs; no write attempted | Execute the prepared complete BACKEND manual policy in a new ChatGPT conversation with the updated connection, then independently read the returned runId |

## BACKEND manual policy handoff — September 9

Continuity and benefits: the deployed backend contract and user-confirmed ChatGPT
refresh require an executable manual test that preserves the original authority.
The [complete BACKEND policy](UPDATE_JOB_TRACKER_BACKEND_MANUAL_ACCEPTANCE.txt)
is adapted from the existing complete manual policy. Its matching, source privacy,
evidence and lifecycle/task sections (2–4) were compared and preserved exactly.
Only execution prechecks, source-action attribution, acknowledgements and
receipt/closure reporting were adapted. This enables actual hosted acceptance;
it creates no scan, changes no saved task prompt and activates no schedule.
The immediate verified benefit is a self-contained protocol without legacy finish
instructions; the expected long-term benefit is traceable domain accounting
across interrupted runs. Hosted authorization and semantic correctness still need
real execution evidence. The existing platform ownership decision is unchanged.

The [official connection-testing documentation](https://developers.openai.com/plugins/deploy/connect-chatgpt#refresh-metadata)
instructs developers to refresh changed metadata and run affected tests in a new
conversation. This supports the handoff to the user's updated ChatGPT connection;
it does not establish why this separate Codex session retained old definitions or
prove that a new conversation clears the prior hosted write refusal.

Start a new ChatGPT conversation with Personal AI Workspace enabled and supply
the complete BACKEND policy as the manual instruction. The actual tool schemas,
not the displayed count alone, must pass precheck. Return its exact runId and
outcome for independent Workspace/website readback. A bounded PARTIAL result is
useful progress, but does not complete the manual acceptance gate. If the host
refuses a write, retain that result and stop; do not substitute a server-side run.

## September 9 partial run and timeout diagnosis

Continuity and benefits: the deployed ledger and first hosted partial run require
independent reconciliation before retry. This check verifies persisted progress,
website consistency and the failure boundary, and prepares a smaller bounded
resumption under the same authority. The immediate benefit is confirmed recovery
state without skipped acknowledgements; the next gate is resumed source processing
and complete manual coverage. Reliable interruption recovery remains the long-term
objective. No application code, production release, scheduled policy or task switch
was changed by this diagnostic pass.

The exact user-supplied run ID was queried privately. It started at
2026-09-08T22:47:05.086Z and closed at 22:50:43.679Z, MANUAL/BACKEND/PARTIAL,
liveness CLOSED, unresolved actions 0. Its fixed seven-day scope was September 2
08:47:05.086 through September 9 08:47:05.086 Sydney. Both receipt coverage fields
were null; all four business counts were zero. Independent database aggregates
showed no business actions and nine IRRELEVANT processed rows.

| Mailbox / lane | Listed pending | Listing complete | Independently confirmed ack count |
| --- | --- | --- | --- |
| mailbox-1 / RECENT | 47 | No | 3 |
| mailbox-1 / BACKFILL | 47 | No | 3 |
| mailbox-2 / RECENT | 2 | Yes | 3 |
| mailbox-2 / BACKFILL | 4 | Yes | 0 |

These pending counts cover the active listed batches, not all remaining mail.
All excludedBefore fields were null; this is not evidence that older mail was
processed. The failed mailbox-2/BACKFILL batch retained four pending items: three
had body_complete=1 and no last_error, and one remained unread. Thus the server
completed three body reads, while the caller reported receiving no body response.
No source in that batch was acknowledged. Body flags are not proof of GPT receipt
or classification and cannot substitute for rereading in the new execution.

The reported error was HTTP 504 with detail `MCP request timed out` on
workspace_next_mail_batch(mailbox-2, BACKFILL), not an authorization rejection.
The container was running with restart count 0 and OOMKilled=false, started at
22:19:04 UTC. Container logs for 22:47?22:52 UTC contained no entries. Existing
logs have no per-tool/provider elapsed times, so the exact timeout cause and
whether completion preceded or followed the lost response cannot be established.

Code inspection found serial source reads in src/application/mail-batch-service.ts.
Each Gmail request refreshes a token (provider timeout 10 seconds), then has its
own 20-second fetch timeout in src/gmail/mcp-reader.ts. A listing plus three reads
can accumulate latency across four such requests. This is a plausible request-budget
risk, not a measured root cause of this 504 or evidence of a specific host deadline.

The [complete manual policy](UPDATE_JOB_TRACKER_BACKEND_MANUAL_ACCEPTANCE.txt)
now uses limit=1, tests the interrupted BACKFILL lane first, then resumes ordinary
mailbox/lane rotation. It starts a new run, preserves sections 2?4 exactly, and
stops acquisition after another 504 before honest closure/readback. It is a
mitigation awaiting execution, not a deployed timeout fix. Do not reactivate the
tasks or mark manual/scheduled acceptance complete on this partial evidence.

## September 9 limit=1 resumption and incomplete body

Continuity and benefits: the first attempt's 504 led to a smaller bounded retry.
This independent verification establishes persisted incremental progress and an
honest blocked-source outcome, narrowing the next engineering package to complete
body retrieval and meaningful failure reasons. The immediate benefit is avoiding
false acknowledgements and redundant user retries; reliable daily coverage remains
the downstream objective. No production code, release, saved task policy or task
setting changed during this check.

The exact user-provided second run ID was queried privately. It started at
2026-09-08T23:03:53.915Z and closed at 23:09:09.622Z. The caller reported thirteen
limit=1 reads, twelve complete classifications/acknowledgements, no 504 and no
permission refusal. Reported client times were 2.47 seconds for the first resumed
lane, 2.01?3.64 seconds for the first twelve reads, and 11.81 seconds for the
incomplete-body read. These are caller timings, not independent server telemetry.

Independent database aggregates confirmed three new acknowledgements per
mailbox/lane, twelve IRRELEVANT outcomes and zero business actions. The exact
blocked source had body_complete=0, last_error='Message body is incomplete; source
processing remains pending', and no acknowledgement. A separate read-only MCP
read reproduced bodyComplete=false, bodyFormat=HTML and returned text length
24,000. Only diagnostic metadata was retained; no body was copied into documents.

The reader caps returned content at 24,000 characters and marks longer content
incomplete. It currently counts raw HTML, including markup, rather than extracted
readable content. It also marks missing external body parts or traversal limits
incomplete, but exposes no distinct reason. HTML truncation is therefore a strong
hypothesis; the returned metadata alone cannot exclude a second incompleteness
cause or establish the original total length. Repeating the same capped read is
not a demonstrated recovery method. Existing tests explicitly verify the cap and
false completion flag; no test or implementation changed in this diagnostic pass.

The mailbox-2 RECENT processing frontier advanced to September 8 08:47:05.086
Sydney, while its next active batch still has two pending items. A lane frontier
is not the whole-mailbox receipt coverage. Both BACKFILL excludedBefore values
advanced to September 2 09:03:53.915 Sydney under the rolling seven-day policy;
older work is excluded, not successfully processed. All final mailbox receipt
coveredThrough values remain null.

Next package: add precise incomplete-body diagnostics and a bounded way to obtain
complete usable source content, retaining source provenance, attachment exclusions,
privacy and the complete-source-before-ack invariant. Validate long HTML, missing
parts and genuine truncation with synthetic sources before a reviewed deployment
and exact-source hosted retry. Keep other lane progress resumable and measure
whole-run throughput separately. Do not merely raise the cap, acknowledge the
partial body, repeatedly rerun the old interrupted-lane-first instruction, or
claim full manual/scheduled acceptance from these twelve acknowledgements.

## Body repair release ? September 9 09:30

The [release record](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#body-extraction-repair--2026-09-09)
contains 349 passing local tests, exact-source candidate evidence, copy recovery
and unchanged live cutover checks. Production MCP now reads the former blocked
HTML as complete TEXT: 81,642 decoded characters, 13,767 extracted characters,
issues=[]. No ack, scan, business mutation or task change occurred in this check.
The [manual policy](UPDATE_JOB_TRACKER_BACKEND_MANUAL_ACCEPTANCE.txt) now targets
this repair and requires current-run batch proof before ack. The old PARTIAL
receipts remain immutable. This Codex context still lacks the updated BACKEND
write/close schemas, so hosted resumption remains in the user's updated ChatGPT
connection. Deployment/read-only recovery does not pass full manual acceptance.


## Third September 9 attempt - retained evidence

The third September 9 ChatGPT MANUAL/BACKEND attempt ran 09:44:00.233 to
09:47:20.562 Sydney and closed PARTIAL. Independent MCP readback shows four
closed receipts, no unfinished run or checkpoint, and null final coverage for both
mailboxes. Read-only database evidence confirmed six new IRRELEVANT acknowledgements:
mailbox-1 BACKFILL three, mailbox-2 BACKFILL one and RECENT two; zero business
actions. The original long-HTML source was acknowledged in its current batch.
Earlier unacknowledged rows in expired batches remain historical, not duplicate
current obligations. Across three BACKEND attempts, 27 acknowledgements are stored;
this verifies stored classifications, not an independent semantic audit of all mail.

Mailbox-2 RECENT reached the run cutoff. Pending listed counts are mailbox-1
RECENT/BACKFILL 44/41 and mailbox-2 RECENT/BACKFILL 0/5, with one backend-reported
incomplete-body source. Mailbox-1 RECENT also retains one unacknowledged source
whose returned text was semantically insufficient despite bodyComplete=true; it
is not included in the backend incomplete-body count. Both BACKFILL excludedBefore
values are September 2 09:44:00.233 Sydney. Older work is excluded, not processed.

Exact-source diagnosis reproduced resource-free object wrappers being rejected
and a CSS-heavy plain alternative hiding HTML text. The
[MIME/object recovery](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#mime-alternative-and-object-recovery---2026-09-09)
records the successor correction and verification. The original source-recovery
reread/ack gate is now passed; the two later sources require new-run batch rereads,
full interpretation and acknowledgement. Production r3 reads verified both
new sources as complete text with no issues, without modifying their obligations. Images
remain unread; sufficient text evidence is a separate requirement from text
extraction completeness.

The user reported no 504 or authorization refusal in this attempt. Persisted
start, batches, acknowledgements and closure demonstrate these operations executed;
they do not prove all business-write scenarios or unattended scheduled execution.
The earlier [platform support report](JOB_TRACKER_PLATFORM_BLOCK_REPORT_2026-09-08.md)
remains historical; no support message was sent. Both tasks remain paused by user
confirmation; this session did not fetch or modify task settings. This Codex
conversation still exposes old 29-tool schemas, so hosted BACKEND scan writes
remain in the updated ChatGPT connection. Development diagnostics performed no
scan or acknowledgement through an alternate interface.
