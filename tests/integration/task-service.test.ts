import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import {
  AuthorizationError,
  ConcurrencyConflictError,
  NotFoundError,
  ValidationError,
} from "../../src/domain/errors.js";
import type { TaskStatus } from "../../src/domain/types.js";
import { openDatabase } from "../../src/persistence/database.js";
import {
  createEmptyTestWorkspace,
  createTestWorkspace,
  testPrincipal,
} from "../helpers/test-workspace.js";

const cleanups: Array<() => void> = [];
const authority = {
  type: "EXPLICIT_USER_DEV" as const,
  confirmed: true as const,
  reference: "Test user explicitly requested the Task mutation",
};

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function workspace() {
  const result = createTestWorkspace({
    clock: () => new Date("2026-09-02T03:04:05.000Z"),
  });
  cleanups.push(result.cleanup);
  return result;
}

function createTask(
  testWorkspace: ReturnType<typeof workspace>,
  suffix: string,
) {
  return testWorkspace.service.taskService.createTask({
    projectId: testWorkspace.projectId,
    title: `Follow up ${suffix}`,
    taskKind: "FOLLOW_UP",
    priority: "MEDIUM",
    dueAt: "2026-09-03T09:00:00+10:00",
    authority,
    idempotencyKey: `create-${suffix}`,
  });
}

describe("TaskService creation", () => {
  it("creates a Task for an ACTIVE Project from the real M1 path and persists both across reopen", () => {
    const testWorkspace = createEmptyTestWorkspace({ fileBacked: true });
    cleanups.push(testWorkspace.cleanup);
    const creation = testWorkspace.service.createJobApplication({
      company: "M2 Smoke Co",
      role: "Platform Engineer",
      authority,
      idempotencyKey: "m1-create-for-task-regression",
    });
    if (creation.creationStatus !== "CREATED") {
      throw new Error("Expected the M1 creation path to create a Project");
    }

    const projectId = creation.project.id;
    expect(testWorkspace.service.getProject(projectId).project).toMatchObject({
      id: projectId,
      status: "ACTIVE",
      lifecycleState: "APPLIED",
    });

    const command = {
      projectId,
      title: "Send M2 follow-up",
      taskKind: "FOLLOW_UP" as const,
      priority: "HIGH" as const,
      dueAt: null,
      authority,
      idempotencyKey: "m2-create-task-on-m1-project",
    };
    const created = testWorkspace.service.taskService.createTask(command);
    const replay = testWorkspace.service.taskService.createTask(command);

    expect(created).toMatchObject({
      task: { projectId, title: "Send M2 follow-up", dueAt: null },
      replayed: false,
    });
    expect(replay).toMatchObject({
      task: { id: created.task.id },
      replayed: true,
    });
    expect(
      testWorkspace.database
        .prepare("SELECT COUNT(*) AS count FROM tasks WHERE project_id = ?")
        .get(projectId),
    ).toEqual({ count: 1 });

    testWorkspace.database.close();
    const reopenedDatabase = openDatabase(
      testWorkspace.databasePath,
      resolve("db/migrations"),
    );
    try {
      const reopenedService = new WorkspaceService(
        reopenedDatabase,
        testPrincipal,
      );
      reopenedService.ensureDevelopmentIdentity();
      const persisted = reopenedService.getProject(projectId);
      expect(persisted.project).toMatchObject({
        id: projectId,
        status: "ACTIVE",
        lifecycleState: "APPLIED",
      });
      expect(persisted.openTasks).toEqual([
        expect.objectContaining({
          id: created.task.id,
          projectId,
          title: "Send M2 follow-up",
        }),
      ]);
    } finally {
      reopenedDatabase.close();
    }
  });

  it("creates an authorized, Project-scoped, versioned manual Task", () => {
    const testWorkspace = workspace();
    const result = createTask(testWorkspace, "authorized");

    expect(result).toMatchObject({
      replayed: false,
      task: {
        projectId: testWorkspace.projectId,
        title: "Follow up authorized",
        taskKind: "FOLLOW_UP",
        status: "TODO",
        priority: "MEDIUM",
        dueAt: "2026-09-02T23:00:00.000Z",
        recordVersion: 1,
        createdBy: "USER",
        updatedBy: "USER",
        completedAt: null,
        sourceTransitionId: null,
      },
    });
  });

  it("rejects missing explicit authority with zero Task writes", () => {
    const testWorkspace = workspace();
    expect(() =>
      testWorkspace.service.taskService.createTask({
        projectId: testWorkspace.projectId,
        title: "Unauthorized",
        taskKind: "OTHER",
        priority: "LOW",
        authority: { ...authority, reference: "" },
        idempotencyKey: "unauthorized-create",
      }),
    ).toThrow(AuthorizationError);
    expect(
      testWorkspace.database.prepare("SELECT COUNT(*) AS count FROM tasks").get(),
    ).toEqual({ count: 0 });
  });

  it("rejects Projects outside the current Workspace and unknown Projects", () => {
    const testWorkspace = workspace();
    const other = new WorkspaceService(testWorkspace.database, {
      issuer: "other-test-suite",
      subject: "other-user",
      workspaceName: "Other Workspace",
    });
    other.ensureDevelopmentIdentity();

    expect(() =>
      other.taskService.createTask({
        projectId: testWorkspace.projectId,
        title: "Cross Workspace",
        taskKind: "OTHER",
        priority: "LOW",
        authority,
        idempotencyKey: "cross-workspace-create",
      }),
    ).toThrow(NotFoundError);
    expect(() =>
      testWorkspace.service.taskService.createTask({
        projectId: randomUUID(),
        title: "Unknown Project",
        taskKind: "OTHER",
        priority: "LOW",
        authority,
        idempotencyKey: "unknown-project-create",
      }),
    ).toThrow(NotFoundError);
  });

  it("replays an exact retry without creating a duplicate", () => {
    const testWorkspace = workspace();
    const first = createTask(testWorkspace, "retry");
    const replay = createTask(testWorkspace, "retry");

    expect(replay.task.id).toBe(first.task.id);
    expect(replay.replayed).toBe(true);
    expect(
      testWorkspace.database.prepare("SELECT COUNT(*) AS count FROM tasks").get(),
    ).toEqual({ count: 1 });
  });

  it("does not duplicate open work already owned by an admitted transition", () => {
    const testWorkspace = workspace();
    const observation = testWorkspace.service.recordObservation({
      projectId: testWorkspace.projectId,
      resourceType: "EMAIL",
      provider: "task-test-mail",
      externalId: "source-owned-message",
      externalUri: null,
      title: "Recruiter replied",
      observedFacts: { recruiterReplied: true },
      observedAt: "2026-09-02T01:00:00Z",
      idempotencyKey: "source-owned-observation",
    });
    const proposal = testWorkspace.service.proposeTransition({
      projectId: testWorkspace.projectId,
      expectedLifecycleVersion: 1,
      toState: "RECRUITER_CONTACT",
      triggerType: "EXTERNAL_EVIDENCE",
      evidenceResourceIds: [observation.resource.id],
      rationale: "Recruiter made contact",
      idempotencyKey: "source-owned-proposal",
    });
    testWorkspace.service.admitTransition({
      transitionId: proposal.transition.id,
      expectedLifecycleVersion: 1,
      authority,
      idempotencyKey: "source-owned-admission",
    });

    expect(() =>
      testWorkspace.service.taskService.createTask({
        projectId: testWorkspace.projectId,
        title: "A second recruiter response",
        taskKind: "RESPOND_TO_RECRUITER",
        priority: "HIGH",
        authority,
        idempotencyKey: "duplicate-source-owned-task",
      }),
    ).toThrow(/transition-derived/u);
    expect(
      testWorkspace.database.prepare("SELECT COUNT(*) AS count FROM tasks").get(),
    ).toEqual({ count: 1 });
  });
});

describe("TaskService updates", () => {
  it.each([
    ["TODO", "IN_PROGRESS"],
    ["TODO", "BLOCKED"],
    ["IN_PROGRESS", "BLOCKED"],
    ["TODO", "DONE"],
    ["IN_PROGRESS", "DONE"],
    ["BLOCKED", "DONE"],
    ["TODO", "CANCELLED"],
    ["IN_PROGRESS", "CANCELLED"],
    ["BLOCKED", "CANCELLED"],
  ] as const)("supports %s -> %s", (fromStatus, toStatus) => {
    const testWorkspace = workspace();
    let task = createTask(testWorkspace, `${fromStatus}-${toStatus}`).task;
    if (fromStatus !== "TODO") {
      task = testWorkspace.service.taskService.updateTask({
        taskId: task.id,
        expectedRecordVersion: task.recordVersion,
        status: fromStatus,
        authority,
        idempotencyKey: `move-to-${fromStatus}-${toStatus}`,
      }).task;
    }

    const updated = testWorkspace.service.taskService.updateTask({
      taskId: task.id,
      expectedRecordVersion: task.recordVersion,
      status: toStatus,
      authority,
      idempotencyKey: `move-to-${toStatus}-${fromStatus}`,
    }).task;

    expect(updated.status).toBe(toStatus);
    expect(updated.recordVersion).toBe(task.recordVersion + 1);
    expect(updated.completedAt).toBe(
      toStatus === "DONE" ? "2026-09-02T03:04:05.000Z" : null,
    );
  });

  it.each(["DONE", "CANCELLED"] as const)(
    "rejects reopening or editing a terminal %s Task",
    (terminalStatus) => {
      const testWorkspace = workspace();
      const created = createTask(testWorkspace, `terminal-${terminalStatus}`);
      const terminal = testWorkspace.service.taskService.updateTask({
        taskId: created.task.id,
        expectedRecordVersion: 1,
        status: terminalStatus,
        authority,
        idempotencyKey: `terminal-${terminalStatus}`,
      }).task;

      expect(() =>
        testWorkspace.service.taskService.updateTask({
          taskId: terminal.id,
          expectedRecordVersion: terminal.recordVersion,
          status: "TODO",
          authority,
          idempotencyKey: `reopen-${terminalStatus}`,
        }),
      ).toThrow(ValidationError);
      expect(() =>
        testWorkspace.service.taskService.updateTask({
          taskId: terminal.id,
          expectedRecordVersion: terminal.recordVersion,
          priority: "CRITICAL",
          authority,
          idempotencyKey: `edit-${terminalStatus}`,
        }),
      ).toThrow(ValidationError);
    },
  );

  it("increments recordVersion, rejects stale writes, and replays exact retries", () => {
    const testWorkspace = workspace();
    const created = createTask(testWorkspace, "versioning");
    const command = {
      taskId: created.task.id,
      expectedRecordVersion: 1,
      status: "IN_PROGRESS" as TaskStatus,
      priority: "HIGH" as const,
      dueAt: null,
      authority,
      idempotencyKey: "update-versioning",
    };
    const updated = testWorkspace.service.taskService.updateTask(command);
    const replay = testWorkspace.service.taskService.updateTask(command);

    expect(updated.task.recordVersion).toBe(2);
    expect(updated.task.dueAt).toBeNull();
    expect(replay.task).toEqual(updated.task);
    expect(replay.replayed).toBe(true);
    expect(() =>
      testWorkspace.service.taskService.updateTask({
        taskId: created.task.id,
        expectedRecordVersion: 1,
        priority: "CRITICAL",
        authority,
        idempotencyKey: "stale-versioning",
      }),
    ).toThrow(ConcurrencyConflictError);
  });

  it("rejects an update without explicit user authority", () => {
    const testWorkspace = workspace();
    const created = createTask(testWorkspace, "update-authority");
    expect(() =>
      testWorkspace.service.taskService.updateTask({
        taskId: created.task.id,
        expectedRecordVersion: 1,
        status: "IN_PROGRESS",
        authority: { ...authority, reference: "" },
        idempotencyKey: "unauthorized-update",
      }),
    ).toThrow(AuthorizationError);
    expect(
      testWorkspace.service.getProject(testWorkspace.projectId).openTasks[0],
    ).toMatchObject({ status: "TODO", recordVersion: 1 });
  });
});
