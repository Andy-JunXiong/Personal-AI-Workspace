# ChatGPT Platform Gate v0.1 — Spike 1A

**Execution status:** `EXECUTED`

**Overall result (select exactly one only after manual execution):**

- [x] `SUPPORTED`
- [ ] `SUPPORTED_WITH_CONSTRAINT`
- [ ] `NOT_SUPPORTED`

This manual ChatGPT evaluation was completed by the operator on 2026-09-02.
All P1–P8 gates were reported `SUPPORTED`. Automated/local evidence and manual
ChatGPT platform evidence are recorded separately below.

## Completed evidence summary

### Automated/local evidence

- `npm run verify` covers the deterministic domain, persistence, transport,
  concurrency, exact command-key replay/conflict semantics, and uniqueness.
- Local `/healthz` and Streamable HTTP `/mcp` verification proves the local
  server and protocol surface.
- This evidence does not substitute for ChatGPT platform validation.

### Manual ChatGPT platform evidence

- ChatGPT Developer Mode and the Custom App flow were available.
- Secure MCP Tunnel connected the private local Spike 1A server to ChatGPT.
- ChatGPT discovered and called the Workspace tools.
- Two separate conversations read the same durable Project.
- Observation and proposal calls did not mutate lifecycle state.
- Explicit user authority admitted `APPLIED -> RECRUITER_CONTACT`.
- A repeated admission produced no duplicate transition or Task.

Secure MCP Tunnel is therefore validated development infrastructure for this
Spike. No runtime API key, control-plane credential, Tunnel secret, or other
secret is recorded in this document or repository.

## Scope and decision rule

This gate covers only the frozen Spike 1A implementation: Workspace MCP,
SQLite persistence, observation, proposal, explicit-user admission,
cross-conversation reads, and idempotent retry behavior.

It does not evaluate or authorize Spike 1B, connected apps, Gmail/Drive,
external connectors, UI, an LLM API, schedulers, event buses, or background
automation.

Use the result labels as follows:

- `SUPPORTED`: the expected tool behavior and database state were observed and
  all required evidence was captured.
- `SUPPORTED_WITH_CONSTRAINT`: the behavior worked only with a documented
  ChatGPT plan/workspace, permission, tunnel, confirmation, or client
  constraint.
- `NOT_SUPPORTED`: the behavior was unavailable or differed from the expected
  result in a way that prevents the Spike 1A proof.

Do not assign a supported result based only on local tests.

## Fixed test values

| Name | Value |
| --- | --- |
| Project ID | `10000000-0000-4000-8000-000000000001` |
| Initial state | `APPLIED`, lifecycle version `1` |
| P5 idempotency key | `platform-gate-p5-observation-v1` |
| P5 provider/external ID | `platform-gate` / `platform-gate-message-001` |
| P6 idempotency key | `platform-gate-p6-proposal-v1` |
| P7 idempotency key | `platform-gate-p7-admission-v1` |
| Admission authority reference | `User explicitly authorized admission in Platform Gate P7.` |

`<P5_RESOURCE_ID>` and `<P6_TRANSITION_ID>` below are placeholders. Replace
them with the exact IDs returned by P5 and P6 before pasting those prompts.

## Platform prerequisites

The supported private development path is OpenAI Secure MCP Tunnel. It makes an
outbound HTTPS connection from the local `tunnel-client` and does not require a
public inbound endpoint. It is intended for developer-mode testing, not public
plugin submission.

Before running P1, verify all of the following:

1. The target ChatGPT workspace has Developer mode available and enabled.
2. The operator has the separate permissions required to use the tunnel and to
   use ChatGPT Developer mode.
3. A tunnel has been created in the Platform organization associated with the
   target ChatGPT workspace. Record its `tunnel_id`.
4. A runtime/control-plane API key is available for the tunnel client.
5. Outbound HTTPS to `api.openai.com:443` is permitted.
6. `tunnel-client.exe` has been downloaded from Platform tunnel settings or an
   official OpenAI release and placed in a local tools directory.

Official references:

- [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [Connect a server to ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt)

Never paste the runtime API key into ChatGPT, screenshots, issue trackers, or
this repository.

## Exact local setup commands

Run these commands from the repository root in **PowerShell Terminal A**. A
timestamped database gives every gate run a clean state without deleting a
previous run.

```powershell
npm.cmd ci
npm.cmd run verify
$env:PAW_GATE_RUN_ID = Get-Date -Format "yyyyMMdd-HHmmss"
$env:PAW_DB_PATH = ".\data\chatgpt-platform-gate-$env:PAW_GATE_RUN_ID.db"
Write-Output "PAW_DB_PATH=$env:PAW_DB_PATH"
npm.cmd run build
npm.cmd run seed
npm.cmd start
```

Expected seed output includes:

```json
{
  "seeded": true,
  "projectId": "10000000-0000-4000-8000-000000000001",
  "lifecycleState": "APPLIED",
  "lifecycleVersion": 1
}
```

The exact production/local start command is:

```powershell
npm.cmd start
```

It runs `node dist/src/server.js`; therefore `npm.cmd run build` must have
completed first. Keep Terminal A and the server running for the entire manual
gate.

## Exact local endpoint verification

Run in **PowerShell Terminal B**:

```powershell
curl.exe -sS -i http://127.0.0.1:3000/healthz
curl.exe -sS -i http://127.0.0.1:3000/mcp
node --input-type=module -e "import { Client } from '@modelcontextprotocol/sdk/client/index.js'; import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'; const client = new Client({name:'platform-gate-verifier',version:'0.1.0'}); await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3000/mcp'))); const tools = await client.listTools(); const ping = await client.callTool({name:'workspace_ping',arguments:{}}); console.log(JSON.stringify({tools:tools.tools.map(t=>t.name),ping:ping.structuredContent},null,2)); await client.close();"
```

Expected results:

- `/healthz`: HTTP `200` and
  `{"status":"ok","database":"available"}`.
- `GET /mcp`: HTTP `405`. This is expected because the Streamable HTTP MCP
  endpoint is POST-only in Spike 1A; a browser GET is not a valid MCP probe.
- The MCP client command completes a Streamable HTTP handshake, lists exactly
  `workspace_ping`, `workspace_get_project`,
  `workspace_record_observation`, `workspace_propose_transition`, and
  `workspace_admit_transition`, then returns a successful ping result.

Local verification performed on 2026-09-02 observed those results. This proves
the local server and transport only, not ChatGPT connectivity.

## Exact Secure MCP Tunnel setup

Open **PowerShell Terminal C** in the directory containing
`tunnel-client.exe`. Replace only the two angle-bracket placeholders.

```powershell
$env:CONTROL_PLANE_API_KEY = "<runtime-api-key>"
.\tunnel-client.exe help quickstart
.\tunnel-client.exe init --sample sample_mcp_stdio_local --profile paw-spike-1a --tunnel-id "<tunnel-id>" --mcp-server-url "http://127.0.0.1:3000/mcp"
.\tunnel-client.exe doctor --profile paw-spike-1a --explain
.\tunnel-client.exe run --profile paw-spike-1a
```

Keep Terminal C running. Capture the redacted `doctor` result and connected
tunnel status. Do not capture the key.

In ChatGPT:

1. Open **Settings → Security and login** and enable **Developer mode**.
2. Open the ChatGPT **Plugins** area and select **+** to create a
   developer-mode app.
3. Choose **Tunnel** as the connection type.
4. Select or paste the recorded `tunnel_id`, then complete the connection.
5. If the tunnel is not listed, stop the gate and verify that the tunnel is
   associated with the same ChatGPT workspace and Platform organization and
   that both permission sets are present.

The operator subsequently configured and ran the Tunnel client successfully.
Tunnel execution, Custom App creation, tool discovery, and tool invocation were
validated manually. Runtime credentials remain outside the repository.

## Database evidence command

Open **PowerShell Terminal D** at the repository root. Copy the exact database
path printed by Terminal A, then run this command before and after every test.

```powershell
$env:PAW_DB_PATH = "<absolute-path-printed-by-Terminal-A>"
node --input-type=module -e "import Database from 'better-sqlite3'; const d=new Database(process.env.PAW_DB_PATH,{readonly:true}); for(const t of ['principals','workspaces','projects','resources','state_transitions','transition_evidence','tasks','idempotency_records']) console.log(t,JSON.stringify(d.prepare('SELECT * FROM '+t).all(),null,2)); d.close();"
```

Store each output with the corresponding P-number. UUIDs and timestamps may
differ; cardinality, state, versions, relationships, authority fields, and
idempotency keys must match the expectations below.

## Expected state checkpoints

| Checkpoint | Project | Resources | Transitions | Open tasks | Idempotency records |
| --- | --- | ---: | ---: | ---: | ---: |
| S0 — after seed | `APPLIED` v1 | 0 | 1 admitted import | 0 | 0 |
| S1 — after P5 | `APPLIED` v1 | 1 | 1 admitted import | 0 | 1 |
| S2 — after P6 | `APPLIED` v1 | 1 | 1 admitted import + 1 proposed | 0 | 2 |
| S3 — after P7 | `RECRUITER_CONTACT` v2 | 1 | 2 admitted | 1 | 3 |

The S3 task must have `task_kind = RESPOND_TO_RECRUITER`, reference the P6
transition through `source_transition_id`, and occur only once.

## P1 — Workspace app connection

**Conversation:** Start ChatGPT Conversation A with the new Workspace app
enabled.

**Exact prompt:** No prompt is required. Complete the app connection in the
ChatGPT UI and open Conversation A with the app enabled.

**Expected tool calls:** None.

**Expected database state:** Before `S0`; after `S0`. Connecting must not write
domain state.

**Evidence to capture:**

- ChatGPT plan/account and workspace type.
- Developer mode setting.
- App connection screen showing the Tunnel connection and app enabled.
- Tunnel ID, partially redacted if needed, and redacted tunnel-client connected
  status.
- Date/time and any platform warning or constraint.

**Result (select exactly one after execution):**

- [x] `SUPPORTED`
- [ ] `SUPPORTED_WITH_CONSTRAINT`
- [ ] `NOT_SUPPORTED`

**Constraint/failure notes:** None reported. Custom App and Secure MCP Tunnel
connection were validated.

## P2 — `workspace_ping`

**Conversation:** A.

**Exact ChatGPT prompt:**

```text
Use the Personal AI Workspace app. Call workspace_ping exactly once and do not call any other tool. Return the tool result, including service, version, database, and workspaceId.
```

**Expected tool calls:** One `workspace_ping` call with `{}`.

**Expected result:** `service = personal-ai-workspace`, `version = 0.1.0`,
`database = available`, and a non-empty `workspaceId`.

**Expected database state:** Before `S0`; after `S0`.

**Evidence to capture:** Prompt, tool name, empty arguments, complete tool
result, conversation identifier, and pre/post database snapshots.

**Result (select exactly one after execution):**

- [x] `SUPPORTED`
- [ ] `SUPPORTED_WITH_CONSTRAINT`
- [ ] `NOT_SUPPORTED`

**Constraint/failure notes:** None reported. `workspace_ping` was supported.

## P3 — `workspace_get_project`

**Conversation:** A.

**Exact ChatGPT prompt:**

```text
Use the Personal AI Workspace app. Call workspace_get_project exactly once with projectId "10000000-0000-4000-8000-000000000001". Do not call any write tool. Return the project lifecycle state and version and the counts of resources, transitions, and openTasks.
```

**Expected tool calls:** One `workspace_get_project` call with:

```json
{"projectId":"10000000-0000-4000-8000-000000000001"}
```

**Expected result:** The stable Project ID, `APPLIED` v1, zero resources, one
admitted import transition, and zero open tasks.

**Expected database state:** Before `S0`; after `S0`.

**Evidence to capture:** Prompt, exact tool arguments and result, Project ID,
state/version, returned object counts, and pre/post database snapshots.

**Result (select exactly one after execution):**

- [x] `SUPPORTED`
- [ ] `SUPPORTED_WITH_CONSTRAINT`
- [ ] `NOT_SUPPORTED`

**Constraint/failure notes:** None reported. Durable Project read was
supported.

## P4 — Cross-conversation persistent read

**Conversation:** Start a separate new ChatGPT Conversation B. Do not paste or
summarize Conversation A into it. Enable the same Workspace app.

**Exact ChatGPT prompt:**

```text
Use the Personal AI Workspace app. This is a new conversation. Call workspace_get_project exactly once with projectId "10000000-0000-4000-8000-000000000001". Do not call any write tool. Return the project lifecycle state and version and the counts of resources, transitions, and openTasks.
```

**Expected tool calls:** One `workspace_get_project` call with the same Project
ID.

**Expected result before mutation:** The same durable Project is returned as
`APPLIED` v1 with zero resources, one admitted import transition, and zero open
tasks. No Conversation A context is required.

After P7, repeat the exact P4 prompt in Conversation B. The mandatory
post-mutation result is `RECRUITER_CONTACT` v2 with one resource, two admitted
transitions, and one open `RESPOND_TO_RECRUITER` task. This second read proves
that the changed state, not conversation memory, is durable.

**Expected database state:** Initial read before `S0`; after `S0`. Post-P7 read
before `S3`; after `S3`. Both reads are non-mutating.

**Evidence to capture:** Distinct Conversation A and B identifiers, lack of
copied context, both prompts, both tool calls/results, stable Project ID, and
pre/post database snapshots.

**Result (select exactly one after both reads):**

- [x] `SUPPORTED`
- [ ] `SUPPORTED_WITH_CONSTRAINT`
- [ ] `NOT_SUPPORTED`

**Constraint/failure notes:** None reported. Separate conversations read the
same durable Project.

## P5 — Record observation without state mutation

**Conversation:** Return to A.

**Exact ChatGPT prompt:**

```text
Use the Personal AI Workspace app. Call workspace_record_observation exactly once with these arguments: projectId "10000000-0000-4000-8000-000000000001"; resourceType "EMAIL"; provider "platform-gate"; externalId "platform-gate-message-001"; externalUri "https://example.invalid/platform-gate/messages/001"; title "Synthetic recruiter contact"; observedFacts {"recruiterContacted":true,"summary":"Synthetic recruiter contact for Platform Gate P5"}; observedAt "2026-09-02T10:00:00+10:00"; idempotencyKey "platform-gate-p5-observation-v1". Do not propose or admit a transition. Return the complete tool result.
```

**Expected tool calls:** One `workspace_record_observation` call with exactly the
arguments in the prompt. No proposal or admission call.

**Expected result:** A new Resource ID; `projectStateChanged = false`,
`deduplicated = false`, and `replayed = false`.

**Expected database state:** Before `S0`; after `S1`. The Project remains
`APPLIED` v1. One Resource and one observation idempotency record exist; no task
or new transition exists.

**Evidence to capture:** Prompt, tool arguments/result, P5 Resource ID,
`projectStateChanged`, and pre/post database snapshots.

**Result (select exactly one after execution):**

- [x] `SUPPORTED`
- [ ] `SUPPORTED_WITH_CONSTRAINT`
- [ ] `NOT_SUPPORTED`

**Constraint/failure notes:** None reported. The observation persisted without
lifecycle mutation.

## P6 — Propose transition without state mutation

Replace `<P5_RESOURCE_ID>` before pasting.

**Conversation:** A.

**Exact ChatGPT prompt:**

```text
Use the Personal AI Workspace app. Call workspace_propose_transition exactly once with these arguments: projectId "10000000-0000-4000-8000-000000000001"; expectedLifecycleVersion 1; toState "RECRUITER_CONTACT"; triggerType "EXTERNAL_EVIDENCE"; evidenceResourceIds ["<P5_RESOURCE_ID>"]; rationale "The synthetic recruiter contact supports APPLIED to RECRUITER_CONTACT."; idempotencyKey "platform-gate-p6-proposal-v1". Do not call workspace_admit_transition. Return the complete tool result and then state whether durable Project state changed.
```

**Expected tool calls:** One `workspace_propose_transition` call with exactly the
arguments in the prompt. No admission call.

**Expected result:** A P6 Transition ID with `fromState = APPLIED`,
`toState = RECRUITER_CONTACT`, `fromVersion = 1`, `toVersion = null`,
`status = PROPOSED`, `projectStateChanged = false`, `deduplicated = false`, and
`replayed = false`.

**Expected database state:** Before `S1`; after `S2`. The Project remains
`APPLIED` v1 and there is still no task. The proposal references the P5
Resource as evidence.

**Evidence to capture:** Prompt, exact tool arguments/result, P6 Transition ID,
evidence relationship, absence of an admission call, and pre/post database
snapshots.

**Result (select exactly one after execution):**

- [x] `SUPPORTED`
- [ ] `SUPPORTED_WITH_CONSTRAINT`
- [ ] `NOT_SUPPORTED`

**Constraint/failure notes:** None reported. The proposal persisted without
lifecycle mutation.

## P7 — Explicit admission and state mutation

First complete P8-A below while the proposal is still pending. Then replace
`<P6_TRANSITION_ID>` and paste this prompt. The instruction itself is the
explicit user authority for this Spike-only development mechanism.

**Conversation:** A.

**Exact ChatGPT prompt:**

```text
I explicitly authorize admission of the proposed transition from APPLIED to RECRUITER_CONTACT. Use the Personal AI Workspace app and call workspace_admit_transition exactly once with these arguments: transitionId "<P6_TRANSITION_ID>"; expectedLifecycleVersion 1; userConfirmed true; authorityReference "User explicitly authorized admission in Platform Gate P7."; idempotencyKey "platform-gate-p7-admission-v1". Return the complete tool result.
```

**Expected tool calls:** One `workspace_admit_transition` call with exactly the
arguments in the prompt. The model must not supply admission authority before
this explicit instruction.

**Expected result:** `RECRUITER_CONTACT` v2; the P6 transition is `ADMITTED` by
`USER` with `admissionAuthorityType = EXPLICIT_USER_DEV`; one derived task has
`taskKind = RESPOND_TO_RECRUITER`; `alreadyAdmitted = false`; and
`replayed = false`.

**Expected database state:** Before `S2`; after `S3`. Exactly one lifecycle
version increment and one derived task occur.

**Evidence to capture:** Explicit-authority prompt, exact tool arguments/result,
authority fields, state/version, Transition ID, Task ID, and pre/post database
snapshots. Also capture whether ChatGPT displayed a write confirmation and what
the user approved; confirmation UX is a platform observation, not a substitute
for the explicit authority in the prompt.

**Result (select exactly one after execution):**

- [x] `SUPPORTED`
- [ ] `SUPPORTED_WITH_CONSTRAINT`
- [ ] `NOT_SUPPORTED`

**Observed result:** `APPLIED -> RECRUITER_CONTACT`; lifecycle version `1 ->
2`; transition `ADMITTED`; `admitted_by = USER`;
`admission_authority_type = EXPLICIT_USER_DEV`; exactly one high-priority
`RESPOND_TO_RECRUITER` Task created.

**Constraint/failure notes:** None reported.

## P8 — Retry and idempotency behavior

P8 has three calls. P8-A runs immediately after P6 and before P7. P8-B and P8-C
run immediately after P7.

### P8-A — Proposal replay, no duplicate transition

Replace `<P5_RESOURCE_ID>` with the same ID used in P6.

**Exact ChatGPT prompt:**

```text
Use the Personal AI Workspace app. Retry the P6 proposal by calling workspace_propose_transition exactly once with the identical arguments: projectId "10000000-0000-4000-8000-000000000001"; expectedLifecycleVersion 1; toState "RECRUITER_CONTACT"; triggerType "EXTERNAL_EVIDENCE"; evidenceResourceIds ["<P5_RESOURCE_ID>"]; rationale "The synthetic recruiter contact supports APPLIED to RECRUITER_CONTACT."; idempotencyKey "platform-gate-p6-proposal-v1". Return the complete tool result.
```

**Expected tool calls/result:** One proposal call; the same P6 Transition ID;
`replayed = true`; no new transition.

**Expected database state:** Before `S2`; after `S2`.

### P8-B — Admission replay, no duplicate task

Replace `<P6_TRANSITION_ID>` with the P6 ID.

**Exact ChatGPT prompt:**

```text
Retry my explicitly authorized P7 admission. Use the Personal AI Workspace app and call workspace_admit_transition exactly once with the identical arguments: transitionId "<P6_TRANSITION_ID>"; expectedLifecycleVersion 1; userConfirmed true; authorityReference "User explicitly authorized admission in Platform Gate P7."; idempotencyKey "platform-gate-p7-admission-v1". Return the complete tool result.
```

**Expected tool calls/result:** One admission call; the same Transition ID and
Task ID; `replayed = true`; no new lifecycle version and no duplicate task.

**Expected database state:** Before `S3`; after `S3`.

### P8-C — Same key, different payload conflict

This intentionally changes only `authorityReference` while retaining the P7
idempotency key.

**Exact ChatGPT prompt:**

```text
Perform this negative idempotency test even though a conflict is expected. Use the Personal AI Workspace app and call workspace_admit_transition exactly once with: transitionId "<P6_TRANSITION_ID>"; expectedLifecycleVersion 1; userConfirmed true; authorityReference "Changed authority reference for Platform Gate P8 conflict test."; idempotencyKey "platform-gate-p7-admission-v1". Do not retry with a new key and do not report success. Return the exact tool error.
```

**Expected tool calls/result:** One admission call returning an error with code
`IDEMPOTENCY_CONFLICT`. No fallback call and no invented success.

**Expected database state:** Before `S3`; after `S3`.

**P8 evidence to capture:** All three prompts, exact arguments and results,
stable Transition/Task IDs, replay flags, conflict code/message, and database
snapshots proving exactly two total transitions, one task, and three
idempotency records after all P8 calls.

**Result (select exactly one after all three calls):**

- [x] `SUPPORTED`
- [ ] `SUPPORTED_WITH_CONSTRAINT`
- [ ] `NOT_SUPPORTED`

**Observed result:** `alreadyAdmitted = true`; lifecycle remained
`RECRUITER_CONTACT` v2; no duplicate transition or Task; the existing Respond
to recruiter Task remained single. Automated tests separately cover exact
same-key replay and different-payload conflict behavior.

**Constraint/failure notes:** None reported.

## Final evidence bundle

Create one evidence folder outside Git or in an ignored local path. Include:

1. Platform/workspace type and Developer mode availability.
2. Redacted tunnel configuration, `doctor` output, and connected status.
3. P1 app connection screenshot.
4. Conversation A and B identifiers.
5. Every exact prompt, tool name, arguments, tool result/error, and any ChatGPT
   confirmation UI for P2–P8.
6. Database snapshots before and after each P-number.
7. Stable Project, Resource, Transition, and Task IDs.
8. Any retry, unexpected extra tool call, model refusal, permission error,
   disconnect, or platform constraint.

## Result record

| Test | Execution status | Result | Evidence reference | Constraint/failure |
| --- | --- | --- | --- | --- |
| P1 connection | `EXECUTED` | `SUPPORTED` | Manual ChatGPT Platform Gate | None reported |
| P2 ping | `EXECUTED` | `SUPPORTED` | Manual ChatGPT Platform Gate | None reported |
| P3 get project | `EXECUTED` | `SUPPORTED` | Manual ChatGPT Platform Gate | None reported |
| P4 cross-conversation read | `EXECUTED` | `SUPPORTED` | Manual ChatGPT Platform Gate | None reported |
| P5 observation isolation | `EXECUTED` | `SUPPORTED` | Manual ChatGPT Platform Gate | None reported |
| P6 proposal isolation | `EXECUTED` | `SUPPORTED` | Manual ChatGPT Platform Gate | None reported |
| P7 explicit admission | `EXECUTED` | `SUPPORTED` | Manual ChatGPT Platform Gate | None reported |
| P8 idempotency | `EXECUTED` | `SUPPORTED` | Manual ChatGPT Platform Gate | None reported |

All eight manual gates were executed and reported supported. The result is
limited to the development Spike 1A environment and does not authorize Spike
1B or establish production-readiness.
