import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { ValidationError } from "../../src/domain/errors.js";
import { openDatabase } from "../../src/persistence/database.js";
import {
  createTestWorkspace,
  testPrincipal,
} from "../helpers/test-workspace.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function setup() {
  const workspace = createTestWorkspace();
  cleanups.push(workspace.cleanup);
  return workspace;
}

function canonicalGmailInput(projectId: string) {
  return {
    projectId,
    resourceType: "EMAIL",
    provider: "GMAIL",
    externalId: "synthetic-gmail-message-privacy-001",
    externalUri: null,
    title: "Example Co — Software Engineer application update",
    observedFacts: {
      contractVersion: "gmail-job-observation-v0.1",
      sourceFacts: {
        receivedAt: "2026-09-02T12:47:12+10:00",
        senderDomain: "Recruiting.Example.Test",
      },
      interpretation: {
        company: "Example Co",
        role: "Software Engineer",
        emailKind: "RECRUITER_CONTACT",
        summary: "Recruiter requested an initial conversation.",
      },
    },
    observedAt: "2026-09-02T12:47:12+10:00",
    idempotencyKey: "gmail-observation-privacy-001",
  } as const;
}

describe("canonical Gmail observation privacy boundary", () => {
  it("persists only senderDomain and no full sender email address", () => {
    const workspace = setup();

    const result = workspace.service.recordObservation(
      canonicalGmailInput(workspace.projectId),
    );
    const details = workspace.service.getProject(workspace.projectId);
    const idempotency = workspace.database
      .prepare(
        `SELECT response_json FROM idempotency_records
         WHERE operation = 'workspace_record_observation'`,
      )
      .get() as { response_json: string };

    expect(result.resource.provider).toBe("gmail");
    expect(result.resource.observedFacts).toEqual({
      contractVersion: "gmail-job-observation-v0.1",
      sourceFacts: {
        receivedAt: "2026-09-02T12:47:12+10:00",
        senderDomain: "recruiting.example.test",
      },
      interpretation: {
        company: "Example Co",
        role: "Software Engineer",
        emailKind: "RECRUITER_CONTACT",
        summary: "Recruiter requested an initial conversation.",
      },
    });
    expect(JSON.stringify(details.resources)).not.toContain("@");
    expect(idempotency.response_json).not.toContain("@");
    expect(result.resource.observedFacts.sourceFacts).not.toHaveProperty(
      "sender",
    );
  });

  it("rejects the observed canonical-run drift before any durable write", () => {
    const workspace = setup();
    const driftedInput = {
      ...canonicalGmailInput(workspace.projectId),
      observedFacts: {
        company: "Example Co",
        recruiterContact:
          "Requested an initial conversation regarding the application",
        role: "Software Engineer",
        sender: "Synthetic Sender <sender@example.test>",
      },
    };

    expect(() => workspace.service.recordObservation(driftedInput)).toThrow(
      ValidationError,
    );
    expect(
      workspace.database.prepare("SELECT COUNT(*) AS count FROM resources").get(),
    ).toEqual({ count: 0 });
    expect(
      workspace.database
        .prepare("SELECT COUNT(*) AS count FROM idempotency_records")
        .get(),
    ).toEqual({ count: 0 });
  });

  it("rejects an email address hidden inside an otherwise approved field", () => {
    const workspace = setup();
    const canonical = canonicalGmailInput(workspace.projectId);

    expect(() =>
      workspace.service.recordObservation({
        ...canonical,
        observedFacts: {
          ...canonical.observedFacts,
          interpretation: {
            ...canonical.observedFacts.interpretation,
            summary: "Reply to sender@example.test about the application.",
          },
        },
      }),
    ).toThrow(ValidationError);
    expect(
      workspace.database.prepare("SELECT COUNT(*) AS count FROM resources").get(),
    ).toEqual({ count: 0 });
  });

  it("preserves the complete canonical flow and sanitized readback in a fresh database", () => {
    const workspace = createTestWorkspace({ fileBacked: true });
    cleanups.push(workspace.cleanup);
    const observation = workspace.service.recordObservation(
      canonicalGmailInput(workspace.projectId),
    );
    const proposal = workspace.service.proposeTransition({
      projectId: workspace.projectId,
      expectedLifecycleVersion: 1,
      toState: "RECRUITER_CONTACT",
      triggerType: "EXTERNAL_EVIDENCE",
      evidenceResourceIds: [observation.resource.id],
      rationale: "Synthetic recruiter contact supports progression.",
      idempotencyKey: "gmail-proposal-privacy-flow-001",
    });
    workspace.service.admitTransition({
      transitionId: proposal.transition.id,
      expectedLifecycleVersion: 1,
      authority: {
        type: "EXPLICIT_USER_DEV",
        confirmed: true,
        reference: "Explicit synthetic test approval",
      },
      idempotencyKey: "gmail-admit-privacy-flow-001",
    });
    workspace.database.close();

    const reopenedDatabase = openDatabase(workspace.databasePath);
    const reopenedService = new WorkspaceService(
      reopenedDatabase,
      testPrincipal,
    );
    const readback = reopenedService.getProject(workspace.projectId);
    reopenedDatabase.close();

    expect(readback.project.lifecycleState).toBe("RECRUITER_CONTACT");
    expect(readback.project.lifecycleVersion).toBe(2);
    expect(readback.resources).toHaveLength(1);
    expect(readback.resources[0]?.provider).toBe("gmail");
    expect(readback.resources[0]?.observedFacts.sourceFacts).toEqual({
      receivedAt: "2026-09-02T12:47:12+10:00",
      senderDomain: "recruiting.example.test",
    });
    expect(JSON.stringify(readback)).not.toContain("@");
    expect(readback.openTasks).toHaveLength(1);
    expect(readback.openTasks[0]?.taskKind).toBe("RESPOND_TO_RECRUITER");
  });
});
