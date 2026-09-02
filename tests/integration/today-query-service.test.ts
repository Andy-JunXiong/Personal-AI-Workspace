import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import type { TaskPriority, TaskStatus } from "../../src/domain/types.js";
import { createTestWorkspace } from "../helpers/test-workspace.js";

const cleanups: Array<() => void> = [];
const authority = {
  type: "EXPLICIT_USER_DEV" as const,
  confirmed: true as const,
  reference: "Test user explicitly requested this operation",
};

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function workspace(clock: () => Date = () => new Date("2026-09-01T14:30:00Z")) {
  const result = createTestWorkspace({ timeZone: "Australia/Sydney", clock });
  cleanups.push(result.cleanup);
  return result;
}

function addTask(
  testWorkspace: ReturnType<typeof workspace>,
  input: {
    title: string;
    priority?: TaskPriority;
    dueAt?: string | null;
    status?: TaskStatus;
  },
) {
  const created = testWorkspace.service.taskService.createTask({
    projectId: testWorkspace.projectId,
    title: input.title,
    taskKind: "OTHER",
    priority: input.priority ?? "MEDIUM",
    dueAt: input.dueAt,
    authority,
    idempotencyKey: `create-${input.title}`,
  });
  if (input.status && input.status !== "TODO") {
    return testWorkspace.service.taskService.updateTask({
      taskId: created.task.id,
      expectedRecordVersion: 1,
      status: input.status,
      authority,
      idempotencyKey: `status-${input.title}`,
    }).task;
  }
  return created.task;
}

describe("TodayQueryService", () => {
  it("classifies and deterministically orders all Task attention categories", () => {
    const testWorkspace = workspace();
    const overdue = addTask(testWorkspace, {
      title: "Overdue low",
      priority: "LOW",
      dueAt: "2026-09-01T23:59:00+10:00",
      status: "BLOCKED",
    });
    const dueToday = addTask(testWorkspace, {
      title: "Due today critical",
      priority: "CRITICAL",
      dueAt: "2026-09-02T23:59:00+10:00",
    });
    const highUndated = addTask(testWorkspace, {
      title: "High undated",
      priority: "HIGH",
    });
    const blocked = addTask(testWorkspace, {
      title: "Blocked medium",
      priority: "MEDIUM",
      status: "BLOCKED",
    });
    const upcomingOne = addTask(testWorkspace, {
      title: "Upcoming one",
      priority: "LOW",
      dueAt: "2026-09-03T09:00:00+10:00",
    });
    const upcomingSeven = addTask(testWorkspace, {
      title: "Upcoming seven",
      priority: "HIGH",
      dueAt: "2026-09-09T09:00:00+10:00",
    });
    addTask(testWorkspace, {
      title: "Outside upcoming window",
      dueAt: "2026-09-10T09:00:00+10:00",
    });

    const result = testWorkspace.service.todayQueryService.getToday();

    expect(result.date).toBe("2026-09-02");
    expect(result.timeZone).toBe("Australia/Sydney");
    expect(result.attention.map((task) => task.taskId)).toEqual([
      overdue.id,
      dueToday.id,
      highUndated.id,
      blocked.id,
    ]);
    expect(result.attention[0]?.reasons).toEqual(["OVERDUE", "BLOCKED"]);
    expect(result.attention[1]?.reasons).toEqual(["DUE_TODAY"]);
    expect(result.attention[2]?.reasons).toEqual(["HIGH_PRIORITY"]);
    expect(result.attention[3]?.reasons).toEqual(["BLOCKED"]);
    expect(result.upcoming.map((task) => task.taskId)).toEqual([
      upcomingOne.id,
      upcomingSeven.id,
    ]);
    expect(result.attention[0]).toMatchObject({
      taskId: overdue.id,
      kind: "OTHER",
      projectId: testWorkspace.projectId,
      company: "Example Co",
      role: "Software Engineer",
      lifecycleState: "APPLIED",
    });
  });

  it("uses the injected clock and Sydney local-date boundary", () => {
    let instant = new Date("2026-09-01T13:30:00Z"); // 23:30 Sep 1 AEST
    const testWorkspace = workspace(() => instant);
    const boundaryTask = addTask(testWorkspace, {
      title: "Boundary task",
      dueAt: "2026-09-02T00:15:00+10:00",
    });

    const beforeMidnight = testWorkspace.service.todayQueryService.getToday();
    expect(beforeMidnight.date).toBe("2026-09-01");
    expect(beforeMidnight.upcoming.map((task) => task.taskId)).toContain(
      boundaryTask.id,
    );

    instant = new Date("2026-09-01T14:30:00Z"); // 00:30 Sep 2 AEST
    const afterMidnight = testWorkspace.service.todayQueryService.getToday();
    expect(afterMidnight.date).toBe("2026-09-02");
    expect(
      afterMidnight.attention.find((task) => task.taskId === boundaryTask.id)
        ?.reasons,
    ).toEqual(["DUE_TODAY"]);
  });

  it("returns active applications without an open Task as gap signals", () => {
    const testWorkspace = workspace();
    addTask(testWorkspace, { title: "Fixture has work" });
    const created = testWorkspace.service.createJobApplication({
      company: "Gap Co",
      role: "Analyst",
      authority,
      idempotencyKey: "create-gap-application",
    });
    if (created.creationStatus !== "CREATED") {
      throw new Error("Expected a created Job Application");
    }

    const result = testWorkspace.service.todayQueryService.getToday();
    expect(result.applicationsWithoutOpenTask).toEqual([
      {
        projectId: created.project.id,
        company: "Gap Co",
        role: "Analyst",
        lifecycleState: "APPLIED",
      },
    ]);
  });

  it("returns at most five admitted lifecycle changes in deterministic recency order", () => {
    const testWorkspace = workspace();
    const projectIds = [testWorkspace.projectId];
    for (let index = 1; index <= 6; index += 1) {
      const created = testWorkspace.service.createJobApplication({
        company: `Recent ${index}`,
        role: "Engineer",
        authority,
        idempotencyKey: `recent-application-${index}`,
      });
      if (created.creationStatus !== "CREATED") {
        throw new Error("Expected a created Job Application");
      }
      projectIds.push(created.project.id);
    }
    projectIds.forEach((projectId, index) => {
      testWorkspace.database
        .prepare(
          "UPDATE state_transitions SET admitted_at = ? WHERE project_id = ?",
        )
        .run(`2026-08-${String(20 + index).padStart(2, "0")}T00:00:00.000Z`, projectId);
    });

    const result = testWorkspace.service.todayQueryService.getToday();
    expect(result.recentLifecycleChanges).toHaveLength(5);
    expect(result.recentLifecycleChanges.map((change) => change.projectId)).toEqual(
      projectIds.slice(2).reverse(),
    );
    expect(result.recentLifecycleChanges[0]).toMatchObject({
      company: "Recent 6",
      fromState: "NONE",
      toState: "APPLIED",
    });
  });

  it("is Workspace-isolated and performs no writes", () => {
    const testWorkspace = workspace();
    addTask(testWorkspace, { title: "Private work", priority: "HIGH" });
    const countsBefore = databaseCounts(testWorkspace.database);
    const first = testWorkspace.service.todayQueryService.getToday();
    const second = testWorkspace.service.todayQueryService.getToday();
    const countsAfter = databaseCounts(testWorkspace.database);

    expect(second).toEqual(first);
    expect(countsAfter).toEqual(countsBefore);

    const other = new WorkspaceService(
      testWorkspace.database,
      {
        issuer: "today-other-suite",
        subject: "other-user",
        workspaceName: "Other Workspace",
      },
      {
        timeZone: "Australia/Sydney",
        clock: () => new Date("2026-09-01T14:30:00Z"),
      },
    );
    other.ensureDevelopmentIdentity();
    expect(other.todayQueryService.getToday()).toMatchObject({
      attention: [],
      upcoming: [],
      applicationsWithoutOpenTask: [],
      recentLifecycleChanges: [],
    });
  });
});

function databaseCounts(database: ReturnType<typeof workspace>["database"]) {
  return database
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM tasks) AS tasks,
         (SELECT COUNT(*) FROM projects) AS projects,
         (SELECT COUNT(*) FROM state_transitions) AS transitions,
         (SELECT COUNT(*) FROM idempotency_records) AS idempotency_records`,
    )
    .get();
}
