# Workspace Gmail read tools

## Subsequent acceptance and current scope

User refreshed the plugin to 27 tools and verified both Gmail accounts through Workspace. A one-off scheduled ping succeeded. The user then supplied MANUAL receipt `d483b9a3-e355-4367-8436-15b3943fd8a6`: PARTIAL for both mailboxes, saved/read back, zero new business writes and successful existing-evidence deduplication. Full coverage remains unverified. Jun subsequently limited lookback to seven days, normally yesterday/today. [Bounded resumption](MAIL_SCAN_RESUME_2026-09-07.md) is locally verified (269 tests, migration 010, 29 tools) but not deployed; current cloud release remains `gmail-mcp-20260907204200` with 27 tools. Historical configuration and release-time observations below are retained as evidence.

Status: deployed as `gmail-mcp-20260907204200`; cloud live read-only MCP checks passed. Full manual/scheduled scan and receipt acceptance remain pending.

## Continuity and benefits

- Upstream: [core workflow](../architecture/CORE_JOB_WORKFLOW.md). User-supplied
  scheduled ping succeeded at 20:15:34 Australia/Sydney. Built-in Gmail was
  forbidden in the same developer-MCP conversation, even with both apps selected.
- Current package: add three read-only Gmail tools to the existing Workspace MCP,
  reusing encrypted website OAuth slots. No new scheduler, model calls, automatic
  database writes, website controls or schema migrations.
- Downstream: deploy; refresh the plugin to 27 tools; verify live account mapping,
  bounded list/read, manual scan/write/readback, then actual scheduled scan receipts.
  Existing daily task context still needs verification; a successful one-off ping
  does not establish that the older recurring task has the same tool access.
- Short-term: local transport and reader tests verify pagination, owner isolation,
  error redaction, incomplete-body flags and no database writes from reader calls.
- Long-term: GPT retains responsibility for classification while mail access and
  durable state use the same MCP connection, avoiding the observed connector mix.

## Tool contract

- workspace_get_mail_accounts: verify both live Gmail profiles against saved
  connection emails. Returns slot alias, availability, email for mapping checks.
  No credentials. Failures are per-mailbox, not a successful empty result.
- workspace_list_mail_messages: mailbox, searchedFrom, coveredThrough, optional
  pageToken. Increasing past interval at most 31 days. GET, 50 IDs per page,
  includes spam/trash. Continue until nextPageToken=null. Second-expanded search
  bounds require exact receivedAt filtering after read. No relevance filter means
  genuinely new applications can be discovered. No page cap silently drops mail.
- workspace_read_mail_message: mailbox and hex messageId. Returns source timestamp,
  account-qualified externalId, exact source URL, subject, sender domain, up to
  24,000 body characters. Plain text preferred, otherwise untrusted HTML. Does not
  download attachments. Empty, missing external body data, recursion limits or
  truncated bodies yield bodyComplete=false. Raw bodies are transient tool output,
  not persisted records; the prompt retains minimized evidence writes only.

Connections remain keyed by workspaceId + principalId and slot. No account ID,
credential, URL or Gmail query operators can be supplied to redirect access.
Google requests use users/me, GET and redirect rejection; OAuth refresh uses the
existing provider. Server initializes the reader alongside the existing Gmail web
runtime. Until ready (or when disabled), tools fail closed. This currently retains
the existing web Gmail configuration requirements, including its model credential;
the new read path itself never invokes the model or spends model API tokens.

## Validation

`npm.cmd run verify`: 32 files / 259 tests, typecheck and build passed.
New tests exercise actual MCP transport list/read/accounts calls using mocked
Google responses, live-profile mismatch, foreign workspace/principal, two-page
continuation, invalid intervals, source provenance, HTML fallback, truncation,
attachment exclusion, path rejection, upstream secret errors and zero DB writes.
Existing web checks and the scan ledger tests pass unchanged in behavior.

Google contracts consulted:
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/Format

## Activation and remaining acceptance

1. Deploy the locally verified source with existing cloud OAuth configuration.
   No new scopes or mailbox consent are planned, but actual principal/slot reuse
   must be checked using workspace_get_mail_accounts after deployment.
2. Refresh plugin discovery and verify all 27 tools in a fresh conversation.
3. Verify account mapping, a bounded read of both mailboxes, and source fidelity.
4. Activate the updated [complete prompt](UPDATE_JOB_TRACKER_WORKSPACE_PROMPT.txt)
   only after these tools are deployed and available. Preserve existing authorized
   write/filter/deduplication rules and daily time; no duplicate recurring job.
5. Verify one MANUAL full run and then a SCHEDULED run with durable receipt readback
   and website display. Only then claim full unattended workflow acceptance.

The user subsequently authorized deployment. The release and read-only live probes below were performed; no scheduled task edits or business-data writes were performed. Pre-existing uncommitted work is preserved; no commit/push was performed.


## Cloud deployment and live evidence

User authorized release after local verification. Active image:
`paw:gmail-mcp-20260907204200`, config digest
`sha256:cffe0797364f7844d439bc535f33ac4c090ee2d322e8dfd6dbe15cca676637f7`.
Rollback image retained: `paw:scan-receipts-20260907192417`.
Database backup: `workspace-20260907T103334Z.db`, integrity ok, migrations 001-009.
First attempt stopped on CRLF before executing remote commands; no service switch.
Corrected remote script normalization and retried successfully. Temporary SSH
firewall access restored and temporary SSH credentials removed after both attempts.

Live checks used the actual running HTTP MCP endpoint inside the deployed container,
not only in-memory tool registration. Both live profiles matched the fixed mailbox
mapping and the configured Workspace identity. The probe covered a bounded last-day
list (one page each) and one sample read per mailbox, without persisting mail bodies:

| Mailbox | Live profile | IDs on tested page | More pages | Sample body |
| --- | --- | --- | --- | --- |
| mailbox-1 | Correct account, available | 50 | Yes | TEXT, complete |
| mailbox-2 | Correct account, available | 3 | No | HTML, complete |

This is a read-only probe, not a full scan: no checkpoint advanced and no scan
receipt was created. Receipt count remained 0. All 19 pre-existing business tables
had identical before/after hashes; all 24 applications were preserved. DB integrity,
read-only web rendering, default application ordering and 27-tool discovery passed.
General web writes remain disabled. Public signed-out session boundary returned 401.

Deployment evidence directory on the operator PC:
`C:/Users/user/AppData/Local/Temp/paw-gmail-mcp-release-1b6040175ba54e5ea9043cc660717d48`.
Remaining user-side gate: refresh discovery to 27 tools, activate MCP-only prompt
in a task context that can access them, then verify manual and scheduled full runs.
