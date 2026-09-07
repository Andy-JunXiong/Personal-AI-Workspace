# Application dates, timeline and saved profile

Status: deployed as `paw:detail-20260907171450`.

Cloud validation: container/MCP/web health passed. Read-only production rendering confirms the default timeline, two profile panels and actual appliedDate in the list. There are 23 applications, three missing appliedDate values, zero structured profile reports and zero linked candidate fit recommendations. Database integrity is `ok`. Backup: `workspace-20260907T071459Z.db`; rollback image: `paw:gmail-batch-20260907165919`. Temporary SSH rules and private local SSH keys were cleaned up. No JD, assessment or application dates were invented or inserted during deployment.

## Continuity and benefits

- Upstream: the user requested application dates in the list and a detail page with timeline, JD and personal skill matching. The user also asked whether earlier GPT assessments were already stored.
- Current package: list/date display, default chronological detail timeline, and source-backed JD/skill report panels. Existing task, evidence and state-history tabs remain available. Date-only application metadata is never replaced with import timestamps or invented times of day.
- Downstream: original GPT reports can be persisted as canonical NOTE snapshots, then rendered without another model call. Missing reports require actual source content; this package does not regenerate them.
- Short-term evidence: 246 tests / 30 files, typecheck and build passed. New transport coverage verifies date display, default timeline, profile retrieval beyond ordinary resource pagination, strict report validation, HTML escaping, no database writes on reads, and timeline pagination. Prior task-only URLs using status filters remain supported.
- Long-term: job history and previously prepared analysis have distinct, durable representations. State registrations are labeled separately from received emails and application dates.

## Audit

Read all 23 application records through the connected Workspace tools, then read each application's resources and total counts. Each read returned all resources (none exceeded the 10-resource tool window at audit time). 20 records had appliedDate and three were missing it. Observations were Gmail email evidence and Gmail-check notes; no saved JD or skill-report resources were found. This establishes what is attached to the applications, not whether analysis occurred in an inaccessible historical ChatGPT conversation. Linked candidate fit_reason summaries are additionally supported by the new read path.

## Timeline

The default detail tab merges the recorded application date, admitted state registrations, received emails, Gmail check receipts, and task creation/completion events. It orders newest first and uses the existing scoped pagination/cursor mechanism. Proposed transitions remain in the history tab and are not presented as confirmed events. Email summaries are labeled as email records, not automatically converted to admitted state changes.

## Saving an existing GPT report

Use the existing `workspace_record_observation` tool, resourceType `NOTE`, provider identifying the real source (for example `chatgpt`), the exact target projectId, a stable externalId/idempotencyKey, and an actual observation/import timestamp. `observedFacts` must match this complete snapshot:

```json
{
  "contractVersion": "job-application-profile-v0.1",
  "jobDescription": "Original saved job description, or null if unavailable",
  "skillMatch": {
    "summary": "Original assessment summary",
    "matches": [
      {
        "requirement": "Requirement from the JD",
        "evidence": "Actual candidate experience supporting the assessment",
        "assessment": "MATCH"
      }
    ],
    "gaps": ["An actual gap identified in the original assessment"]
  }
}
```

`jobDescription` and `skillMatch` each accept JSON null. Assessment values: MATCH, PARTIAL, GAP, UNKNOWN. Do not invent evidence, scores, JD text or missing reports. The latest saved snapshot is authoritative for these panels; include retained content when replacing a snapshot. Existing linked-candidate fit_reason is displayed as a matching recommendation if no structured skill report exists. Matching is not a lifecycle status.

No historical reports were fabricated or imported in this change. Unavailable dates and content are explicitly shown as not recorded/saved.
