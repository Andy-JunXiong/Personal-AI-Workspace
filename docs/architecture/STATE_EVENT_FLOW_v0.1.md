# State / Event Flow v0.1

## MVP — user-triggered, cross-conversation continuity

```mermaid
sequenceDiagram
    participant U as User
    participant C as ChatGPT
    participant G as Connected Gmail App
    participant W as Workspace App
    participant DB as Workspace State

    U->>C: Check whether the recruiter replied
    C->>G: Retrieve relevant recruiter email
    G-->>C: Email facts/content
    C->>W: get_project(company, role)
    W->>DB: Read state
    DB-->>W: APPLIED
    W-->>C: Project + state

    C->>W: record_observation(source + facts)
    W->>DB: Store provenance/evidence

    C->>W: propose_transition(...)
    W->>W: Validate
    W->>DB: Admit transition
    W->>DB: Create next task if needed
    W-->>C: Updated state
    C-->>U: Recruiter replied; next action is ...

    Note over U,C: Later, in a separate conversation

    U->>C: What should I focus on today?
    C->>W: get_today()
    W->>DB: Read durable state/tasks
    DB-->>W: Current priorities
    W-->>C: Current priorities
    C-->>U: Answer without reconstructing old chats
```

## General mutation pattern

```text
Observation / User Assertion / Action Result
                    ↓
               Evidence Record
                    ↓
          Candidate State Transition
                    ↓
                Validation
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
     ADMITTED                 REJECTED
        ↓
 Durable State + Transition History
```

Critical rule:

> **LLM interpretation ≠ durable fact**

Background/event-driven ingestion is Phase 2, after continuity is proven.
