import { afterEach, describe, expect, it } from "vitest";
import type { WorkspaceService } from "../../src/application/workspace-service.js";
import {
  isAllowedTransition,
  isTerminalLifecycleState,
} from "../../src/domain/job-application-lifecycle.js";
import type {
  LifecycleState,
  TaskKind,
  TaskRecord,
} from "../../src/domain/types.js";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";

const activeCleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of activeCleanups.splice(0)) cleanup();
});

function workspace() {
  const result = createEmptyTestWorkspace();
  activeCleanups.push(result.cleanup);
  return result;
}

const authority = {
  type: "EXPLICIT_USER_DEV" as const,
  confirmed: true as const,
  reference: "M3 test user explicitly authorized this admission",
};

const allStates: LifecycleState[] = [
  "APPLIED",
  "RECRUITER_CONTACT",
  "INTERVIEWING",
  "OFFER",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

const approvedEdges: Array<{
  from: LifecycleState;
  to: LifecycleState;
  prefix: LifecycleState[];
  derivedTaskKind: TaskKind | null;
}> = [
  {
    from: "APPLIED",
    to: "RECRUITER_CONTACT",
    prefix: [],
    derivedTaskKind: "RESPOND_TO_RECRUITER",
  },
  {
    from: "APPLIED",
    to: "INTERVIEWING",
    prefix: [],
    derivedTaskKind: "PREPARE_FOR_INTERVIEW",
  },
  { from: "APPLIED", to: "REJECTED", prefix: [], derivedTaskKind: null },
  { from: "APPLIED", to: "WITHDRAWN", prefix: [], derivedTaskKind: null },
  {
    from: "RECRUITER_CONTACT",
    to: "INTERVIEWING",
    prefix: ["RECRUITER_CONTACT"],
    derivedTaskKind: "PREPARE_FOR_INTERVIEW",
  },
  {
    from: "RECRUITER_CONTACT",
    to: "REJECTED",
    prefix: ["RECRUITER_CONTACT"],
    derivedTaskKind: null,
  },
  {
    from: "RECRUITER_CONTACT",
    to: "WITHDRAWN",
    prefix: ["RECRUITER_CONTACT"],
    derivedTaskKind: null,
  },
  {
    from: "INTERVIEWING",
    to: "OFFER",
    prefix: ["INTERVIEWING"],
    derivedTaskKind: "REVIEW_OFFER",
  },
  {
    from: "INTERVIEWING",
    to: "REJECTED",
    prefix: ["INTERVIEWING"],
    derivedTaskKind: null,
  },
  {
    from: "INTERVIEWING",
    to: "WITHDRAWN",
    prefix: ["INTERVIEWING"],
    derivedTaskKind: null,
  },
  {
    from: "OFFER",
    to: "ACCEPTED",
    prefix: ["INTERVIEWING", "OFFER"],
    derivedTaskKind: null,
  },
  {
    from: "OFFER",
    to: "REJECTED",
    prefix: ["INTERVIEWING", "OFFER"],
    derivedTaskKind: null,
  },
  {
    from: "OFFER",
    to: "WITHDRAWN",
    prefix: ["INTERVIEWING", "OFFER"],
    derivedTaskKind: null,
  },
];

const pathToState: Record<LifecycleState, LifecycleState[]> = {
  APPLIED: [],
  RECRUITER_CONTACT: ["RECRUITER_CONTACT"],
  INTERVIEWING: ["INTERVIEWING"],
  OFFER: ["INTERVIEWING", "OFFER"],
  ACCEPTED: ["INTERVIEWING", "OFFER", "ACCEPTED"],
  REJECTED: ["REJECTED"],
  WITHDRAWN: ["WITHDRAWN"],
};

const rejectedEdges = allStates.flatMap((from) =>
  allStates
    .filter((to) => !isAllowedTransition(from, to))
    .map((to) => ({ from, to })),
);

function createApplication(service: WorkspaceService, suffix: string) {
  const result = service.createJobApplication({
    company: `M3 ${suffix} Co`,
    role: "Lifecycle Tester",
    authority,
    idempotencyKey: `create-${suffix}`,
  });
  if (result.creationStatus !== "CREATED") {
    throw new Error("Expected a newly created M3 application");
  }
  return result.project;
}

function proposeAndAdmit(
  service: WorkspaceService,
  projectId: string,
  expectedLifecycleVersion: number,
  toState: LifecycleState,
  key: string,
) {
  const proposal = service.proposeTransition({
    projectId,
    expectedLifecycleVersion,
    toState,
    triggerType: "USER_ASSERTION",
    evidenceResourceIds: [],
    rationale: `M3 test transition to ${toState}`,
    idempotencyKey: `propose-${key}`,
  });
  expect(proposal.transition.status).toBe("PROPOSED");
  expect(proposal.projectStateChanged).toBe(false);

  return service.admitTransition({
    transitionId: proposal.transition.id,
    expectedLifecycleVersion,
    authority,
    idempotencyKey: `admit-${key}`,
  });
}

function followPath(
  service: WorkspaceService,
  projectId: string,
  path: LifecycleState[],
  key: string,
) {
  let version = 1;
  for (const [index, toState] of path.entries()) {
    proposeAndAdmit(service, projectId, version, toState, `${key}-${index}`);
    version += 1;
  }
  return version;
}

function createManualTask(
  service: WorkspaceService,
  projectId: string,
  title: string,
): TaskRecord {
  return service.taskService.createTask({
    projectId,
    title,
    taskKind: "OTHER",
    priority: "MEDIUM",
    authority,
    idempotencyKey: `create-task-${title}`,
  }).task;
}

describe("Real Job Search Slice M3 lifecycle", () => {
  it.each(approvedEdges)(
    "admits $from -> $to with only its approved derived effect",
    ({ from, to, prefix, derivedTaskKind }) => {
      const testWorkspace = workspace();
      const project = createApplication(
        testWorkspace.service,
        `${from.toLowerCase()}-${to.toLowerCase()}`,
      );
      const version = followPath(
        testWorkspace.service,
        project.id,
        prefix,
        `${from}-${to}-prefix`,
      );
      const before = testWorkspace.service.getProject(project.id);
      expect(before.project.lifecycleState).toBe(from);

      const proposal = testWorkspace.service.proposeTransition({
        projectId: project.id,
        expectedLifecycleVersion: version,
        toState: to,
        triggerType: "USER_ASSERTION",
        evidenceResourceIds: [],
        rationale: `Test approved ${from} to ${to}`,
        idempotencyKey: `propose-approved-${from}-${to}`,
      });
      const stillBeforeAdmission = testWorkspace.service.getProject(project.id);
      expect(proposal.transition.status).toBe("PROPOSED");
      expect(stillBeforeAdmission.project.lifecycleState).toBe(from);
      expect(stillBeforeAdmission.project.lifecycleVersion).toBe(version);

      const admitted = testWorkspace.service.admitTransition({
        transitionId: proposal.transition.id,
        expectedLifecycleVersion: version,
        authority,
        idempotencyKey: `admit-approved-${from}-${to}`,
      });

      expect(admitted.project.lifecycleState).toBe(to);
      expect(admitted.project.lifecycleVersion).toBe(version + 1);
      expect(admitted.project.status).toBe(
        isTerminalLifecycleState(to) ? "CLOSED" : "ACTIVE",
      );
      expect(admitted.derivedTask?.taskKind ?? null).toBe(derivedTaskKind);
      expect(admitted.derivedTask?.priority ?? null).toBe(
        derivedTaskKind ? "HIGH" : null,
      );
      if (isTerminalLifecycleState(to)) {
        expect(testWorkspace.service.getProject(project.id).openTasks).toEqual([]);
      }
    },
  );

  it.each(rejectedEdges)(
    "persists $from -> $to as rejected without changing Project state",
    ({ from, to }) => {
      const testWorkspace = workspace();
      const project = createApplication(
        testWorkspace.service,
        `reject-${from.toLowerCase()}-${to.toLowerCase()}`,
      );
      const version = followPath(
        testWorkspace.service,
        project.id,
        pathToState[from],
        `reach-${from}-${to}`,
      );
      const before = testWorkspace.service.getProject(project.id).project;
      expect(before.lifecycleState).toBe(from);

      const result = testWorkspace.service.proposeTransition({
        projectId: project.id,
        expectedLifecycleVersion: version,
        toState: to,
        triggerType: "USER_ASSERTION",
        evidenceResourceIds: [],
        rationale: `Test rejected ${from} to ${to}`,
        idempotencyKey: `reject-${from}-${to}`,
      });
      const after = testWorkspace.service.getProject(project.id).project;

      expect(result.transition.status).toBe("REJECTED");
      expect(result.transition.rejectionReason).toContain("is not allowed");
      expect(after.lifecycleState).toBe(from);
      expect(after.lifecycleVersion).toBe(version);
      expect(after.status).toBe(before.status);
    },
  );

  it("creates exactly one REVIEW_OFFER Task across admission retries", () => {
    const testWorkspace = workspace();
    const project = createApplication(testWorkspace.service, "offer-retry");
    const version = followPath(
      testWorkspace.service,
      project.id,
      ["INTERVIEWING"],
      "offer-retry-prefix",
    );
    const proposal = testWorkspace.service.proposeTransition({
      projectId: project.id,
      expectedLifecycleVersion: version,
      toState: "OFFER",
      triggerType: "USER_ASSERTION",
      evidenceResourceIds: [],
      rationale: "Test REVIEW_OFFER retry safety",
      idempotencyKey: "propose-offer-retry",
    });

    const admitted = testWorkspace.service.admitTransition({
      transitionId: proposal.transition.id,
      expectedLifecycleVersion: version,
      authority,
      idempotencyKey: "admit-offer-retry",
    });
    const replay = testWorkspace.service.admitTransition({
      transitionId: proposal.transition.id,
      expectedLifecycleVersion: version,
      authority,
      idempotencyKey: "admit-offer-retry",
    });
    const repeatedWithNewKey = testWorkspace.service.admitTransition({
      transitionId: proposal.transition.id,
      expectedLifecycleVersion: version,
      authority,
      idempotencyKey: "admit-offer-retry-new-key",
    });

    expect(admitted.derivedTask).toMatchObject({
      taskKind: "REVIEW_OFFER",
      title: "Review offer",
      priority: "HIGH",
      sourceTransitionId: proposal.transition.id,
    });
    expect(replay).toMatchObject({
      replayed: true,
      derivedTask: { id: admitted.derivedTask?.id },
    });
    expect(repeatedWithNewKey).toMatchObject({
      alreadyAdmitted: true,
      replayed: false,
      derivedTask: { id: admitted.derivedTask?.id },
    });
    expect(
      testWorkspace.database
        .prepare(
          `SELECT COUNT(*) AS count FROM tasks
           WHERE project_id = ? AND task_kind = 'REVIEW_OFFER'`,
        )
        .get(project.id),
    ).toEqual({ count: 1 });
  });

  it("atomically closes a terminal Project and cancels only obsolete open Tasks", () => {
    const testWorkspace = workspace();
    const project = createApplication(testWorkspace.service, "terminal-effects");
    const todo = createManualTask(testWorkspace.service, project.id, "Todo work");
    const inProgressBase = createManualTask(
      testWorkspace.service,
      project.id,
      "In progress work",
    );
    const inProgress = testWorkspace.service.taskService.updateTask({
      taskId: inProgressBase.id,
      expectedRecordVersion: 1,
      status: "IN_PROGRESS",
      authority,
      idempotencyKey: "start-in-progress-work",
    }).task;
    const doneBase = createManualTask(testWorkspace.service, project.id, "Done work");
    const done = testWorkspace.service.taskService.updateTask({
      taskId: doneBase.id,
      expectedRecordVersion: 1,
      status: "DONE",
      authority,
      idempotencyKey: "complete-done-work",
    }).task;

    const proposal = testWorkspace.service.proposeTransition({
      projectId: project.id,
      expectedLifecycleVersion: 1,
      toState: "REJECTED",
      triggerType: "USER_ASSERTION",
      evidenceResourceIds: [],
      rationale: "The application was rejected",
      idempotencyKey: "propose-terminal-effects",
    });
    const admitted = testWorkspace.service.admitTransition({
      transitionId: proposal.transition.id,
      expectedLifecycleVersion: 1,
      authority,
      idempotencyKey: "admit-terminal-effects",
    });

    expect(admitted.project).toMatchObject({
      status: "CLOSED",
      lifecycleState: "REJECTED",
      lifecycleVersion: 2,
    });
    expect(admitted.derivedTask).toBeNull();
    expect(testWorkspace.service.getProject(project.id).openTasks).toEqual([]);
    expect(testWorkspace.service.listJobApplications().applications).toEqual([]);
    expect(testWorkspace.service.listJobApplications(true).applications).toHaveLength(
      1,
    );

    const taskRows = testWorkspace.database
      .prepare(
        `SELECT id, status, record_version, updated_by, completed_at
         FROM tasks WHERE project_id = ? ORDER BY title`,
      )
      .all(project.id) as Array<{
        id: string;
        status: string;
        record_version: number;
        updated_by: string;
        completed_at: string | null;
      }>;
    const rowFor = (taskId: string) => taskRows.find((row) => row.id === taskId);

    expect(rowFor(todo.id)).toMatchObject({
      status: "CANCELLED",
      record_version: 2,
      updated_by: "SYSTEM",
      completed_at: null,
    });
    expect(rowFor(inProgress.id)).toMatchObject({
      status: "CANCELLED",
      record_version: 3,
      updated_by: "SYSTEM",
      completed_at: null,
    });
    expect(rowFor(done.id)).toMatchObject({
      status: "DONE",
      record_version: 2,
      updated_by: "USER",
      completed_at: done.completedAt,
    });

    const replay = testWorkspace.service.admitTransition({
      transitionId: proposal.transition.id,
      expectedLifecycleVersion: 1,
      authority,
      idempotencyKey: "admit-terminal-effects",
    });
    expect(replay.replayed).toBe(true);
    expect(
      testWorkspace.database
        .prepare("SELECT COUNT(*) AS count FROM state_transitions WHERE id = ?")
        .get(proposal.transition.id),
    ).toEqual({ count: 1 });
    expect(
      testWorkspace.database
        .prepare("SELECT COUNT(*) AS count FROM tasks WHERE project_id = ?")
        .get(project.id),
    ).toEqual({ count: 3 });

    const repeatedWithNewKey = testWorkspace.service.admitTransition({
      transitionId: proposal.transition.id,
      expectedLifecycleVersion: 1,
      authority,
      idempotencyKey: "admit-terminal-effects-new-key",
    });
    expect(repeatedWithNewKey).toMatchObject({
      alreadyAdmitted: true,
      replayed: false,
      project: { status: "CLOSED", lifecycleState: "REJECTED" },
    });
    const versionsAfterRepeat = testWorkspace.database
      .prepare(
        "SELECT id, record_version FROM tasks WHERE project_id = ? ORDER BY id",
      )
      .all(project.id);
    expect(versionsAfterRepeat).toEqual(
      taskRows
        .map((row) => ({ id: row.id, record_version: row.record_version }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
  });

  it("keeps REVIEW_OFFER source-owned instead of expanding manual M2 Task creation", () => {
    const testWorkspace = workspace();
    const project = createApplication(
      testWorkspace.service,
      "source-owned-offer",
    );

    expect(() =>
      testWorkspace.service.taskService.createTask({
        projectId: project.id,
        title: "Manual review offer",
        taskKind: "REVIEW_OFFER",
        priority: "HIGH",
        authority,
        idempotencyKey: "manual-review-offer",
      }),
    ).toThrow("Unsupported taskKind: REVIEW_OFFER");

    expect(testWorkspace.service.getProject(project.id).openTasks).toEqual([]);
  });

  it("rolls back lifecycle, transition, and Task cancellation if admission cannot commit", () => {
    const testWorkspace = workspace();
    const project = createApplication(testWorkspace.service, "atomic-rollback");
    const task = createManualTask(
      testWorkspace.service,
      project.id,
      "Keep on rollback",
    );
    const proposal = testWorkspace.service.proposeTransition({
      projectId: project.id,
      expectedLifecycleVersion: 1,
      toState: "WITHDRAWN",
      triggerType: "USER_ASSERTION",
      evidenceResourceIds: [],
      rationale: "Test rollback",
      idempotencyKey: "propose-atomic-rollback",
    });
    testWorkspace.database.exec(`
      CREATE TRIGGER fail_m3_admission_idempotency
      BEFORE INSERT ON idempotency_records
      WHEN NEW.operation = 'workspace_admit_transition'
      BEGIN
        SELECT RAISE(ABORT, 'forced M3 admission rollback');
      END;
    `);

    expect(() =>
      testWorkspace.service.admitTransition({
        transitionId: proposal.transition.id,
        expectedLifecycleVersion: 1,
        authority,
        idempotencyKey: "admit-atomic-rollback",
      }),
    ).toThrow("forced M3 admission rollback");

    const after = testWorkspace.service.getProject(project.id);
    expect(after.project).toMatchObject({
      status: "ACTIVE",
      lifecycleState: "APPLIED",
      lifecycleVersion: 1,
    });
    expect(
      after.transitions.find((item) => item.id === proposal.transition.id),
    ).toMatchObject({
      status: "PROPOSED",
      toVersion: null,
      admittedAt: null,
    });
    expect(after.openTasks).toMatchObject([
      { id: task.id, status: "TODO", recordVersion: 1 },
    ]);
  });
});
