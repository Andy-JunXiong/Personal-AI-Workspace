# Existing Update Job Tracker task: verified configuration and handoff

## Subsequent acceptance and current scope

User refreshed the plugin to 27 tools and verified both Gmail accounts through Workspace. A one-off scheduled ping succeeded. The user then supplied MANUAL receipt `d483b9a3-e355-4367-8436-15b3943fd8a6`: PARTIAL for both mailboxes, saved/read back, zero new business writes and successful existing-evidence deduplication. Full coverage remains unverified. Jun subsequently limited lookback to seven days, normally yesterday/today. [Bounded resumption](MAIL_SCAN_RESUME_2026-09-07.md) is locally verified (269 tests, migration 010, 29 tools) but not deployed; current cloud release remains `gmail-mcp-20260907204200` with 27 tools. Historical configuration and release-time observations below are retained as evidence.

## Subsequent real integration test

The user reports saving the replacement prompt and requested a test. On
2026-09-07 at approximately 17:42 Australia/Sydney, this conversation manually
tested the same Gmail and Workspace connectors; it did not trigger the external
scheduled task. Both mailbox searches succeeded. A bounded Synogize search
returned no matches in mailbox-2 and a paginated result in mailbox-1; this is
not a complete two-inbox scan or a new scheduled coverage checkpoint.

Read the full two Employment Hero messages confirming receipt and In progress.
Created real application 71a54b6c-84b1-4a0c-a88d-fe03b0342a56 after verifying
the complete 23-application inventory contained no Synogize match. Saved two
canonical EMAIL resources and read them back. Application date is 2026-09-04;
receipt timestamp is explicitly described as confirmation time, not an
independently known submission instant. In progress remains evidence; lifecycle
is APPLIED and no action task is warranted by these emails.

The registration URL sanitizer removed the Gmail fragment, so the resulting
generic mail homepage was cleared from postingReference. Exact source links
are preserved on both EMAIL resources. Future runs should leave unknown job
posting references empty and retain Gmail source links on evidence resources.
The website view and unattended scheduled execution remain unverified.

## Continuity and benefits

Upstream: the user supplied the actual scheduled task instructions after the
repository's daily recommendation references were mistakenly treated as the
only existing automation. This task scans two Gmail accounts for application
updates, not merely recommendations. It already has NORMAL WRITE MODE, but
permits writes only to the Applications Google Sheet and explicitly prohibits
Personal AI Workspace writes.

Current package: a [replacement task prompt](UPDATE_JOB_TRACKER_WORKSPACE_PROMPT.txt)
uses the existing schedule and Gmail scan, targeting Workspace. It includes
registration, minimized evidence, supported lifecycle admission, explicit action
tasks, source-aware deduplication and readback. The old Sheet becomes read-only
reconciliation input. This is a prompt handoff, not a deployed scheduler change.

Downstream: save the replacement in the existing web task and perform one real
run, then inspect persisted projects/tasks and website readback. The current
session has no scheduled-task read/edit/run tool. No live task change or real
data write was performed as part of this handoff.

Immediate verified benefit: the instructions now reflect actual exposed MCP
schemas and src/domain/job-application-lifecycle.ts, including OTHER versus
RECRUITER_CONTACT emailKind and unsupported transition handling. Expected
long-term benefit: the existing daily scan maintains the same durable records
the website displays, without implementing a duplicate daily scanner.

## User-supplied evidence and precedence

- Task name: Update Job Tracker.
- Latest prompt begins NORMAL WRITE MODE, approved after Trial run 3/3.
- Reads both Gmail accounts; filters genuine application events and excludes
  alerts/recommendations/marketing.
- Existing destination: Google Sheet
  15zXLUOR8FW5xbDF9YZfM-Lj7ZK6pWNqC5Yx7jis5NEs, Applications tab.
- Existing schema: Company | Role | Job / Source Link | Applied Time (Sydney) |
  Status | Status Updated (Sydney) | Channel | Notes.
- Existing statuses: Applied, Pending, Application Viewed, Action Required,
  Recruiter Contact, Recruiter Submitted, Interview, Rejected, Withdrawn, Offer.
- Exact original authority boundary: "Writes are permitted only to the target
  Job List Sheet under these rules. Do not modify Gmail, Personal AI Workspace,
  or any other external data. If nothing changed, do not notify me."
- Schedule screenshot: daily, 08:00, never end. Timezone is not visible; verify
  Australia/Sydney before relying on the displayed hour. Do not replace this
  task's time with the separate 09:00 recommendation digest preference.
- Previous result screenshot: Trial run 3/3 was read-only, identified Synogize
  AI Consultant, and explicitly made no external writes. It is older evidence
  than the supplied NORMAL WRITE MODE prompt, not proof of current read-only mode.
- No real Workspace-writing scheduled run is verified yet.

## Validation and limitations

Read exposed create/find/update application, observation, proposal/admission and
task schemas, plus the lifecycle source. Prompt-only change; no runtime tests
were needed or claimed. Direct website Gmail checks use Google-subject-hashed
message IDs, while ChatGPT may only expose mailbox aliases; cross-path evidence
deduplication needs real-run verification and must not be claimed automatic.
The website's two OAuth connections do not prove that this scheduled ChatGPT
task can access both mailboxes or its Workspace plugin at execution time.

Before future development, reconcile the latest user instructions, task/runtime
configuration, repository status and historical documents. Record conflicts
and distinguish configured, executed and persisted outcomes before proposing
new automation. Read the relevant original records rather than relying only
on the latest module or a conversation summary.
