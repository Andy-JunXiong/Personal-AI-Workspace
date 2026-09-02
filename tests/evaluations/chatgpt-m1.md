# ChatGPT M1 Smoke Evaluation

**Current status:** M1 duplicate-protection smoke gate = FAILED / DEFECT FOUND

M1 is not ChatGPT-integration complete. Do not begin M2 until the defect fix is
deployed against a fresh external DB and this gate passes.

## Defect evidence

The controlled smoke database contained one active application:

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

The three optional registration fields were absent or explicit `null`; the
pre-fix normalization and request hash do not preserve that distinction. No
duplicate-override field existed in the schema or request.

## Remediation status

The server-side guard and regression suite pass locally. A fixed server is
running against a new database under
`%LOCALAPPDATA%\PersonalAIWorkspace\data\`; the failed smoke database was not
reused. ChatGPT tool metadata was refreshed and now exposes the structured
`allowDistinctDuplicate` contract.

The first platform retest create reached Workspace and produced exactly one
synthetic active Project, one initial transition, and one idempotency record.
ChatGPT then showed a temporary request-rate limit before returning the final
conversation response, so the remaining list, update, and duplicate scenarios
were not executed. The platform gate therefore remains failed/pending and must
not be recorded as passed from this partial evidence.

## Fresh-DB retest gate

Use a new DB filename outside the repository and OneDrive. Do not copy or reuse
the failed smoke DB.

1. Start the fixed server with `PAW_DB_PATH` pointing to the fresh DB.
2. Refresh the Personal AI Workspace app/tool metadata in ChatGPT and confirm
   `workspace_create_job_application` exposes optional
   `allowDistinctDuplicate` with literal value `true`.
3. Create `M1 Retest Co — AI Reliability Engineer` with applied date, location,
   explicit creation authority, and no duplicate override. Expect `CREATED`.
4. List applications. Expect exactly one matching active Project.
5. Update only its location using `expectedRecordVersion`. Confirm lifecycle
   remains `APPLIED` version 1 and registration `recordVersion` increments.
6. From a separate ChatGPT conversation, create the same company + role using
   only explicit creation authority. Expect `POSSIBLE_DUPLICATE`; capture the
   exact tool arguments/result.
7. List again. Expect exactly one matching active Project and no extra initial
   transition or idempotency record from the blocked duplicate attempt.
8. Call create with `allowDistinctDuplicate=true` but no `postingReference`.
   Expect a validation error and zero writes.
9. Supply a different sanitized synthetic posting URL but omit
   `allowDistinctDuplicate`. Expect `POSSIBLE_DUPLICATE` and zero writes.
10. Only after an explicit user instruction to create a distinct second
    application, call with `allowDistinctDuplicate=true` and the different
    synthetic posting URL. Expect `CREATED`.
11. Retry step 10 with identical arguments and idempotency key. Expect
    `replayed=true` and exactly two matching Projects total.

Record the gate as PASS only after all steps succeed on the fresh external DB.
