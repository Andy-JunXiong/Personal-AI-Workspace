# Lifecycle Mutation Procedure

Load this procedure only after the user explicitly requests a Workspace write or
a specific lifecycle change for one exact application.

## Establish all three gates

Before every write, distinguish and satisfy:

1. **Platform permission:** the current runtime can invoke the exact Workspace
   tool and any platform approval completes.
2. **Workspace authority:** the user's current explicit instruction covers this
   exact object and operation.
3. **Domain admission:** current Workspace state, evidence when required, and the
   server-owned lifecycle contract accept the operation.

These gates are independent. A tool being callable, persuasive evidence, a prior
unrelated approval, or an earlier write does not satisfy the other gates.

Because proposing persists a transition record, a proposal also requires platform
permission and explicit Workspace authority. `workspace_propose_transition` is the
authoritative domain-validation operation and may durably return a rejected
proposal; do not copy the lifecycle graph into this Skill to predict its result.
Admission requires an exact accepted proposal in addition to its own platform and
authority gates.

A direct request to move one exact application to one exact state may cover the
proposal and admission for that same transition in the current turn. It does not
authorize storing new external evidence unless the instruction explicitly covers
that write. "What should happen next?", "The recruiter replied", approval to
propose only, or conversational urgency does not authorize admission.

## Prepare the proposed transition

Use the fresh `workspace_get_project` result from the entry procedure. Preserve its
exact Project ID and `lifecycleVersion`.

If the user explicitly asks to admit an existing Transition ID, skip proposal only
when that exact `PROPOSED` transition is present in the fresh Project read, matches
the same Project and requested destination, and uses the current lifecycle version.
If the user supplies only a Transition ID, or the bounded Project history does not
contain it, stop and request enough application identity to verify it; never admit
from conversation history alone.

For a verified existing proposal, continue directly to **Admit and read back** and
do not create another proposal. Otherwise prepare a new proposal as follows.

- For an explicit user assertion, use `USER_ASSERTION` and do not invent evidence.
- For evidence already stored on this Project, use only relevant Resource IDs from
  the exact readback and the applicable trigger type.
- Record a new observation with `workspace_record_observation` only when the user
  explicitly authorizes that persistence and the source's required minimized
  provenance fields are available. After recording, call `workspace_get_project`
  and verify that the Resource belongs to the exact Project and that lifecycle
  state/version did not change. Mail retrieval and mail scanning are outside this
  Skill.

Create one idempotency key for each logical write before invoking it. Retain the
key and exact payload for uncertain-result recovery; never create a new key to
force a retry.

## Propose, verify, and decide

1. Call `workspace_propose_transition` with the exact Project ID, current
   `expectedLifecycleVersion`, requested destination, justified trigger and
   evidence, concise rationale, and the prepared idempotency key.
2. Call `workspace_get_project` immediately afterward regardless of the proposal
   response's apparent success.
3. Verify that the proposal belongs to the exact Project and destination and that
   proposal alone did not change Project lifecycle state/version.
4. If Workspace rejects the edge or evidence, stop and report the exact rejection.
5. If the user's authority covers proposal only, or does not unambiguously cover
   admission of this exact transition, show the proposed transition and ask for
   explicit admission authority. Stop until the user answers.

Proposal success is not lifecycle success and is not admission authority.

## Admit and read back

Before admission, verify the exact proposed Transition ID, Project, destination,
and still-current lifecycle version. If any value is stale or inconsistent, re-read
and stop; do not silently rebuild or replace the proposal.

When platform permission, exact user authority, and Workspace admission all apply:

1. Call `workspace_admit_transition` once using the exact Transition ID and current
   `expectedLifecycleVersion`, set `userConfirmed=true`, include a short attributable
   `authorityReference`, and use the prepared admission idempotency key.
2. Call `workspace_get_project` for the exact Project regardless of whether the
   mutation response appears successful.
3. Report only the durable readback: Project status, lifecycle state/version, the
   admitted transition, and relevant derived or cancelled Task effects.

If the write response and readback disagree, readback is authoritative. Report the
mismatch as an incomplete or failed workflow; never claim success from intent or
the write response alone.

## Failure and retry rules

- `AMBIGUOUS`, unresolved identity, duplicate uncertainty, missing evidence,
  missing authority, unavailable tools, rejected writes, invalid edges, and
  terminal states fail closed.
- On a stale lifecycle version, perform an exact read, explain the new state, and
  stop. Do not force the write or assume the earlier instruction covers a changed
  transition.
- Safe reads may be retried. A mutation with an uncertain response may be replayed
  only when the Workspace contract declares idempotency and the exact same key and
  payload are retained. Never retry a rejected mutation blindly.
- Never substitute direct database access, website actions, Gmail, mail-scan tools,
  another MCP source, a guessed application, or reconstructed chat state.
