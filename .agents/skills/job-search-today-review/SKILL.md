---
name: job-search-today-review
description: Review the user's current Personal AI Workspace Job Search attention from live Workspace state. Use when the user asks what needs attention today, which applications or tasks need action, or requests a daily job-search review. Read-only; do not use for job-description or resume work, general lifecycle explanations, mail scans, or application and Task mutations.
---

# Job Search Today Review

Provide a concise, actionable daily review from the Workspace-owned Today view.
Treat chat history as context only; live Workspace results are authoritative.

## Procedure

1. Call `workspace_get_today` exactly once on the normal path. It takes no input.
2. Require the read-only Today contract to return `date`, `timeZone`, `attention`,
   `upcoming`, `applicationsWithoutOpenTask`, and `recentLifecycleChanges`. If the
   tool is unavailable, fails, or has an incompatible response, stop and report
   that the live review could not be completed. Do not infer a review from
   conversation history and do not switch to a database, website, Gmail, or
   another data source.
3. Present the returned local date and time zone so "today" is unambiguous.
4. Preserve the returned sections, reasons, and ordering. Summarize what needs
   action now, what is upcoming, which applications lack open Tasks, and any
   recent lifecycle changes that the response includes. Do not recalculate,
   reclassify, or rerank items.
5. Make an additional read only when a concrete item returned by Today cannot be
   explained without it, or when the user explicitly asks for that item's
   details. Read the exact object by its returned identifier with
   `workspace_get_task` or `workspace_get_project`. State the reason for the
   extra read. Do not enumerate Applications, Projects, or Tasks as a default.
6. Return a short action-oriented summary. If a returned section is empty, say so
   without inventing work. Keep informational gaps distinct from tool failures.

## Read-only boundary

This Skill has no mutation branch. Do not call any Workspace mutation tool,
including create, update, observation, transition proposal/admission, or mail-scan
state tools. Do not call Gmail or mail-evidence tools as part of this review.

If the user's intent changes to an application lifecycle change, a Task update,
or a mail scan, end this procedure and use the separately approved procedure if
one is available. A recommendation, follow-up question, or urgent tone does not
authorize a write.

Do not use direct database access, a website mutation, or an unrelated tool as a
fallback. Do not claim that Workspace state changed; this procedure only reports
the state returned by read-only Workspace tools.
