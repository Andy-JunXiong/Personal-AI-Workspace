# Integration Spike 1B Results v0.1

**Date:** 2026-09-02

**Status:** COMPLETE — AUTOMATED/LOCAL AND CHATGPT/GMAIL VERIFICATION PASSED

**Milestone:** `spike-1b-cross-app-verified-v0.1`

## Scope completed

Spike 1B proves this user-triggered path with controlled synthetic evidence:

```text
Gmail Connected App
  -> ChatGPT cross-app reasoning and orchestration
  -> exact durable Workspace Job Application
  -> minimized attributable observation
  -> isolated transition proposal
  -> explicit-user admission
  -> durable state in a separate conversation
```

The Workspace added one read-only capability,
`workspace_find_job_application(company, role)`. It did not add a Gmail
connector, provider OAuth, polling, webhook, background automation, generic
search, second model, or new domain entity.

The canonical lifecycle proof remained limited to
`APPLIED -> RECRUITER_CONTACT`. Spike 1A semantics remain frozen.

## Evidence boundary

### Automated and local evidence

Repository verification command:

```text
npm run verify
```

Verified locally:

- TypeScript typecheck and production build;
- deterministic NFKC/case/whitespace-normalized company + role lookup;
- exact `EXACT`, `NOT_FOUND`, and `AMBIGUOUS` behavior;
- no fuzzy matching or automatic ambiguous-candidate selection;
- current-Workspace, `job_application`, and non-closed Project scoping;
- no writes on lookup miss or ambiguity;
- read-only MCP discovery metadata for the lookup tool;
- strict `gmail-job-observation-v0.1` validation at the Workspace boundary;
- provider normalization to `gmail`;
- rejection of full sender identities/addresses or unapproved Gmail fields
  before Resource or idempotency persistence;
- stable-message-ID Resource deduplication;
- proposal/admission idempotency and derived-task uniqueness;
- a fresh file-backed synthetic observation/proposal/admission/reopen/readback
  flow with minimized durable evidence; and
- all frozen Spike 1A authority, concurrency, persistence, and idempotency
  tests.

Automated/local evidence does not, by itself, prove that ChatGPT can use Gmail
and Personal AI Workspace in one task. That is covered by the manual evidence
below.

### Manual ChatGPT/Gmail platform evidence

The operator completed the canonical gate through the real Gmail ChatGPT app
and real Personal AI Workspace app using only the controlled synthetic
recruiter-contact fixture.

| Gate | Capability | Result |
| --- | --- | --- |
| Spike 1B-A | Gmail + Workspace cross-app read and exact work-object resolution | SUPPORTED |
| Spike 1B-B1 | Minimized evidence handoff and non-mutating proposal | SUPPORTED |
| Spike 1B-B2 | Explicit-user admission and atomic lifecycle mutation | SUPPORTED |
| Spike 1B-B3 | Retry/idempotency without duplicate transition or Task | SUPPORTED |
| Spike 1B-B4 | Separate-conversation durable Workspace-only readback | SUPPORTED |
| Privacy/data minimization | Strict minimized Gmail provenance with no sender identity, subject, or body persisted | SUPPORTED |

Runtime message identifiers, account details, sender data, database files,
transcripts, tunnel credentials, and screenshots remain operator-controlled and
are not stored in Git.

## Spike 1B-A result — cross-app object resolution

The manual run observed:

- Gmail and Personal AI Workspace participated in the same task;
- ChatGPT selected the controlled synthetic recruiter-contact message;
- ChatGPT extracted `Example Co` and `Software Engineer`;
- `workspace_find_job_application` returned the correct Project without a
  user-supplied UUID;
- `workspace_get_project` returned `APPLIED`, lifecycle version `1`; and
- no Workspace write occurred.

## Spike 1B-B1 result — evidence and proposal isolation

The manual run observed:

- one Resource using `gmail-job-observation-v0.1`;
- only approved minimized provenance and transition-relevant interpretation;
- no full sender identity/address, subject, or email body in durable state;
- one `APPLIED -> RECRUITER_CONTACT` transition with status `PROPOSED`;
- Project state remained `APPLIED`, lifecycle version `1`;
- no admission or derived Task before approval; and
- ChatGPT stopped and waited for explicit user approval.

## Spike 1B-B2 result — explicit admission

After a separate explicit approval message, the manual run observed:

- transition status `ADMITTED`;
- `admitted_by = USER`;
- `admission_authority_type = EXPLICIT_USER_DEV`;
- lifecycle transition `APPLIED -> RECRUITER_CONTACT`;
- lifecycle version `1 -> 2`; and
- exactly one high-priority `RESPOND_TO_RECRUITER` Task.

## Spike 1B-B3 result — retry and idempotency

The manual retry observed replayed/already-admitted behavior:

- lifecycle remained `RECRUITER_CONTACT`;
- lifecycle version remained `2`;
- no duplicate transition;
- no duplicate Task; and
- no additional lifecycle advancement.

## Spike 1B-B4 result — separate-conversation durable readback

A completely separate ChatGPT conversation, without Gmail or prior-chat
context, observed:

- the same `Example Co — Software Engineer` Project through read-only lookup;
- lifecycle state `RECRUITER_CONTACT`, version `2`;
- one open `RESPOND_TO_RECRUITER` Task;
- the sanitized Gmail observation;
- lifecycle history `NONE -> APPLIED -> RECRUITER_CONTACT`; and
- no full sender identity/address or email body.

This proves that conversation is not the system of record and that cross-app
evidence remains attributable and usable across conversation boundaries.

## Privacy remediation and final result

An earlier functional run exposed an unapproved sender identity in a flat
`observedFacts.sender` field. Inspection confirmed durable copies in the
Resource and idempotency response cache. The local evidence was repaired, and
the Workspace boundary was hardened to require the exact minimized Gmail
contract and reject drift before any write.

The final fresh canonical platform run validated the hardened boundary. Durable
evidence contained only the approved `gmail-job-observation-v0.1` shape. No
full sender address, sender identity, subject, or email body persisted.

Privacy/data minimization is therefore `SUPPORTED`.

## Architecture decisions demonstrated

1. ChatGPT remains the cross-app reasoning/orchestration host.
2. Gmail remains authoritative for source email facts.
3. Workspace owns durable interpretation, evidence relationships, lifecycle
   state, transition history, and derived Tasks.
4. Exact work-object resolution is narrow, deterministic, and read-only.
5. Observation, proposal, explicit approval, and admission remain separate.
6. Email content and model inference do not supply admission authority.
7. The Workspace boundary enforces minimized Gmail provenance before writing.
8. Idempotency prevents duplicate Resources, transitions, Tasks, or lifecycle
   advancement.
9. A separate conversation can continue from durable state without Gmail or
   prior-chat context.

## Known limitations and deferred scope

- The verified Gmail + Workspace orchestration is a user-triggered ChatGPT
  platform flow, not background ingestion.
- Gmail message discovery and structured identifier availability remain
  dependent on the connected-app platform surface.
- Exact company + role lookup intentionally does not handle aliases, synonyms,
  fuzzy matching, or semantic search.
- Identity remains the approved single configured development Principal and
  Workspace; production authentication, RBAC, and user management are absent.
- Persistence remains local SQLite and is not validated for multi-instance or
  production operations.
- Secure MCP Tunnel remains development infrastructure, not production
  deployment proof.
- Gmail connector code, Gmail OAuth inside Workspace, UI, scheduler, webhook,
  polling, event bus, generic workflow engine, and Real Job Search MVP features
  remain out of scope and unimplemented.

## Overall verdict

Spike 1B is complete. Automated/local evidence proves the deterministic lookup,
privacy boundary, persistence, authority, concurrency, and idempotency behavior.
Manual ChatGPT/Gmail evidence proves cross-app work-object resolution,
minimized evidence handoff, proposal isolation, explicit-user admission, safe
retry, privacy/data minimization, and separate-conversation continuity.

The milestone is frozen at `spike-1b-cross-app-verified-v0.1`. Real Job Search
MVP planning and implementation are separate future work and have not begun.
