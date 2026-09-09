# Manual mail diagnostics and relevance filtering — September 8

Status: implemented and locally verified on September 8; included in the
[September 9 release](../architecture/MAIL_SCAN_BACKEND_LEDGER.md#production-cutover-2026-09-09)
`mail-ledger-20260909-r1`, migrations 001–012. Both ChatGPT Job Tracker tasks
remain paused. Real-mail accuracy and the historical failure cause remain unverified.

## Continuity and benefits

- Upstream requirement: the [core workflow](../architecture/CORE_JOB_WORKFLOW.md)
  uses one business database for daily GPT ingestion and occasional website
  checks. The [release handoff](RELEASE_HANDOFF_2026-09-08.md) records a real
  partial website check with only a generic failure reason and four saved job
  recommendations. The user's instruction to continue development follows those
  two open items.
- Current package: persist fixed failure categories for future website checks,
  require explicit model classifications, and exclude advertisements from new
  application evidence. This package does not diagnose the historical failure
  retrospectively, reclassify historical resources, change lifecycle/tasks or
  resolve ChatGPT's platform write block.
- Downstream enablement: a release followed by a bounded real website check can
  expose the actual failing stage and evaluate recommendation filtering. Live
  model accuracy and scheduled daily acceptance remain separate pending gates.
- Short-term verified benefits: synthetic tests prove advertisement categories
  cannot become EMAIL evidence even when marked relevant; uncertainty and failures
  retain incomplete coverage; diagnostics survive new service instances without
  retaining raw exception text. All 327 tests pass in the LF verification tree.
- Long-term expected benefits: maintain the reporting website's limited role and
  provide durable reasons for incomplete ingestion, so future corrections can be
  driven by recorded outcomes rather than guesses. This depends on subsequent
  production use and review of real classifications.

## Delivered behavior

Manual-run `result_json` now includes `diagnostics`, each with a mailbox alias,
stage and fixed code. Stages distinguish authorization, Gmail reads, evidence
lookup, model interpretation, evidence saving and final receipt saving. Codes
cover unavailable connections, denied requests, rate limits, invalid provider
responses, pagination caps, missing/overlong plaintext, model refusal/incomplete
output, invalid evidence, uncertain classifications, account changes, legacy
identity uncertainty, persistence failures and timeouts.

Only fixed Chinese messages are added to the existing collapsed check details.
HTTP response bodies, raw exception messages, credentials and message text are
not copied into diagnostics. A missing old diagnostic remains absent: old generic
failures cannot be retroactively identified by this change. If even the failure
receipt cannot be written, the handler logs only a run ID and fixed code; it does
not claim durable diagnostic persistence.

The internal model schema now requires a category for every message:

- Application confirmation/update, interview, offer, rejection and
  application-specific action requests can qualify when relevant and supported
  by an exact source quote.
- Job advertisements and unrelated messages cannot qualify, even if the model
  also returns `relevant=true`.
- Uncertain messages are excluded and prevent that mailbox's coverage advancing.

The prompt explicitly excludes job digests, recommendations and invitations to
apply even when company and role match. Every batch must pass shape, source-ID,
completeness and evidence checks before any item from that batch is saved. This
is a deterministic category gate, not proof that the live model always chooses
the correct category. Responses refusal and incomplete output are handled
separately from JSON parsing, following the
[OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).

Missing or overlong plaintext is skipped rather than interpreted from empty or
truncated input, and remains incomplete. Out-of-range messages returned by the
padded Gmail query cannot make the exact interval incomplete. The existing
120-message, 12,000-character and seven-day limits remain. HTML-only and overlong
messages can therefore still cause repeated partial checks; broader body support
is future work.

Confident evidence already saved remains available after a later failure.
Successful per-mailbox coverage commits atomically with the completion receipt;
failed or uncertain mailboxes retain previous coverage. Public MCP schemas,
NOTE observation contracts, daily full-mailbox checkpoints, lifecycle/task
authority and database migrations are unchanged. The four historical job-ad
resources remain untouched and still use the existing deduplication behavior.

## Verification and development portability

Verified September 8 on Windows / Node 24 against repository base `3fd9932` plus
this package:

- `npm.cmd run typecheck`: server and browser type checks passed.
- `npm.cmd test -- --maxWorkers=2`: **40 files / 327 tests passed**.
- `npm.cmd run build`: production build passed.

The complete pipeline ran in an independent Git worktree with LF source bytes
and the exact changed files copied in. The initial existing checkout had CRLF
Skills files, failing their byte-for-byte canonical packaging checks; the default
parallel run also reported a worker exit. The successful full run used two
workers. `.gitattributes` now preserves LF for future Skills checkouts, and one
existing packaging test uses `dirname`/`join` instead of slash-specific path
replacement. No Skills instructions or canonical contents changed. The original
protected Skills files were not rewritten; an already-populated CRLF checkout
needs a fresh checkout before those byte checks can pass there.

Regression coverage includes mixed ads/confirmations, uncertain classifications,
malformed batches, missing/truncated bodies, provider failures, safe persisted
diagnostics, previous successful coverage, legacy identity rejection, atomic
receipt failure and unchanged application/task/daily-checkpoint behavior.

No live Gmail or model calls, cloud deployment, database edits, historical
resource cleanup, or online task changes were performed for this package.

## Next acceptance gate

Deploy the reviewed code, then perform a bounded website check and inspect its
durable receipt, saved evidence and per-account coverage. Review representative
real recommendations and applicant-specific responses before claiming improved
model accuracy. Separately await the platform-block resolution before updating
and accepting the paused daily GPT task.
