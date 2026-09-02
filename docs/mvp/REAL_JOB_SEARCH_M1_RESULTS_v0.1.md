# Real Job Search MVP Slice M1 Results v0.1

**Milestone:** Real Application Inventory

**Final decision:** COMPLETE

## 1. Result summary

| Decision | Result |
| --- | --- |
| M1 local implementation | COMPLETE |
| M1 ChatGPT platform integration | SUPPORTED |
| M1 duplicate protection | SUPPORTED |
| Slice M1 overall | COMPLETE |

M1 replaces fixture-only Job Application inventory with user-authorized durable
registration, active listing, exact lookup, narrow versioned metadata updates,
and bounded Project readback. M2 and M3 are not part of this result.

## 2. Implemented tool surface

- `workspace_create_job_application`
- `workspace_list_job_applications`
- `workspace_find_job_application`
- `workspace_update_job_application`
- bounded-by-default `workspace_get_project`

Creation starts at `APPLIED` and attributes the initial admitted transition to
explicit user authority. Metadata updates cannot mutate lifecycle state,
lifecycle version, or Project status.

## 3. Automated and local evidence

The automated suite proves:

- creation, listing, exact lookup, metadata update, concurrency, and
  idempotency;
- registration `recordVersion` behavior and lifecycle isolation;
- bounded recent Resource and transition history with total counts;
- Workspace isolation;
- posting-reference sanitization;
- runtime SQLite placement outside the repository and OneDrive;
- exact active duplicate detection with frozen normalization;
- zero writes when an ordinary duplicate is blocked;
- a separate structured distinct-duplicate override requiring both an explicit
  flag and a different sanitized posting reference; and
- preservation of frozen Spike 1A and Spike 1B tests.

Final verification passed: TypeScript typecheck, all 8 test files and 48 tests,
the production build, and `git diff --check`. Automated results and manual
platform observations are not treated as interchangeable.

## 4. Manual ChatGPT platform evidence

The final smoke ran through ChatGPT and Personal AI Workspace against a fresh
external DB using only controlled synthetic data.

| Scenario | Result |
| --- | --- |
| Real Job Application creation | SUPPORTED |
| Active application listing | SUPPORTED |
| Metadata update | SUPPORTED |
| Record version increment | SUPPORTED |
| Lifecycle isolation during metadata update | SUPPORTED |
| Exact active duplicate protection | SUPPORTED |

The duplicate retest began with one active `M1 Test Co — AI Platform Engineer`
Project. A second create used explicit creation authority only. Workspace
returned duplicate behavior, created no second Project, and required a unique
posting reference for any deliberate distinct application. This proves that
creation authority is not duplicate-override authority on the real platform.

## 5. Defect history and closure

The initial M1 smoke exposed a missing create-path duplicate guard. The service
normalized metadata but wrote without checking exact active company and role;
the create MCP schema also lacked a distinct-duplicate contract. A new
idempotency key therefore created another Project. ADR-010 contained the same
incorrect assumption that duplicates could be surfaced later as ambiguity.

The remediation added a pre-write and transactional exact-active guard, a
zero-write `POSSIBLE_DUPLICATE` result, and the narrow structured override
contract. Regression coverage includes the actual platform failure shape,
normalization, active filtering, partial override rejection, valid override,
and retry. MCP metadata was refreshed before the successful fresh-DB retest.

The original platform defect is closed.

## 6. Privacy and operational boundary

- No real Gmail address or message content is M1 evidence.
- No runtime key, tunnel credential, or real SQLite DB is committed.
- Durable posting references are sanitized to HTTP(S) origin and path.
- Real runtime state remains behind `PAW_DB_PATH` outside the repository and
  OneDrive.
- The milestone retains only controlled synthetic evidence.

## 7. Remaining limitations

- Matching remains exact company plus role; there is no fuzzy, semantic, or
  vector matching.
- Listing is bounded and has no generic pagination framework.
- Project history is bounded to recent records by default; full history APIs
  are not part of M1.
- The structured distinct-duplicate override has automated coverage; the final
  manual smoke focused on the default no-override protection boundary.
- M1 has no Task mutation tools or deterministic `get_today`; those belong to
  the separately gated M2 slice.
- The expanded real lifecycle and derived effects belong to M3.
- There is no background Gmail ingestion, Calendar integration, UI/dashboard,
  or multi-user productization.

## 8. Final decision

Slice M1 is complete and may be frozen at
`m1-real-application-inventory-verified-v0.1`. Beginning M2 requires a separate
change and is not part of this milestone.
