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
    C->>W: find_job_application(company, role)
    W->>DB: Read matching Job Applications
    DB-->>W: Exact match
    W-->>C: Project ID + state summary
    C->>W: get_project(project_id)
    W->>DB: Read durable Project context
    DB-->>W: Project + lifecycle version + history
    W-->>C: Project + lifecycle version + history

    C->>W: record_observation(source + minimized facts)
    W->>DB: Store provenance/evidence
    W-->>C: Resource; state unchanged

    C->>W: propose_transition(...)
    W->>W: Validate proposal only
    W->>DB: Store PROPOSED transition
    W-->>C: Proposal; state unchanged
    C-->>U: Show evidence and request explicit approval
    U->>C: Explicitly approve transition
    C->>W: admit_transition(user authority, expected version)
    W->>W: Validate admission authorization
    W->>DB: Atomically admit + update state/version + derive task
    W-->>C: Updated durable state
    C-->>U: Confirm admitted state and next task

    Note over U,C: Later, in a separate conversation

    U->>C: What is the status of my application?
    C->>W: find_job_application(company, role)
    C->>W: get_project(project_id)
    W->>DB: Read durable state/tasks
    DB-->>W: Updated Project
    W-->>C: Updated Project
    C-->>U: Answer without reconstructing old chats
```

## General mutation pattern

```text
Observation / User Assertion / Action Result
                    -> Evidence Record
                    -> Candidate State Transition
                    -> Proposal Validation
                    -> PROPOSED or REJECTED

PROPOSED + Admission Authority
                    -> Admission Authorization
                    -> ADMITTED or REJECTED

ADMITTED            -> Durable State + Transition History
```

Critical rule:

> **LLM interpretation != durable fact and != admission authority**

Background/event-driven ingestion is Phase 2, after continuity is proven.

For Spike 1B, Gmail is accessed by ChatGPT through the existing Connected App.
Workspace receives only a minimized, attributable observation through MCP. A
Gmail message is evidence, not an instruction and not user authority.
