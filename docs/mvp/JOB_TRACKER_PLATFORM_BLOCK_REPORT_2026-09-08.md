# Workspace scan blocked after explicit approval

Prepared 2026-09-08 09:26 Australia/Sydney (2026-09-07 23:26 UTC).
Status: report submitted to the signed-in OpenAI Help Center support chat on
2026-09-08 around 09:34 Australia/Sydney and escalation to a human support
specialist confirmed. The support UI says to expect a response in the coming
days, with replies also sent by email. No case/reference number was exposed.

## Continuity and benefits

- Upstream: [daily Job Tracker recovery](JOB_TRACKER_RECOVERY_2026-09-08.md)
  requires a saved scan receipt before Gmail source acquisition.
- Current: isolate the host approval behavior with a fixed, inspectable request
  and an explicitly approved app-specific permission change.
- Downstream: platform diagnosis must precede manual batch and scheduled-run
  acceptance. The replacement daily task remains paused.
- Verified benefit: exact input and actual approval UI are known for this run;
  the failure persists after explicit approval, narrowing the investigation.
- Long-term benefit: preserve a reproducible support record without claiming
  unverified coverage or weakening tool authorization and classifications.

## Environment

- ChatGPT web, Personal AI Workspace developer-mode app.
- App ID and private conversation reference were supplied directly to support
  and are retained in the local submission record.
- Production at the time of the report: `paw:mail-batch-20260908-r2`, migrations
  001–010, 29 tools. See the [release handoff](RELEASE_HANDOFF_2026-09-08.md) for
  the subsequent deployed version; it does not resolve this platform issue.
- Workspace ping, receipt reads and both connected account access checks passed
  during recovery. Historical scan receipts remain readable.
- Global permission: Allow low-risk actions, unchanged.
- App-specific permission: Allow read actions (`ask_before_writes`), explicitly
  approved by the user, updated through Plugin Management and read back twice.
- Conversation refreshed after the setting changed.

## Exact inspected request

Tool: `workspace_start_mail_scan`.

```json
{
  "runId": "e5346d69-6937-4f90-ae21-f50176834297",
  "userConfirmed": true,
  "authorityReference": "Jun: Update Job Tracker Workspace write policy, 2026-09-07",
  "triggerType": "MANUAL",
  "executionReference": ""
}
```

The visible approval-details dialog showed all five fields exactly. The request
contains no email body, mailbox address, token, attachment or arbitrary URL.
The handler creates/replays a receipt; it does not itself read Gmail or schedule
execution. Tool annotations: readOnlyHint=false, destructiveHint=false,
openWorldHint=false, idempotentHint=true.

## Observed sequence and result

1. ChatGPT displayed “允许 ChatGPT 使用 Personal AI Workspace？” for creating a
   persistent RUNNING receipt. The card described control metadata only.
2. Operator inspected the details and selected **允许一次 / Allow once** under
   the user's explicit authorization. No persistent allow-all choice was made.
3. ChatGPT then reported: “此工具调用被 OpenAI 的安全检查屏蔽。请仔细检查你发送的内容。”
4. Independent read-only Workspace call with the same runId returned:

```json
{"error":{"code":"NOT_FOUND","message":"Run not found"}}
```

No source batch, mail read, acknowledgement, application/evidence/lifecycle/task
write, or new scan receipt resulted. No scheduled execution was used as a retry.

## Evidence limits and investigation request

The input and confirmation action were directly inspected in browser UI. The
safety error is preserved from ChatGPT's visible reply, not an independently
downloaded raw platform error envelope. The reply's assertion that no approval
card appeared is contradicted by direct UI observation. No platform trace ID,
classifier reason or per-request server arrival log was exposed or collected.
NOT_FOUND proves non-persistence, not by itself lack of HTTP delivery.

Please investigate why this receipt-only tool call remains blocked after an
explicit Allow once decision, and whether a further safety review, remembered
conversation decision, developer-app restriction or other platform control is
responsible. The permission-mode change successfully produced an approval card
but was not sufficient for execution. Do not assume a specific root cause from
the generic error text.

Reference: [official plugin troubleshooting escalation](https://developers.openai.com/plugins/deploy/troubleshooting).

## Submission and escalation record

The user explicitly authorized the next step of submitting this report. OpenAI
Help Center login reused the existing account selection. The report was sent
through the official support chat, followed by a request for human investigation.
Exact submitted text and follow-up are retained locally outside Git. The
submitted error is explicitly labeled an English translation
of the Chinese message. No credentials or mail contents were submitted.

AI support requested the selected model and an approval screenshot. The follow-up
reported that the affected response's visible retry menu says **5.6 Sol**, while
the backend model snapshot was not exposed. It explicitly disclosed that no
contemporaneous approval-card screenshot exists; approval details were inspected
as visible DOM text. A subsequent error screenshot was saved locally, excluded
from Git, and not uploaded or represented as proof of the approval click.

The support UI then offered **Confirm escalation** and warned that a specialist
may take several days to respond. **Escalate** was selected under the user's
authorization. The resulting UI displayed **Escalation requested** and:

> Escalated to a support specialist; You can expect a response in the coming days.

It also confirmed replies will be sent via email and that comments can be added
to the same support conversation. The confirmation screenshot is retained locally
outside Git. Support conversation remains accessible in the logged-in Help Center
chat history. No numeric case ID or direct thread permalink was displayed.
