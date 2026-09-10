---
name: targeted-verification
description: Select the minimum sufficient verification for a Personal AI Workspace repository change, or reassess checks after a failure or follow-up edit. Use when choosing tests or validating development changes; not for live job-search reviews, mail scans or production business operations.
---

# Targeted verification

Use the repository's [verification policy](../../../docs/VERIFICATION.md) for
levels, escalation gates and the test matrix. This is a repository-local
development Skill, not part of the separately pinned Workspace MCP Skill release.

1. Read the task's current diff, including relevant untracked files. Separate
   existing edits from this task; inspect interactions without reverting them.
2. Name the observable claims to validate. Follow changed imports/callers far
   enough to assess public contracts, persistence, lifecycle, configuration and
   authority impact. Do not infer risk only from filenames or line counts.
3. Select a level and the narrowest evidence exercising those claims. Briefly
   state the scope before running checks. Use actual test files/cases from the
   policy's matrix; do not execute the matrix as a checklist.
4. Check prior results against current code, dependencies and relevant fixtures/
   configuration. Reuse still-valid evidence; identify exactly what a subsequent
   change invalidates. Keep this record in normal working notes.
5. Run the selected checks. If they fail, classify the failure before expanding.
   Name the policy gate and concrete evidence before any full-suite run. Existing
   CI/release requirements still apply; selecting tests does not authorize release.
6. Stop at the policy's sufficient-evidence condition. Report actual results,
   broader checks omitted with reasons, and remaining uncertainty. Do not rerun
   passing checks because a turn resumed or more tests are available.

The policy document is authoritative for verification selection. Workspace remains
authoritative for business state and admission. Do not copy lifecycle rules,
recalculate business decisions, change permissions, or add runtime machinery here.
