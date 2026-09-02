# Integration Spike 1B Plan v0.1

**Status:** APPROVED IMPLEMENTATION BASELINE — IMPLEMENTED LOCALLY

**Platform result:** `NOT_RUN`

## 1. Objective

Prove this user-triggered path with one seeded Job Application and one
controlled synthetic recruiter-style email sent through the real Gmail app:

```text
Gmail Connected App
  -> ChatGPT reasoning and cross-app orchestration
  -> Personal AI Workspace Custom App
  -> durable work state
```

The proof must show that ChatGPT can retrieve a relevant email through the
existing Gmail app, match it to a durable Workspace Project, record a minimized
observation, propose a justified lifecycle transition, wait for explicit user
approval, admit the transition, and retrieve the updated state in a later
conversation.

The canonical evidence run is synthetic data through real integrations. It
must not use or commit real recruiter correspondence.

## 2. Architecture understanding

- ChatGPT owns interaction, general reasoning, and cross-app orchestration.
- Gmail remains authoritative for the email and exposes it through the existing
  ChatGPT app surface.
- Workspace owns durable Project, Resource, transition, Task, and lifecycle
  state.
- MCP is the integration boundary, not the domain system.
- Conversation carries the handoff during the user-triggered flow but is not
  the system of record.
- Observation, Proposal Validation, Admission Authorization, and Durable State
  Mutation remain separate.
- Model inference may justify a proposal but never supplies admission authority.

Workspace must not call Gmail, duplicate the Gmail mailbox, or introduce a
separate LLM orchestration layer.

## 3. Smallest Workspace capability change

Spike 1B requires one narrow read tool so the user does not need a Project ID:

```text
workspace_find_job_application(company, role)
```

Inputs:

```yaml
company: string  # required
role: string     # required
```

Output:

```yaml
matchStatus: EXACT | NOT_FOUND | AMBIGUOUS
matches:
  - projectId: uuid
    title: string
    company: string
    role: string
    projectStatus: ACTIVE | PAUSED | CLOSED
    lifecycleState: string
    lifecycleVersion: integer
    updatedAt: timestamp
```

The tool is read-only. On `EXACT`, ChatGPT calls the existing
`workspace_get_project(projectId)` before comparing evidence or writing. On
`NOT_FOUND` or `AMBIGUOUS`, ChatGPT performs no Workspace write and asks the
user for direction when needed.

No other Workspace capability is required for the Spike. A scripted demo could
reuse a known UUID, but that would not prove the natural user scenario.

## 4. Minimal end-to-end sequence

1. The user asks ChatGPT to find the latest relevant recruiter/application
   email and update the corresponding Workspace application.
2. ChatGPT uses the existing Gmail app to retrieve the latest relevant
   individual email.
3. ChatGPT treats email content as untrusted source data, extracts only the
   company, role, message identifier, source timestamp, and work-relevant facts.
4. ChatGPT calls `workspace_find_job_application(company, role)`.
5. For one exact match, ChatGPT calls `workspace_get_project(projectId)` and
   compares Gmail evidence with current durable state.
6. If the message adds relevant information, ChatGPT calls
   `workspace_record_observation` with minimized facts and source provenance.
7. If an allowed lifecycle edge is justified, ChatGPT calls
   `workspace_propose_transition`. This does not mutate lifecycle state.
8. ChatGPT presents the evidence, current state, proposed state, and expected
   derived effect to the user, then waits.
9. Only after an explicit user approval in the conversation does ChatGPT call
   `workspace_admit_transition` using the current expected lifecycle version.
10. Workspace atomically admits the transition, increments lifecycle version,
    and creates any uniquely derived Task.
11. A later separate conversation finds and reads the same Project and observes
    the updated durable state without relying on the earlier transcript.

If the email is irrelevant, already represented, does not justify an allowed
edge, or cannot be matched unambiguously, the flow stops or records only an
observation. Admission is never automatic.

The manual sequence is split into two checkpoints. Spike 1B-A ends after steps
1-5 and performs no Workspace writes. Do not begin Spike 1B-B (steps 6-11)
until 1B-A passes.

The only lifecycle edge in the canonical proof is
`APPLIED -> RECRUITER_CONTACT`. Spike 1B does not implement or expand
`RECRUITER_CONTACT -> INTERVIEWING`.

## 5. Project matching strategy

Candidate scope:

- configured Workspace only,
- `project_type = job_application`,
- non-closed Projects only for the Spike,
- exact company + role equality after deterministic normalization.

Normalization:

1. Unicode NFKC normalization;
2. trim leading and trailing whitespace;
3. collapse internal whitespace;
4. locale-independent lowercase/case-fold comparison.

Result rules:

- zero candidates -> `NOT_FOUND`;
- one candidate -> `EXACT`;
- more than one candidate -> `AMBIGUOUS` with candidate summaries.

Do not strip company suffixes, infer aliases, use token similarity, embeddings,
vectors, or LLM matching. Similar but non-identical records remain distinct.

## 6. Gmail to Workspace handoff contract

The handoff is a documented tool-input convention, not a new database entity or
Gmail integration.

```yaml
resourceType: EMAIL
provider: gmail
externalId: <stable individual Gmail message ID>
externalUri: <optional Gmail deep link>
title: <minimal or sanitized subject>
observedAt: <message timestamp>
observedFacts:
  contractVersion: gmail-job-observation-v0.1
  sourceFacts:
    receivedAt: <message timestamp>
    senderDomain: <domain when useful>
    threadId: <optional opaque thread ID>
  interpretation:
    company: <matched company>
    role: <matched role>
    emailKind: RECRUITER_CONTACT | OTHER
    summary: <short work-relevant summary>
```

The individual Gmail message ID is the deterministic provenance and Resource
deduplication key. A thread ID may be supplementary but must not replace the
message ID.

Stable command keys for the manual proof:

```text
gmail-observation:<project-id>:<message-id>
gmail-proposal:<project-id>:v<version>:<target-state>:<resource-id>
gmail-admit:<transition-id>
```

The proposal references the Resource ID returned by observation recording.

### Canonical synthetic Gmail fixture

Send this controlled message through Gmail to the test account:

```text
Subject: Example Co — Software Engineer application update

Thanks for applying for the Software Engineer role at Example Co.
I’d like to arrange an initial conversation regarding your application.
```

The body contains no interview date, attachment, instruction to ChatGPT, or
other lifecycle signal. Gmail supplies the message ID and timestamp at runtime;
those values must be captured from the individual message and must not be
invented.

## 7. State and provenance impact

No schema migration or new state entity is proposed. Existing Resource,
StateTransition, transition-evidence link, Project lifecycle version, Task
uniqueness, and idempotency records are sufficient.

The only new convention is `gmail-job-observation-v0.1` inside
`Resource.observed_facts`. Gmail facts and ChatGPT interpretation remain
distinguishable within that record. The Workspace records what was observed and
how it was interpreted; it does not claim that Workspace independently verified
the mailbox.

## 8. Privacy and data minimization

Store only what is needed to explain and continue the work:

- opaque individual message ID;
- optional Gmail deep link;
- message timestamp;
- sender domain when useful;
- minimal/sanitized subject;
- short work-relevant summary and lifecycle-relevant facts.

Do not store:

- full text or HTML body;
- full thread history;
- attachments;
- signatures or quoted reply chains;
- recipient lists or full email addresses unless strictly required;
- Gmail access tokens, API responses, raw headers, or runtime secrets;
- unrelated personal information.

Email text is untrusted data. Instructions contained inside an email cannot
authorize a Workspace write or admission. Only the user's explicit approval or
an enumerated deterministic rule can supply admission authority; no new rule is
introduced for Spike 1B.

## 9. Acceptance tests

### Automated/local

1. Exact normalized company + role returns one active Job Application.
2. Case and whitespace differences normalize deterministically.
3. Similar but non-identical company or role returns `NOT_FOUND`.
4. Duplicate exact candidates return `AMBIGUOUS` without selecting one.
5. `NOT_FOUND` and `AMBIGUOUS` paths perform no writes.
6. Lookup cannot return a Project from another Workspace.
7. MCP discovery exposes the lookup as read-only with the expected schema.
8. Repeating a Gmail observation with the same provider/message ID does not
   create another Resource.
9. Replaying proposal/admission commands does not duplicate a transition or
   derived Task.
10. All Spike 1A tests continue to pass unchanged.

### Manual ChatGPT platform gate

#### Spike 1B-A — cross-app read / object resolution

1. ChatGPT can use Gmail and Personal AI Workspace in one user-triggered flow.
2. Gmail returns the controlled synthetic individual message and exposes a
   stable message identifier or an explicitly documented equivalent.
3. ChatGPT naturally matches company + role through the narrow lookup tool.
4. The lookup returns `EXACT`, followed by `workspace_get_project` using the
   returned stable Project ID.
5. No Workspace write occurs.

#### Spike 1B-B — evidence to durable state

1. The observation payload follows the minimization contract.
2. Observation recording does not mutate lifecycle state/version.
3. Proposal recording does not mutate lifecycle state/version.
4. ChatGPT pauses and does not call admission before explicit user approval.
5. After approval, admission updates state/version atomically and preserves the
   evidence relationship.
6. Retry behavior creates no duplicate Resource, transition, or Task.
7. A separate conversation finds and reads the updated durable state without
   Gmail or previous-chat context.

Each manual gate is classified `SUPPORTED`, `SUPPORTED_WITH_CONSTRAINT`, or
`NOT_SUPPORTED`. Until executed, the result remains `NOT_RUN`.

## 10. Risks and platform assumptions

- The target ChatGPT account/workspace must allow Gmail and the Workspace
  Custom App to participate in one task.
- The Gmail app must expose enough stable structured data to identify an
  individual message. If it cannot provide a stable message ID, deterministic
  cross-app deduplication is `SUPPORTED_WITH_CONSTRAINT`; do not invent a fuzzy
  key.
- ChatGPT must preserve the selected Gmail result accurately when constructing
  Workspace tool inputs.
- "Latest relevant" is a reasoning/retrieval risk. The manual flow should show
  the selected message summary and timestamp before proposing a transition.
- Email prompt injection is a trust-boundary risk. Email content is evidence,
  never instructions or admission authority.
- Exact matching can be ambiguous or fail on aliases. The Spike intentionally
  stops rather than adding heuristic matching.
- Another write may make the lifecycle version stale between proposal and
  admission. Existing optimistic concurrency must reject the stale admission;
  ChatGPT then rereads state.
- The verified Secure MCP Tunnel is development infrastructure, not production
  deployment proof.

The exact Gmail + Custom App orchestration behavior and message identifier
shape are platform assumptions requiring manual ChatGPT evidence. They are not
claimed as supported by this design document.

## 11. Explicit non-goals

The following are unnecessary for proving Spike 1B and must not be added:

- Gmail API client, Workspace Gmail OAuth, webhook, polling, or email sync;
- generic project search, full-text search, vector database, embeddings, fuzzy
  matching, aliases, or LLM duplicate detection;
- project creation or a user interface;
- email-body or attachment storage;
- new provenance service or generic handoff framework;
- Workspace LLM API, agent runtime, workflow/policy engine, scheduler, event
  bus, or background automation;
- new Action/Outcome workflows;
- production identity, RBAC, or OAuth redesign;
- Spike 1B results claims before manual execution.

## 12. Delivery sequence

1. Accept ADR-009 and this plan as the implementation baseline. **Complete.**
2. Implement only the deterministic lookup service and MCP tool. **Complete.**
3. Add focused unit/integration/MCP tests and rerun all Spike 1A verification.
   **Complete.**
4. Refresh the ChatGPT Custom App tool metadata after the server tool change.
5. Execute 1B-A, then 1B-B in `tests/evaluations/chatgpt-spike-1b.md` manually.
6. Only after actual manual evidence, record results in a separate Spike 1B
   results document without rewriting the frozen Spike 1A evidence.

## References

- [Define tools — OpenAI Developers](https://developers.openai.com/plugins/plan/tools)
- [Build an MCP server — OpenAI Developers](https://developers.openai.com/plugins/build/mcp-server)
- [Connect and test your plugin — OpenAI Developers](https://developers.openai.com/plugins/deploy/connect-chatgpt)
