# Architecture Review v0.1

**Status:** REVIEWED — viable, with three material changes before implementation.

## Executive Decision

The project remains **ChatGPT-native first**, but the Workspace is narrowed to the layer that ChatGPT does not naturally provide as a durable domain system:

- **ChatGPT owns interaction and general reasoning.**
- **Connected apps/services expose source data and actions.**
- **The Workspace owns durable cross-conversation work state.**
- **MCP / Apps SDK is the bridge between ChatGPT and the Workspace.**
- **The MVP should not rebuild Gmail/Drive/Calendar integrations unless direct integration becomes necessary for background/event ingestion.**

The first MVP validates **cross-conversation continuity**, not background autonomy.

---

## 1. Frozen decisions

### F-01 — Conversation is not the system of record

A conversation is an interaction surface. The durable object is the real work object.

### F-02 — ChatGPT-native first

The project deliberately benefits from ChatGPT's:
- conversation UI,
- reasoning,
- existing apps,
- web/search,
- multimodal surface,
- orchestration.

### F-03 — Workspace owns continuity

The Workspace owns:
- Goal,
- Project,
- Task,
- Resource references,
- lifecycle state,
- Action,
- Outcome,
- transition history.

### F-04 — MCP / Apps SDK is an integration surface

MCP is not the domain model and is not the product.

### F-05 — Personal-first, public-ready

Single-user MVP, but no hard-coded personal state/credentials inside the domain model.

---

## 2. Required changes

### M-01 — Do not put Workspace in front of every service in MVP

Previous mental model:

```text
ChatGPT
  ↓
Workspace
  ↓
Gmail / Drive / Calendar
```

Revised MVP:

```text
                   ChatGPT
                 /         \
                /           \
      Connected Apps     Workspace App
     Gmail/Drive/etc.     (MCP / Apps SDK)
                \           /
                 \         /
              ChatGPT reasoning
                     ↓
              Durable Work State
```

This preserves the project's thesis: **ChatGPT is the orchestration surface**.

Direct Workspace connectors remain a later option for:
- webhooks,
- background ingestion,
- provider-specific reliability,
- scheduled automation.

---

### M-02 — Separate observation from durable state

The general rule is:

```text
Observation / Evidence
        ↓
Candidate Transition
        ↓
Validation
        ↓
Admitted Transition
        ↓
Durable State
```

The LLM may propose a transition. It should not silently become the durable fact.

For actions:

```text
Action Attempt
    ↓
Observable Result
    ↓
Outcome
    ↓
Candidate State Change
```

---

### M-03 — MVP should be user-triggered first

Do not start with background ingestion.

MVP proof:

1. ChatGPT reads a recruiter message through an available connected app.
2. ChatGPT reads the current Job Application from the Workspace.
3. ChatGPT records the new observation / proposes the transition.
4. Workspace persists the updated state.
5. A later separate conversation retrieves the same state.

This directly proves:

> **Conversation is a view into durable work state, not the container of it.**

---

## 3. Architecture gates

### G-01 — Multi-app orchestration
Verify ChatGPT can reliably use a connected source app and the Workspace custom app in one task.

### G-02 — Cross-app handoff
Verify what structured facts can be passed from a source-app result to the Workspace tool call.

### G-03 — Custom app write capability
Verify the current ChatGPT account/workspace supports the write/modify path required for state persistence.

### G-04 — Identity mapping
Resolve:

```text
ChatGPT user
   ↓
Workspace identity
   ↓
workspace_id
```

### G-05 — Idempotency
Repeated tool calls must not duplicate transitions, tasks, resources, or actions.

---

## 4. Architecture principles v0.1

1. Conversation is an interface, not the system of record.
2. ChatGPT is the primary interaction and reasoning host.
3. Workspace owns durable cross-conversation work state.
4. External systems remain authoritative for their native facts.
5. MCP / Apps SDK exposes capabilities; it does not define domain state.
6. Observation and durable mutation are separate steps.
7. State changes must be attributable to evidence, user intent, or observable action result.
8. MVP proves continuity first; autonomy comes later.

## Verdict

**Proceed to State Model v0.1 + ChatGPT Integration Spike.**

---

## 5. Frozen Spike 1A implementation decisions

These decisions were approved before implementation:

1. Spike 1A proves only Workspace MCP connectivity, durable state,
   cross-conversation reads, observation recording, proposal/admission, and
   idempotency.
2. Spike 1B owns Connected App + Workspace cross-app handoff. Spike 1A does not
   implement Gmail, Drive, Calendar, or other external connectors.
3. Proposal Validation and Admission Authorization are separate. ChatGPT may
   propose; admission requires explicit user authority or an explicitly
   enumerated deterministic rule. Model inference alone is insufficient.
4. Spike 1A runtime lifecycle edges enable no deterministic admission rule. It
   uses the smallest explicit-user development admission mechanism and records
   that authority. `SPIKE_FIXTURE_IMPORT` is separately enumerated only for
   initial seed creation.
5. Command-level idempotency is mandatory. Semantic deduplication is limited to
   deterministic external identifiers or byte-for-byte canonical records. No
   fuzzy or LLM duplicate detection is permitted.
6. Identity is one configured development principal mapped to one Workspace.
   OAuth, login, RBAC, and user administration are outside Spike 1A.
7. The blocking lifecycle proof is `APPLIED -> RECRUITER_CONTACT`.
   `RECRUITER_CONTACT -> INTERVIEWING` may be supported but is not required.
8. The logical components are modules in one deployable process, not
   microservices.
