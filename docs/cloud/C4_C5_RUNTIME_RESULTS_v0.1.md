# C4/C5 cloud acceptance runtime results

**Date:** 2026-09-05 (Australia/Sydney)

**C4:** PASS

**C5:** PASS — USER-CONFIRMED PC-OFF MOBILE TEST; CLOUD TASK READBACK VERIFIED

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

C4 final aggregate state: 23 applications (11 active), 23 Resources, 36 admitted
transitions, 13 evidence links, 2 Tasks (1 original open + 1 completed acceptance
Task), and 74 idempotency records. Today remains 1 attention, 0 upcoming, and 10
applications without an open Task. The scripted test is excluded from M4
real-use capture and actionability metrics.

The exact Workspace/Project/Task IDs and independent-conversation references are
retained in the user-visible acceptance chats and private operational evidence.
`/srv/paw/deployments/c3-c4-acceptance.json` records the test Task ID and version.
Private application details and provenance are omitted from Git.

## C5 executed evidence

On 2026-09-05, the user explicitly confirmed that Windows was completely powered
off during the test and that creation and readback occurred in two independent
iPhone ChatGPT conversations. This is user-attested device and conversation
evidence; it is not inferred from the later desktop verification or cloud health.

The user supplied the mobile completion report: the C5 test Task was read at
`TODO / LOW / recordVersion 1 / no due date`, completed at record version 2,
and then absent from the Project's `openTasks`.

The subsequent independent verification used the current connected
`workspace_get_project` and an authenticated AWS browser SSH session. SQLite
connections to both the live cloud database and retained C3 source used
`mode=ro`. The query selected the exact test Task by Task ID and Project ID,
including terminal Tasks, and returned:

| Check | Verified result |
| --- | --- |
| Task kind / priority / due date | `OTHER / LOW / null` |
| Created at | `2026-09-05T06:24:34.052Z` (16:24:34.052 Sydney) |
| Current status / record version | `DONE / 2` |
| Completed at | `2026-09-05T06:26:08.268Z` (16:26:08.268 Sydney) |
| Project status / lifecycle / lifecycle version | `ACTIVE / INTERVIEWING / 2` |
| Original interview-preparation Task | `TODO / HIGH / recordVersion 1` |
| Original Task compared with retained C3 source | Entire row equal |
| Project open Tasks | Only the original Task; C5 test Task absent |

The database completion timestamp exactly matches the supplied mobile report.
The successful cloud readback plus the user's explicit PC-OFF and independent
mobile-conversation confirmation satisfy the C5 pass condition. The later
verification made no business-data writes and did not restart the local Workspace.

The C4 aggregate counts above describe the earlier C4 checkpoint, not a new C5
inventory audit. C5-specific ping/Today payloads and a new backup/health run were
not independently captured in this follow-up; the last verified backup/health
results remain those recorded under C4. Workspace, Project and Task IDs remain in the
user-visible acceptance conversation and private operational evidence. The
accepted deployment baseline remains the C4 baseline; this verification did not
deploy an image or change the application contract.

M4 Day 2 still requires actual job-search use and the user's action/friction
observations. Deployment acceptance alone does not complete that daily trial.
