# ChatGPT M3 Platform Evaluation

**Current status:** PENDING — LOCAL IMPLEMENTATION PASSED

Automated/local evidence and manual ChatGPT platform evidence remain separate.
Run this evaluation against a fresh external SQLite database with the committed
M3 build, `PAW_TIME_ZONE=Australia/Sydney`, a refreshed development connection,
and the 12-tool Personal AI Workspace app. Use only the synthetic names below.

## M3-A — Proposal separation and non-terminal derived effects

Use one ChatGPT conversation. Send each quoted prompt as a separate turn.

1. "Use Personal AI Workspace and call `workspace_ping`. Confirm the durable
   database is available."

2. "I explicitly authorize you to register one synthetic active Job
   Application for company `M3 Flow Co` and role `Lifecycle Engineer`."

3. "Propose, but do not admit, `M3 Flow Co — Lifecycle Engineer` from APPLIED
   to RECRUITER_CONTACT using its current lifecycle version, trigger type
   USER_ASSERTION, no evidence Resources, and rationale `Synthetic recruiter
   progression for M3`. Then read the Project and confirm proposal status is
   PROPOSED while durable lifecycle remains APPLIED."

4. "I explicitly authorize admission of that proposed transition. Admit it
   once with its proposal version and report the admitted state/version plus
   the transition-derived Task. Then read the Project."

5. "Propose, but do not admit, that application from RECRUITER_CONTACT to
   INTERVIEWING using its current version, trigger type USER_ASSERTION, no
   evidence Resources, and rationale `Synthetic interview progression for
   M3`. Confirm the proposal alone does not mutate the Project."

6. "I explicitly authorize admission of that INTERVIEWING proposal. Admit it
   once and report the new lifecycle version plus the derived Task."

7. "Propose, but do not admit, that application from INTERVIEWING to OFFER
   using its current version, trigger type USER_ASSERTION, no evidence
   Resources, and rationale `Synthetic offer progression for M3`. Confirm the
   proposal alone does not mutate the Project."

8. "I explicitly authorize admission of that OFFER proposal. Admit it once
   and report the new lifecycle version plus the derived Task. Then read the
   Project and report every open Task."

Expected: lifecycle versions 1 -> 2 -> 3 -> 4. Derived Tasks are exactly HIGH
`RESPOND_TO_RECRUITER`, HIGH `PREPARE_FOR_INTERVIEW`, and HIGH `REVIEW_OFFER`,
each linked to its admitted transition. Proposal-only turns never mutate state.

## M3-B — Successful terminal outcome and retry safety

Continue in the M3-A conversation.

1. "I explicitly want you to create one manual OTHER Task titled `M3 terminal
   cleanup probe`, priority LOW, with no due date on `M3 Flow Co — Lifecycle
   Engineer`."

2. "Propose, but do not admit, that application from OFFER to ACCEPTED using
   its current version, trigger type USER_ASSERTION, no evidence Resources,
   and rationale `Synthetic accepted outcome for M3`. Read the Project and
   confirm it remains ACTIVE/OFFER with all open Tasks before admission."

3. "I explicitly authorize admission of that ACCEPTED proposal. Admit it once
   with its proposal version. Report Project status, lifecycle state/version,
   derived Task, and the resulting status/version/update attribution of every
   formerly open Task. Then read the Project and list applications both with
   default active-only behavior and with closed applications included."

4. "Retry the exact ACCEPTED admission using the identical transition ID,
   expected lifecycle version, authority reference, and idempotency key. Do not
   create or update anything else. Report whether it replayed and confirm no
   Task or transition was duplicated or version-incremented again."

5. "Attempt to propose ACCEPTED to INTERVIEWING using the current lifecycle
   version. This is an intentional terminal-state negative test. Do not admit
   it. Report the structured rejected proposal and confirm the Project remains
   CLOSED/ACCEPTED."

Expected: the proposal alone does nothing; admission produces CLOSED/ACCEPTED
version 5, no derived Task, and atomically cancels all previously open Tasks.
The closed application is absent from default listing and present when
`includeClosed=true`. Retry is safe. The terminal outgoing proposal is
REJECTED with no mutation.

## M3-C — Other terminal outcomes and cross-conversation durability

Continue in the original conversation. Send each quoted prompt as a separate
turn.

1. "I explicitly authorize you to register one synthetic active Job
   Application for company `M3 Reject Co` and role `QA Engineer`."

2. "Propose, but do not admit, `M3 Reject Co — QA Engineer` from APPLIED to
   REJECTED using its current lifecycle version, trigger type USER_ASSERTION,
   no evidence Resources, and rationale `Synthetic rejected outcome for M3`.
   Confirm the proposal alone leaves the Project ACTIVE/APPLIED."

3. "I explicitly authorize admission of that REJECTED proposal. Admit it once,
   then report Project status, lifecycle state/version, and open Tasks."

4. "I explicitly authorize you to register one synthetic active Job
   Application for company `M3 Withdraw Co` and role `Data Engineer`."

5. "Propose, but do not admit, `M3 Withdraw Co — Data Engineer` from APPLIED
   to WITHDRAWN using its current lifecycle version, trigger type
   USER_ASSERTION, no evidence Resources, and rationale `Synthetic withdrawn
   outcome for M3`. Confirm the proposal alone leaves the Project
   ACTIVE/APPLIED."

6. "I explicitly authorize admission of that WITHDRAWN proposal. Admit it
   once, then report Project status, lifecycle state/version, and open Tasks."

Start a completely new ChatGPT conversation connected to the same database,
then send this final prompt:

7. "Without reconstructing prior chat and without any mutation, use exact
   lookup and Project readback for `M3 Flow Co — Lifecycle Engineer`, `M3 Reject
   Co — QA Engineer`, and `M3 Withdraw Co — Data Engineer`. Also list Job
   Applications with default active-only behavior and with closed applications
   included. Report each Project's status, lifecycle state/version, and open
   Task count."

Expected: all three Projects are durably CLOSED in ACCEPTED, REJECTED, and
WITHDRAWN respectively; each terminal Project has zero open Tasks; default
active listing excludes all three; include-closed listing contains all three;
and no prior-conversation context is needed.

## Global negative-scope checks

- Every admission follows a separate explicit user-authority turn.
- Proposal never supplies admission authority or mutates lifecycle.
- No transition leaves a terminal state.
- No Gmail/Calendar scan, background job, reminder, notification, LLM ranking,
  new lifecycle state, new MCP tool, or manual `REVIEW_OFFER` creation occurs.
- Record M3-A, M3-B, and M3-C separately as `SUPPORTED`, `NOT SUPPORTED`, or
  `INCONCLUSIVE`, with structured results, fresh database identity, and
  sanitized logs.
