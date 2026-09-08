# Workspace Skills Synthetic Contract Acceptance — 2026-09-08

**Status:** EXECUTED — LOCAL WORKSPACE/MCP CONTRACT GATE PASSED

This campaign records the deterministic operator-side acceptance harness merged in
[PR #18](https://github.com/Andy-JunXiong/Personal-AI-Workspace/pull/18). It tests
the Workspace/MCP procedures required by S1 and representative S2 cases without
using production state, external evidence, Gmail, browser automation or a model.

It is supporting contract evidence. It is not fresh-context Skill discovery,
routing, authority-judgment or platform acceptance evidence.

## Pinned identity

| Field | Value |
|---|---|
| Merge commit | `495a12955f75df486418f0e99a6c61258ac2fb2d` |
| Harness | `scripts/run-workspace-skills-synthetic-acceptance.ts` |
| Command | `npm run skills:acceptance:synthetic` |
| Report schema | `paw-workspace-skills-synthetic-acceptance-v1` |
| Fixed clock | `2026-09-08T00:00:00.000Z` |
| Time zone | `Australia/Sydney` |
| Main Verify run | [34195197793](https://github.com/Andy-JunXiong/Personal-AI-Workspace/actions/runs/34195197793) — success |
| Repository verification | 40 test files / 310 tests; typecheck and production build passed |

## Isolation

- Every scenario creates a fresh file-backed SQLite Workspace and deletes it after
  the result is captured.
- The real PAW MCP HTTP surface is bound only to `127.0.0.1`.
- Fixture setup and logical fingerprinting remain operator-side and are not exposed
  as agent tools.
- No existing database path, production identifier, credential, mail account,
  browser, external network source or deployment is accepted by the harness.
- Mutation authority strings and all records are synthetic and scoped to the
  disposable fixture.

## Results

| Scenario | Protocol case | Ordered-path assertion | Durable-state assertion | Result |
|---|---|---|---|---|
| `S1_NORMAL_READ_ONLY` | S1 normal Today | exactly `workspace_get_today` | complete logical fingerprint unchanged | PASS |
| `S2_T1_ACTIVE_READ_ONLY` | T1 | exact find → exact Project read | fingerprint unchanged | PASS |
| `S2_T2_AMBIGUOUS_STOP` | T2 | exact find only; no guessed Project read | fingerprint unchanged | PASS |
| `S2_T5_AUTHORIZED_TRANSITION` | T5 | find → read → propose → read → admit → read | one transition, one derived Task and two idempotency rows; exact final lifecycle/version readback | PASS |
| `S2_T6_PROPOSAL_ONLY` | T6 | find → read → propose → read; no admission | one proposal and one idempotency row; lifecycle/version unchanged | PASS |
| `S2_T8_OBSERVATION_ONLY` | T8 | find → read → observe → read | one Resource and one idempotency row; lifecycle/version unchanged | PASS |
| `S2_T9_INVALID_TRANSITION` | T9 | invalid proposal followed by exact read | rejected proposal persisted; no lifecycle, Project-status or Task delta | PASS |
| `S2_T9_STALE_VERSION` | T9 | stale admission returns error, then exact read | `CONCURRENCY_CONFLICT`; failed call has zero logical delta and no new-key retry | PASS |

Overall: **8/8 PASS**.

The report also records ordered tool names, complete synthetic arguments, result
status, before/after logical hashes, table and row counts, bounded table-row deltas,
and exact readback facts. The integration test executes the harness during the
normal repository test suite and asserts the report schema, isolation declaration,
scenario set, critical traces and stale-version failure.

## What this closes

- S1 Today read-only behavior now has independent local before/after durable-state
  proof, not only a model statement or read-only annotation.
- The representative S2 write recipes now have real MCP ordering, proposal and
  admission readback, bounded durable deltas and fail-closed stale-version proof.
- Ambiguity, invalid-transition, proposal-only and observation-only behavior now
  have executable regression evidence.

## What remains open

- Full positive, negative, ambiguous and multilingual routing matrices in fresh
  Codex and ChatGPT contexts.
- Proof that a model, rather than the deterministic harness, applies the authority
  gates and stops on every unsupported case.
- T3 closed lookup, T4 advice, T7 existing-proposal admission and the remaining T9
  failure matrix in hosted model runs.
- A same-model prompt-driven baseline comparison.
- Platform-exported raw traces and installed Skill version/provenance per
  invocation.
- Independent ChatGPT iPhone acceptance.

## Decision

Local Workspace/MCP contract gate: **PASS**.

Overall S1/S2 platform acceptance: **INCONCLUSIVE**.

S3 `job-mail-scan`: **HOLD** until the remaining model/runtime, baseline, mobile,
mail-platform and explicit human-approval gates pass.
