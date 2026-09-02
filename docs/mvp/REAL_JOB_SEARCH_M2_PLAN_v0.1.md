# Real Job Search MVP Slice M2 Plan v0.1

**Status:** IMPLEMENTATION CONTRACT FROZEN

## Objective

Prove that durable Workspace state can answer: "What needs my attention
today?" M2 adds narrow manual Task commands and one deterministic Today query.
It does not expand the Job Application lifecycle.

## Frozen pre-implementation decisions

1. `DONE` and `CANCELLED` are terminal Task states. A resumed effort is a new
   Task; terminal Tasks cannot be reopened or otherwise edited.
2. Open states are `TODO`, `IN_PROGRESS`, and `BLOCKED`. An open Task may move
   to another open state or to `DONE`/`CANCELLED`.
3. `DONE` sets `completedAt`; every other state, including `CANCELLED`, has
   `completedAt = null`.
4. Migration `003_task_attention.sql` adds only `tasks.record_version`,
   `tasks.updated_by`, and `tasks.completed_at`. Existing `due_at`,
   `created_by`, and transition-source uniqueness are reused.
5. `TaskService` owns Task commands. `TodayQueryService` owns date
   classification and the Today read model. `WorkspaceService` retains its
   frozen M1 responsibilities and composes the two dedicated modules only for
   compatibility with the existing server construction boundary.
6. Manual `taskKind` is restricted to `FOLLOW_UP`, `PREPARE_FOR_INTERVIEW`,
   `RESPOND_TO_RECRUITER`, or `OTHER`. Manual creation does not use title or
   semantic deduplication. It does reject an open transition-derived Task of
   the same kind in the same Project because that source transition already
   owns that work.
7. All Task commands are Workspace-scoped, explicitly user-authorized,
   idempotent, single-record operations using optimistic Task concurrency.

## Exact `workspace_get_today` contract

The tool has no input and returns this exact structured result under
`structuredContent.result`:

```ts
interface TodayResult {
  date: string; // YYYY-MM-DD in timeZone
  timeZone: string; // "Australia/Sydney" for current dogfood
  attention: Array<{
    reasons: Array<"OVERDUE" | "DUE_TODAY" | "HIGH_PRIORITY" | "BLOCKED">;
    taskId: string;
    title: string;
    kind: "FOLLOW_UP" | "PREPARE_FOR_INTERVIEW" | "RESPOND_TO_RECRUITER" | "OTHER";
    status: "TODO" | "IN_PROGRESS" | "BLOCKED";
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    dueAt: string | null;
    recordVersion: number;
    projectId: string;
    company: string;
    role: string;
    lifecycleState: string;
  }>;
  upcoming: Array<{
    taskId: string;
    title: string;
    kind: string;
    status: "TODO" | "IN_PROGRESS";
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    dueAt: string;
    recordVersion: number;
    projectId: string;
    company: string;
    role: string;
    lifecycleState: string;
  }>;
  applicationsWithoutOpenTask: Array<{
    projectId: string;
    company: string;
    role: string;
    lifecycleState: string;
  }>;
  recentLifecycleChanges: Array<{
    transitionId: string;
    projectId: string;
    company: string;
    role: string;
    fromState: string;
    toState: string;
    admittedAt: string;
  }>; // maximum 5
}
```

Only open Tasks are eligible. Classification compares `dueAt` by calendar
date in the configured Workspace timezone:

- before `date`: `OVERDUE`;
- equal to `date`: `DUE_TODAY`;
- undated and `HIGH`/`CRITICAL`: `HIGH_PRIORITY`;
- status `BLOCKED`: `BLOCKED`;
- local dates from +1 through +7 inclusive: `upcoming`.

An attention Task appears once and carries every applicable reason in the
order above. A blocked future Task is attention rather than upcoming. Attention
sorts by first reason, then priority (`CRITICAL` to `LOW`), due time (null
last), title, and Task ID. Upcoming sorts by due time, priority, title, and Task
ID. Gap signals sort by company, role, and Project ID. Recent lifecycle changes
sort by admitted time descending and transition ID ascending.

## Verification gate

- Focused Task creation, Task update, and Today tests pass.
- All frozen Spike 1A/1B and M1 tests pass unchanged except the additive MCP
  discovery expectation.
- Typecheck, production build, and `git diff --check` pass.
- Platform smoke is a separate readiness step and is not claimed by local
  automated results.
