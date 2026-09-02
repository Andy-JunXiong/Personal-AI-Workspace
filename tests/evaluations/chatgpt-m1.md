# ChatGPT M1 Smoke Evaluation

**Current status:** SUPPORTED — Slice M1 overall COMPLETE

## Final status

| Gate | Result |
| --- | --- |
| M1 local implementation | COMPLETE |
| M1 ChatGPT platform integration | SUPPORTED |
| M1 duplicate protection | SUPPORTED |
| Slice M1 overall | COMPLETE |

Automated/local evidence and manual ChatGPT platform evidence are separate.
The platform result does not expand the scope of the automated assertions.

## Automated and local evidence

The final M1 suite verifies:

- user-authorized creation at `APPLIED` with an attributable initial admitted
  transition;
- command idempotency;
- Workspace-scoped, active-by-default listing and exact lookup;
- narrow registration metadata updates with optimistic concurrency;
- `recordVersion` increments without changing lifecycle state, lifecycle
  version, or Project status;
- bounded Project readback;
- exact active duplicate detection after NFKC, whitespace, and case
  normalization;
- zero writes for a blocked duplicate, including no Project, transition, or
  idempotency record;
- separation of ordinary creation authority from duplicate-override authority;
- the structured distinct-duplicate contract, including invalid partial
  overrides, a different sanitized posting reference, and idempotent retry;
- runtime DB path enforcement outside the repository and OneDrive; and
- all frozen Spike 1A and Spike 1B behavior.

At finalization, `npm run verify` and `git diff --check` passed. The exact final
test counts are recorded in the M1 results document and milestone commit.

## Original platform defect

The first ChatGPT smoke run contained one active controlled application:

```text
M1 Test Co — AI Platform Engineer
status = ACTIVE
lifecycle = APPLIED
```

A second create command with ordinary explicit creation authority created a
second active Project instead of returning `POSSIBLE_DUPLICATE`.

The pre-fix server did not log raw MCP request bodies. Durable controlled
evidence reconstructs the effective second request as:

```json
{
  "company": "M1 Test Co",
  "role": "AI Platform Engineer",
  "appliedDate": null,
  "location": null,
  "postingReference": null,
  "userConfirmed": true,
  "authorityReference": "User explicitly requested creation of another active job application in this conversation.",
  "idempotencyKey": "create-another-m1-test-co-ai-platform-engineer-20260902-turn-2"
}
```

The optional registration fields were absent or explicit `null`; the pre-fix
normalization and request hash did not preserve that distinction. No
duplicate-override field existed in the schema or request.

### Root cause

`createJobApplication` normalized registration metadata and then entered the
idempotent write path without querying for an exact active company and role.
The exact lookup normalization was correct but was not used by creation.
Creation had no active-status duplicate filter and the MCP schema had no
separate structured override boundary. Idempotency protected only retries with
the same key, while the second ChatGPT request used a new key.

ADR-010 also contained an incompatible assumption that exact duplicates could
be created and surfaced later as `AMBIGUOUS`. That architecture drift was
corrected.

### Remediation

The server now:

- returns `POSSIBLE_DUPLICATE` for an exact active match before writing;
- repeats the duplicate check inside the write transaction;
- performs zero writes for the blocked attempt;
- treats creation authority and duplicate-override authority as separate;
- accepts a deliberate distinct duplicate only with both
  `allowDistinctDuplicate=true` and a different sanitized `postingReference`;
  and
- preserves idempotent replay for a previously valid command.

ChatGPT MCP metadata was refreshed and confirmed to expose the new structured
flag and the duplicate-protection description.

## Manual ChatGPT platform evidence

The final canonical smoke used a fresh SQLite database under the configured
`PAW_DB_PATH` boundary outside both the repository and OneDrive. The failed
smoke database was not reused. Only controlled synthetic application data was
used.

| Platform scenario | Observed result |
| --- | --- |
| Real Job Application creation | SUPPORTED |
| Active application listing | SUPPORTED |
| Registration metadata update | SUPPORTED |
| Registration record version increment | SUPPORTED |
| Lifecycle isolation during metadata update | SUPPORTED |
| Exact active duplicate protection | SUPPORTED |

For the duplicate retest, an active `M1 Test Co — AI Platform Engineer`
application already existed. A second create request supplied ordinary explicit
user creation authority only. Workspace detected the exact active duplicate,
created no second application, and ChatGPT explained that a distinct second
application requires a unique posting reference. Creation authority did not
act as duplicate-override authority.

The earlier temporary ChatGPT rate limit did not determine the final result;
the successful fresh-DB rerun above is the canonical platform evidence.

## Decision

The original duplicate-protection platform defect is closed. M1 is locally
complete, its ChatGPT platform integration and duplicate boundary are
supported, and Slice M1 overall is complete. No M2 capability was implemented
or verified as part of this milestone.
