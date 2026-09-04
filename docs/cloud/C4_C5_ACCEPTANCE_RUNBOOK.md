# C4/C5 ChatGPT and PC-OFF Acceptance

**Status:** procedure ready; execution blocked on C3 read-only acceptance

This runbook validates the milestone-defining user outcome after the real
database has passed C3. It does not authorize skipping C3, changing Job Search
semantics, or expanding the frozen MCP tool surface.

## Preconditions

- C3 source and cloud read-only results match.
- The real cloud database has a successful consistent backup.
- The original Windows database remains retained and the local Workspace stays
  stopped.
- The connected Personal AI Workspace app resolves the cloud Workspace ID.
- A known synthetic, non-terminal Project may be selected for the controlled
  mutation. Do not use a real application when a synthetic Project is suitable.

## C4 — ChatGPT platform validation

### Read-only connection

In a new ChatGPT conversation, explicitly request Personal AI Workspace and:

1. call `workspace_ping`;
2. call `workspace_list_job_applications` with default active-only behavior;
3. call it again with `includeClosed=true`;
4. call `workspace_get_today`; and
5. use `workspace_get_project` for the same exact Project used in C3.

The Workspace ID, counts, ordering, Today timezone/date, lifecycle version, open
Tasks, and minimized provenance must match C3. Gmail and other connectors must
not be used to reconstruct state.

### Explicit-authority mutation

Choose one bounded mutation on the selected synthetic Project. Prefer creating
one clearly labelled low-priority `OTHER` Task because it does not change the
Project lifecycle. The user must explicitly authorize the write in the same
conversation. Record the returned Task ID and `recordVersion`.

Do not propose or admit a lifecycle transition merely to prove connectivity.
Tool availability is not mutation authority.

Open a separate new conversation and read the exact Project. The created Task
must be present with the same ID, content, status, and version. After persistence
is proven, explicitly authorize marking that Task `DONE`; verify it is absent
from `openTasks`. The terminal Task remains as auditable acceptance evidence.

### C4 pass condition

- Cloud read results match accepted C3 state.
- A write occurs only after explicit user authority.
- A separate conversation sees the durable write.
- No lifecycle, connector, model, scheduler, or tool-contract change occurs.

## C5 — Windows-PC-OFF mobile acceptance

1. Shut down the home Windows PC completely. Sleep or closing the laptop is not
   sufficient.
2. Confirm there is no local Workspace process or local tunnel dependency.
3. On iPhone, open ChatGPT and start a new conversation.
4. Call `workspace_ping`, `workspace_get_today`, and the exact synthetic Project
   used in C4.
5. Explicitly authorize one bounded Task mutation on that synthetic Project.
   Record its Task ID and returned version.
6. Start another new iPhone ChatGPT conversation and read the exact Project.
   Verify the change persists.
7. Explicitly authorize cleanup by moving the test Task to `DONE` if its current
   state permits it. Do not alter a real application lifecycle for cleanup.

### C5 pass condition

```text
Windows PC = powered off
local Workspace/tunnel = absent
ChatGPT on iPhone -> cloud PAW -> real persistent SQLite = read/write success
separate new conversation = same persisted state
```

If any step requires the Windows PC, the test fails. Do not reinterpret a
partially successful connection as milestone acceptance.

## Evidence record

After completion, add one results document containing only:

- Sydney date/time and accepted source commit/image;
- cloud Workspace ID;
- PC power state and mobile device/app context;
- tool names called and success/failure;
- aggregate counts without unnecessary job-search details;
- selected synthetic Project ID;
- controlled Task ID and versions;
- separate-conversation persistence result;
- backup/health status; and
- final `PASS` or `FAIL` for C4 and C5.

Do not record credentials, tunnel identifiers, full private job descriptions,
email addresses, or full provenance payloads in Git.
