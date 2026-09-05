# C4/C5 cloud acceptance runtime results

**Date:** 2026-09-05 (Australia/Sydney)

**C4:** PASS

**C5:** PENDING — USER MUST POWER OFF WINDOWS AND TEST FROM IPHONE

## C4 scope and authority

C3 had already preserved the real Workspace and passed the complete source/cloud
comparison and independent new ChatGPT conversation before any acceptance write.
The operations checkout was `c27d39e`; the application remained on the accepted
image `paw:4ab6daed2158`.

All existing applications were real. The user explicitly chose adding one
clearly labelled, low-priority acceptance Task to an existing application, then
marking it complete after verification. This overrides the runbook's default
synthetic-Project preference for this run. No application or lifecycle transition
was added, and the original interview-preparation Task was preserved.

## Executed evidence

1. The current connected app created one `OTHER`, `LOW`, undated acceptance Task
   with explicit-user authority and a stable idempotency key. It returned TODO,
   record version 1, and `replayed=false` at 16:14:54 Sydney time.
2. A separate new ChatGPT Work conversation called `workspace_ping` and
   `workspace_get_project`. It independently returned the same Workspace, the
   unchanged INTERVIEWING Project at lifecycle version 2, the exact acceptance
   Task at TODO/version 1, and the original HIGH Task at TODO/version 1. The new
   prompt supplied the Project ID but did not supply the new Task's ID or content.
3. With the user's prior cleanup authority, the current connected app marked
   only the acceptance Task DONE using expected record version 1. It returned
   version 2 and a completion timestamp at 16:16:54 Sydney time.
4. The complete `workspace_get_project` and `workspace_get_today` results after
   cleanup exactly matched their pre-test C3 values. The completed acceptance
   Task is absent from `openTasks`; the original open Task is unchanged.
5. Direct read-only SQLite comparison preserved every original source row.
   The only additions were the completed acceptance Task and the two expected
   idempotency records. Integrity remained `ok`.
6. A fresh run of the installed backup service succeeded with
   `Result=success` / `ExecMainStatus=0`; PAW health and tunnel liveness/readiness
   all passed.

Final aggregate state: 23 applications (11 active), 23 Resources, 36 admitted
transitions, 13 evidence links, 2 Tasks (1 original open + 1 completed acceptance
Task), and 74 idempotency records. Today remains 1 attention, 0 upcoming, and 10
applications without an open Task. The scripted test is excluded from M4
real-use capture and actionability metrics.

The exact Workspace/Project/Task IDs and independent-conversation references are
retained in the user-visible acceptance chats and private operational evidence.
`/srv/paw/deployments/c3-c4-acceptance.json` records the test Task ID and version.
Private application details and provenance are omitted from Git.

## C5 handoff

Windows was on during C3/C4. No PC-OFF result is inferred from cloud health,
container restart, or a desktop-browser test. The remaining procedure is:

1. Fully shut down Windows and keep it off throughout both mobile conversations.
2. On iPhone, open a new ChatGPT conversation with Personal AI Workspace enabled.
3. Read ping, Today, and the exact C4 Project. Confirm the original Workspace,
   original open Task, and completed C4 Task's absence from `openTasks`.
4. Explicitly authorize one clearly labelled C5 `OTHER`, `LOW`, undated test
   Task on that same Project; retain the returned Task ID and version.
5. Open another new iPhone conversation, read the same Project, verify the
   Task ID/content/status/version, then explicitly authorize completing only
   that C5 test Task with its current record version. Verify it is absent from
   `openTasks` and the original Task remains unchanged.
6. Report PC power state, iPhone context, Task ID/versions, and tool results so
   the C5 evidence can be finalized. Do not restart the old Windows Workspace.

M4 Day 2 still requires actual job-search use and the user's action/friction
observations. Deployment acceptance alone does not complete that daily trial.
