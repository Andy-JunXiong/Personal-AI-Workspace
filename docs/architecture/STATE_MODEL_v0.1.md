# State Model v0.1

**Status:** SPIKE 1A/1B, M1, AND M2 FROZEN

## 1. Key modeling decision

For MVP:

> **A Job Application is a Project with `project_type = job_application`.**

This keeps the core model small while giving the real-world object a durable lifecycle.

---

## 2. Primary domain objects

### Workspace

```yaml
id: uuid
owner_user_id: string
name: string
created_at: timestamp
```

### Goal

```yaml
id: uuid
workspace_id: uuid
title: string
status: ACTIVE | ACHIEVED | PAUSED | ABANDONED
target_date: timestamp?
created_at: timestamp
updated_at: timestamp
```

### Project

```yaml
id: uuid
workspace_id: uuid
goal_id: uuid?
project_type: string
title: string

status: ACTIVE | PAUSED | CLOSED
lifecycle_state: string
lifecycle_version: integer
record_version: integer

metadata: object

created_at: timestamp
updated_at: timestamp
```

Job Application metadata:

```yaml
company: string
role: string
location: string?
postingReference: string? # sanitized HTTP(S) origin + path only
appliedDate: date? # YYYY-MM-DD
current_round: integer?
next_interview_at: timestamp?
interview_type: HM | TECHNICAL | PANEL | OTHER?
```

### Task

```yaml
id: uuid
project_id: uuid
title: string
task_kind: FOLLOW_UP | PREPARE_FOR_INTERVIEW | RESPOND_TO_RECRUITER | OTHER
status: TODO | IN_PROGRESS | BLOCKED | DONE | CANCELLED
priority: LOW | MEDIUM | HIGH | CRITICAL
due_at: timestamp?
record_version: integer
created_by: USER | CHATGPT | SYSTEM
updated_by: USER | CHATGPT | SYSTEM
source_transition_id: uuid?
created_at: timestamp
updated_at: timestamp
completed_at: timestamp?
```

Task state is independent of Project lifecycle state. Manual Task mutations
require explicit user authority, command idempotency, and optimistic
concurrency. Every effective mutation increments `record_version`.

`DONE` and `CANCELLED` are terminal. `DONE` sets `completed_at`; `CANCELLED`
does not. Work that resumes is represented by a new Task. Open Tasks may move
among `TODO`, `IN_PROGRESS`, and `BLOCKED`, or to either terminal state.

### Resource

```yaml
id: uuid
project_id: uuid
resource_type: EMAIL | DOCUMENT | URL | CALENDAR_EVENT | REPO_ITEM | NOTE | OTHER
provider: string?
external_id: string?
external_uri: string?
title: string?
observed_facts: object?
evidence_snapshot: object?
observed_at: timestamp?
created_at: timestamp
```

Default:
**reference + relevant observed facts**, not full source replication.

Spike 1B Gmail observation convention:

```yaml
resource_type: EMAIL
provider: gmail
external_id: <stable individual message ID>
external_uri: <optional Gmail deep link>
title: <minimal or sanitized subject>
observed_at: <message timestamp>
observed_facts:
  contractVersion: gmail-job-observation-v0.1
  sourceFacts:
    receivedAt: timestamp
    senderDomain: string?
    threadId: string?
  interpretation:
    company: string
    role: string
    emailKind: RECRUITER_CONTACT | OTHER
    summary: string
```

This is a payload convention, not a new entity or migration. `sourceFacts`
records source-derived values while `interpretation` records ChatGPT's
work-relevant reading. Do not persist full message bodies, HTML, attachments,
threads, signatures, raw headers, tokens, or unrelated personal data.

The canonical Spike 1B fixture uses `RECRUITER_CONTACT` only and can support
only the approved `APPLIED -> RECRUITER_CONTACT` proof. This convention does
not add a lifecycle edge or schema field.

For `provider=gmail`, the application boundary enforces this exact convention
before persistence. Full sender identities/addresses and unapproved fields are
validation errors; they are not silently retained or moved elsewhere.

### Action

```yaml
id: uuid
project_id: uuid
task_id: uuid?
actor_type: USER | CHATGPT | SYSTEM
action_type: string
target_system: string?
status: REQUESTED | RUNNING | SUCCEEDED | FAILED | CANCELLED
idempotency_key: string?
requested_at: timestamp
completed_at: timestamp?
```

### Outcome

```yaml
id: uuid
project_id: uuid
action_id: uuid?
outcome_type: string
summary: string?
evidence_resource_ids: [uuid]
observed_at: timestamp
created_at: timestamp
```

---

## 3. Reliability record: StateTransition

This is a system/audit record rather than another top-level user concept.

```yaml
id: uuid
project_id: uuid
from_state: string
to_state: string
trigger_type: USER_ASSERTION | EXTERNAL_EVIDENCE | ACTION_OUTCOME | IMPORT
evidence_resource_ids: [uuid]

status: PROPOSED | ADMITTED | REJECTED

proposed_by: USER | CHATGPT | SYSTEM
admitted_by: USER | RULE | SYSTEM

idempotency_key: string?

proposed_at: timestamp
admitted_at: timestamp?
rejection_reason: string?
```

Spike 1A persistence adds implementation fields required to enforce the model:

```yaml
from_version: integer
to_version: integer?
canonical_hash: string
admission_authority_type: EXPLICIT_USER_DEV | DETERMINISTIC_RULE?
admission_authority_reference: string?
```

Proposal validation does not grant admission authority. In Spike 1A,
`EXPLICIT_USER_DEV` is the only authority enabled for runtime lifecycle edges.
`SPIKE_FIXTURE_IMPORT` is the sole deterministic rule and only initializes the
seeded Project at `APPLIED`.

Why it is first-class:

Without it:

```text
state = INTERVIEWING
```

With it:

```text
APPLIED
  ↓  because recruiter email X
RECRUITER_CONTACT
  ↓  because interview invitation Y
INTERVIEWING
```

---

## 4. Job Application lifecycle v0.1

Do **not** use `INTERVIEW_PREP` as application state. Preparation is a Task.

```mermaid
stateDiagram-v2
    [*] --> APPLIED

    APPLIED --> RECRUITER_CONTACT
    APPLIED --> INTERVIEWING
    APPLIED --> REJECTED
    APPLIED --> WITHDRAWN

    RECRUITER_CONTACT --> INTERVIEWING
    RECRUITER_CONTACT --> REJECTED
    RECRUITER_CONTACT --> WITHDRAWN

    INTERVIEWING --> OFFER
    INTERVIEWING --> REJECTED
    INTERVIEWING --> WITHDRAWN

    OFFER --> ACCEPTED
    OFFER --> REJECTED
    OFFER --> WITHDRAWN
```

### Meanings

- **APPLIED** — application submitted.
- **RECRUITER_CONTACT** — meaningful employer/recruiter progression contact.
- **INTERVIEWING** — interview process active or an interview is scheduled.
- **OFFER** — concrete offer received.
- **ACCEPTED** — user accepted the offer; successful terminal business outcome.
- **REJECTED** — employer explicitly closes/rejects.
- **WITHDRAWN** — user withdraws.

`ACCEPTED`, `REJECTED`, and `WITHDRAWN` are terminal lifecycle states. Admitting
one atomically sets `Project.status = CLOSED`; `CLOSED` is not a lifecycle
state. Lifecycle represents the business outcome while Project status
represents administrative active/closed state.

Interview round is metadata, not a new lifecycle state.

---

## 5. State invariants

1. Every Project belongs to exactly one Workspace.
2. Current Project lifecycle state equals the latest ADMITTED transition.
3. PROPOSED/REJECTED transitions do not mutate durable state.
4. Task status and Project lifecycle are independent.
5. External evidence is not automatically authoritative because an LLM interpreted it.
6. Every externally-derived admitted transition references evidence/provenance.
7. Repeated identical commands/events are idempotent.
8. No critical Project state exists only in chat history.
9. A valid proposal cannot admit itself; admission authority is recorded
   separately.
10. Project lifecycle state and version change atomically with admission and
    any transition-derived Task.
11. Command idempotency keys are mandatory for mutations. Fuzzy or LLM-based
    deduplication is not part of the model.

---

## 6. First derived views

### `workspace.get_project()`

Return:
- project identity,
- lifecycle,
- key metadata,
- open tasks,
- latest 10 resources plus total count,
- latest 10 transitions plus total count,
- latest 10 outcomes plus total count if Outcome persistence exists.

The default read is bounded. A generic history pagination framework is not part
of MVP v0.1.

### `workspace.get_today()`

Return:

- overdue and due-today Tasks;
- high/critical-priority undated Tasks;
- blocked Tasks;
- Tasks upcoming within seven local calendar days;
- active Job Applications with no open Task; and
- at most five recent admitted lifecycle changes.

`Today` is a derived view, not a domain object. It uses a configured IANA
timezone and injected clock. One Task appears at most once in `attention`; all
applicable state-backed reasons are ordered `OVERDUE`, `DUE_TODAY`,
`HIGH_PRIORITY`, then `BLOCKED`. No model ranking, external-source scan,
reminder, inference, or write occurs in the query.

### `workspace.find_job_application(company, role)`

Implemented for Spike 1B. Return exact normalized matches in the current Workspace
with an explicit `EXACT`, `NOT_FOUND`, or `AMBIGUOUS` status. This is a
read-only lookup, not a domain object or generic search infrastructure.
