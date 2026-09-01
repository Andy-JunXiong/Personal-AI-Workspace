import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import {
  AuthorizationError,
  ConcurrencyConflictError,
} from "../../src/domain/errors.js";
import { openDatabase } from "../../src/persistence/database.js";
import { spikeFixture } from "../../src/spike-fixture.js";
import {
  createTestWorkspace,
  testPrincipal,
} from "../helpers/test-workspace.js";

const activeCleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of activeCleanups.splice(0)) {
    cleanup();
  }
});

function workspace(options?: { fileBacked?: boolean }) {
  const result = createTestWorkspace(options);
  activeCleanups.push(result.cleanup);
  return result;
}

function recordRecruiterObservation(
  service: WorkspaceService,
  projectId: string,
  idempotencyKey = "observation-1",
) {
  return service.recordObservation({
    projectId,
    resourceType: "EMAIL",
    provider: "test-mail",
    externalId: "message-001",
    externalUri: "https://example.test/messages/001",
    title: "Recruiter follow-up",
    observedFacts: { recruiterReplied: true },
    observedAt: "2026-09-02T01:00:00.000Z",
    idempotencyKey,
  });
}

describe("WorkspaceService persistence and transition flow", () => {
  it("persists the seeded Project outside a service/process lifetime", () => {
    const testWorkspace = workspace({ fileBacked: true });
    const before = testWorkspace.service.getProject(testWorkspace.projectId);
    testWorkspace.database.close();

    const reopenedDatabase = openDatabase(testWorkspace.databasePath);
    const reopenedService = new WorkspaceService(reopenedDatabase, testPrincipal);
    const after = reopenedService.getProject(testWorkspace.projectId);
    reopenedDatabase.close();

    expect(after.project.id).toBe(before.project.id);
    expect(after.project.lifecycleState).toBe("APPLIED");
    expect(after.project.lifecycleVersion).toBe(1);
    expect(after.transitions).toHaveLength(1);
    expect(after.transitions[0]?.status).toBe("ADMITTED");
  });

  it("records an observation without mutating Project lifecycle", () => {
    const testWorkspace = workspace();
    const result = recordRecruiterObservation(
      testWorkspace.service,
      testWorkspace.projectId,
    );
    const details = testWorkspace.service.getProject(testWorkspace.projectId);

    expect(result.projectStateChanged).toBe(false);
    expect(details.resources).toHaveLength(1);
    expect(details.project.lifecycleState).toBe("APPLIED");
    expect(details.project.lifecycleVersion).toBe(1);
  });

  it("separates proposal validation from explicit-user admission", () => {
    const testWorkspace = workspace();
    const observation = recordRecruiterObservation(
      testWorkspace.service,
      testWorkspace.projectId,
    );
    const proposal = testWorkspace.service.proposeTransition({
      projectId: testWorkspace.projectId,
      expectedLifecycleVersion: 1,
      toState: "RECRUITER_CONTACT",
      triggerType: "EXTERNAL_EVIDENCE",
      evidenceResourceIds: [observation.resource.id],
      rationale: "The recruiter sent a meaningful progression message.",
      idempotencyKey: "proposal-1",
    });

    const beforeAdmission = testWorkspace.service.getProject(
      testWorkspace.projectId,
    );
    expect(proposal.transition.status).toBe("PROPOSED");
    expect(proposal.projectStateChanged).toBe(false);
    expect(beforeAdmission.project.lifecycleState).toBe("APPLIED");
    expect(beforeAdmission.openTasks).toHaveLength(0);

    const admitted = testWorkspace.service.admitTransition({
      transitionId: proposal.transition.id,
      expectedLifecycleVersion: 1,
      authority: {
        type: "EXPLICIT_USER_DEV",
        confirmed: true,
        reference: "Test user explicitly confirmed admission",
      },
      idempotencyKey: "admission-1",
    });

    expect(admitted.project.lifecycleState).toBe("RECRUITER_CONTACT");
    expect(admitted.project.lifecycleVersion).toBe(2);
    expect(admitted.transition.status).toBe("ADMITTED");
    expect(admitted.transition.admittedBy).toBe("USER");
    expect(admitted.transition.admissionAuthorityType).toBe(
      "EXPLICIT_USER_DEV",
    );
    expect(admitted.derivedTask?.taskKind).toBe("RESPOND_TO_RECRUITER");
  });

  it("rejects admission without an explicit user authority reference", () => {
    const testWorkspace = workspace();
    const observation = recordRecruiterObservation(
      testWorkspace.service,
      testWorkspace.projectId,
    );
    const proposal = testWorkspace.service.proposeTransition({
      projectId: testWorkspace.projectId,
      expectedLifecycleVersion: 1,
      toState: "RECRUITER_CONTACT",
      triggerType: "EXTERNAL_EVIDENCE",
      evidenceResourceIds: [observation.resource.id],
      rationale: "Recruiter replied.",
      idempotencyKey: "proposal-auth",
    });

    expect(() =>
      testWorkspace.service.admitTransition({
        transitionId: proposal.transition.id,
        expectedLifecycleVersion: 1,
        authority: {
          type: "EXPLICIT_USER_DEV",
          confirmed: true,
          reference: "",
        },
        idempotencyKey: "admission-auth",
      }),
    ).toThrow(AuthorizationError);

    expect(
      testWorkspace.service.getProject(testWorkspace.projectId).project
        .lifecycleState,
    ).toBe("APPLIED");
  });

  it("uses optimistic concurrency to reject a stale distinct proposal", () => {
    const testWorkspace = workspace();
    const observation = recordRecruiterObservation(
      testWorkspace.service,
      testWorkspace.projectId,
    );
    const base = {
      projectId: testWorkspace.projectId,
      expectedLifecycleVersion: 1,
      toState: "RECRUITER_CONTACT" as const,
      triggerType: "EXTERNAL_EVIDENCE" as const,
      evidenceResourceIds: [observation.resource.id],
    };
    const first = testWorkspace.service.proposeTransition({
      ...base,
      rationale: "First exact proposal",
      idempotencyKey: "proposal-first",
    });
    const stale = testWorkspace.service.proposeTransition({
      ...base,
      rationale: "Distinct proposal created at the same version",
      idempotencyKey: "proposal-stale",
    });

    testWorkspace.service.admitTransition({
      transitionId: first.transition.id,
      expectedLifecycleVersion: 1,
      authority: {
        type: "EXPLICIT_USER_DEV",
        confirmed: true,
        reference: "Explicit test authority",
      },
      idempotencyKey: "admit-first",
    });

    expect(() =>
      testWorkspace.service.admitTransition({
        transitionId: stale.transition.id,
        expectedLifecycleVersion: 1,
        authority: {
          type: "EXPLICIT_USER_DEV",
          confirmed: true,
          reference: "Explicit test authority",
        },
        idempotencyKey: "admit-stale",
      }),
    ).toThrow(ConcurrencyConflictError);

    const details = testWorkspace.service.getProject(testWorkspace.projectId);
    expect(details.project.lifecycleVersion).toBe(2);
    expect(details.openTasks).toHaveLength(1);
  });

  it("keeps the configured principal mapped to one Workspace", () => {
    const testWorkspace = workspace();
    const first = testWorkspace.service.ensureDevelopmentIdentity();
    const second = testWorkspace.service.ensureDevelopmentIdentity();

    expect(first).toEqual(second);
    expect(
      testWorkspace.database
        .prepare("SELECT COUNT(*) AS count FROM principals")
        .get(),
    ).toEqual({ count: 1 });
    expect(
      testWorkspace.database
        .prepare("SELECT COUNT(*) AS count FROM workspaces")
        .get(),
    ).toEqual({ count: 1 });
  });

  it("keeps the fixture Project ID stable", () => {
    const testWorkspace = workspace();
    expect(testWorkspace.projectId).toBe(spikeFixture.projectId);
  });
});
