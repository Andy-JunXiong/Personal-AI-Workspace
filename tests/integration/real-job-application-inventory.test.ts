import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import {
  ConcurrencyConflictError,
  IdempotencyConflictError,
  NotFoundError,
} from "../../src/domain/errors.js";
import {
  createEmptyTestWorkspace,
  testPrincipal,
} from "../helpers/test-workspace.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function setup() {
  const workspace = createEmptyTestWorkspace();
  cleanups.push(workspace.cleanup);
  return workspace;
}

function createApplication(
  service: WorkspaceService,
  idempotencyKey = "create-example-role",
) {
  return service.createJobApplication({
    company: "  Example   Co  ",
    role: " Software\tEngineer ",
    appliedDate: "2026-09-01",
    location: " Sydney, NSW ",
    postingReference:
      "https://jobs.example.test/roles/123?tracking=secret#description",
    authority: {
      type: "EXPLICIT_USER_DEV",
      confirmed: true,
      reference: "User requested registration of this application",
    },
    idempotencyKey,
  });
}

describe("Real Job Search MVP Slice M1 inventory", () => {
  it("creates an APPLIED Job Application with attributable initial admission", () => {
    const workspace = setup();

    const created = createApplication(workspace.service);
    const replay = createApplication(workspace.service);

    expect(created.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.project.id).toBe(created.project.id);
    expect(created.project).toMatchObject({
      title: "Example Co — Software Engineer",
      projectType: "job_application",
      status: "ACTIVE",
      lifecycleState: "APPLIED",
      lifecycleVersion: 1,
      recordVersion: 1,
      metadata: {
        company: "Example Co",
        role: "Software Engineer",
        appliedDate: "2026-09-01",
        location: "Sydney, NSW",
        postingReference: "https://jobs.example.test/roles/123",
      },
    });
    expect(created.initialTransition).toMatchObject({
      fromState: "NONE",
      toState: "APPLIED",
      fromVersion: 0,
      toVersion: 1,
      triggerType: "USER_ASSERTION",
      status: "ADMITTED",
      admittedBy: "USER",
      admissionAuthorityType: "EXPLICIT_USER_DEV",
      admissionAuthorityReference:
        "User requested registration of this application",
    });
    expect(
      workspace.database.prepare("SELECT COUNT(*) AS count FROM projects").get(),
    ).toEqual({ count: 1 });
    expect(
      workspace.service.findJobApplication("example co", "SOFTWARE ENGINEER"),
    ).toMatchObject({
      matchStatus: "EXACT",
      matches: [{ projectId: created.project.id }],
    });
  });

  it("rejects registration without explicit user authority", () => {
    const workspace = setup();
    expect(() =>
      workspace.service.createJobApplication({
        company: "Example Co",
        role: "Engineer",
        authority: {
          type: "EXPLICIT_USER_DEV",
          confirmed: true,
          reference: "",
        },
        idempotencyKey: "unauthorized-registration",
      }),
    ).toThrow(/explicit user authority/u);
    expect(
      workspace.database.prepare("SELECT COUNT(*) AS count FROM projects").get(),
    ).toEqual({ count: 0 });
  });

  it("rejects reuse of a create idempotency key with another registration", () => {
    const workspace = setup();
    createApplication(workspace.service, "one-key");

    expect(() =>
      workspace.service.createJobApplication({
        company: "Other Co",
        role: "Developer",
        authority: {
          type: "EXPLICIT_USER_DEV",
          confirmed: true,
          reference: "User requested another registration",
        },
        idempotencyKey: "one-key",
      }),
    ).toThrow(IdempotencyConflictError);
  });

  it("lists only this Workspace and excludes closed applications by default", () => {
    const workspace = setup();
    const active = createApplication(workspace.service, "create-active");
    const closed = workspace.service.createJobApplication({
      company: "Closed Co",
      role: "Analyst",
      authority: {
        type: "EXPLICIT_USER_DEV",
        confirmed: true,
        reference: "User requested registration",
      },
      idempotencyKey: "create-closed",
    });
    workspace.database
      .prepare("UPDATE projects SET status = 'CLOSED' WHERE id = ?")
      .run(closed.project.id);

    const otherService = new WorkspaceService(workspace.database, {
      ...testPrincipal,
      subject: "other-inventory-user",
      workspaceName: "Other Inventory Workspace",
    });
    otherService.ensureDevelopmentIdentity();
    otherService.createJobApplication({
      company: "Other Workspace Co",
      role: "Engineer",
      authority: {
        type: "EXPLICIT_USER_DEV",
        confirmed: true,
        reference: "Other user registration",
      },
      idempotencyKey: "other-create",
    });

    expect(workspace.service.listJobApplications()).toMatchObject({
      applications: [{ projectId: active.project.id }],
      totalCount: 1,
      truncated: false,
      includeClosed: false,
    });
    expect(
      workspace.service
        .listJobApplications(true)
        .applications.map((application) => application.projectId)
        .sort(),
    ).toEqual([active.project.id, closed.project.id].sort());
  });

  it("caps the inventory list without adding a pagination contract", () => {
    const workspace = setup();
    for (let index = 0; index < 101; index += 1) {
      workspace.service.createJobApplication({
        company: `Inventory Co ${index}`,
        role: "Engineer",
        authority: {
          type: "EXPLICIT_USER_DEV",
          confirmed: true,
          reference: "Controlled list-boundary test",
        },
        idempotencyKey: `bounded-list-create-${index}`,
      });
    }

    const result = workspace.service.listJobApplications();
    expect(result.applications).toHaveLength(100);
    expect(result.totalCount).toBe(101);
    expect(result.truncated).toBe(true);
  });

  it("updates only registration metadata under its own optimistic version", () => {
    const workspace = setup();
    const created = createApplication(workspace.service);
    workspace.database
      .prepare("UPDATE projects SET metadata_json = ? WHERE id = ?")
      .run(
        JSON.stringify({ ...created.project.metadata, currentRound: 2 }),
        created.project.id,
      );

    const updated = workspace.service.updateJobApplication({
      projectId: created.project.id,
      expectedRecordVersion: 1,
      company: "Example Company",
      location: null,
      postingReference:
        "https://careers.example.test/job/456?candidate_email=private@example.test#apply",
      idempotencyKey: "update-registration-1",
    });
    const replay = workspace.service.updateJobApplication({
      projectId: created.project.id,
      expectedRecordVersion: 1,
      company: "Example Company",
      location: null,
      postingReference:
        "https://careers.example.test/job/456?candidate_email=private@example.test#apply",
      idempotencyKey: "update-registration-1",
    });

    expect(updated.changed).toBe(true);
    expect(updated.project).toMatchObject({
      title: "Example Company — Software Engineer",
      recordVersion: 2,
      lifecycleState: "APPLIED",
      lifecycleVersion: 1,
      metadata: {
        company: "Example Company",
        role: "Software Engineer",
        location: null,
        postingReference: "https://careers.example.test/job/456",
        currentRound: 2,
      },
    });
    expect(replay.replayed).toBe(true);

    expect(() =>
      workspace.service.updateJobApplication({
        projectId: created.project.id,
        expectedRecordVersion: 1,
        role: "Staff Engineer",
        idempotencyKey: "stale-registration-update",
      }),
    ).toThrow(ConcurrencyConflictError);

    const after = workspace.service.getProject(created.project.id).project;
    expect(after.lifecycleState).toBe("APPLIED");
    expect(after.lifecycleVersion).toBe(1);
    expect(after.recordVersion).toBe(2);
  });

  it("does not allow one Workspace to update another Workspace's application", () => {
    const workspace = setup();
    const created = createApplication(workspace.service);
    const otherService = new WorkspaceService(workspace.database, {
      ...testPrincipal,
      subject: "other-update-user",
      workspaceName: "Other Update Workspace",
    });
    otherService.ensureDevelopmentIdentity();

    expect(() =>
      otherService.updateJobApplication({
        projectId: created.project.id,
        expectedRecordVersion: 1,
        role: "Unauthorized role",
        idempotencyKey: "cross-workspace-update",
      }),
    ).toThrow(NotFoundError);
  });

  it("bounds Project history at 10 while returning accurate totals", () => {
    const workspace = setup();
    const created = createApplication(workspace.service);

    for (let index = 0; index < 12; index += 1) {
      workspace.service.recordObservation({
        projectId: created.project.id,
        resourceType: "NOTE",
        provider: "m1-test",
        externalId: `note-${index}`,
        externalUri: null,
        title: `Observation ${index}`,
        observedFacts: { index },
        observedAt: `2026-09-01T${String(index).padStart(2, "0")}:00:00.000Z`,
        idempotencyKey: `record-note-${index}`,
      });
    }

    for (let index = 0; index < 11; index += 1) {
      workspace.service.proposeTransition({
        projectId: created.project.id,
        expectedLifecycleVersion: 1,
        toState: "RECRUITER_CONTACT",
        triggerType: "USER_ASSERTION",
        evidenceResourceIds: [],
        rationale: `Bounded history proposal ${index}`,
        idempotencyKey: `proposal-${index}`,
      });
    }

    const details = workspace.service.getProject(created.project.id);
    expect(details.resources).toHaveLength(10);
    expect(details.transitions).toHaveLength(10);
    expect(details.totalCounts).toEqual({
      resources: 12,
      transitions: 12,
      openTasks: 0,
    });
  });
});
