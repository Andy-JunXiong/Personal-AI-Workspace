import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { openDatabase } from "../../src/persistence/database.js";
// The deployment verifier is plain JavaScript so the active image can execute
// it without compiling the checked-out operational files.
// @ts-expect-error No declaration file is needed for this deployment module.
import { verifySyntheticCompletion } from "../../deploy/cloud/verify-synthetic-completion.mjs";

describe("synthetic Web completion verification", () => {
  it("proves one audit row and a zero-write idempotency replay", () => {
    const root = mkdtempSync(join(tmpdir(), "paw-synthetic-completion-"));
    const databasePath = join(root, "workspace.db");
    const database = openDatabase(databasePath);
    const development = new WorkspaceService(database, {
      issuer: "synthetic-verification",
      subject: "single-user",
      workspaceName: "Synthetic verification",
    });
    const identity = development.ensureDevelopmentIdentity();
    const application = development.createJobApplication({
      company: "PAW Synthetic Acceptance",
      role: "S1-05B Browser Completion Fixture",
      appliedDate: "2026-09-06",
      location: "Synthetic fixture - no real employer",
      postingReference: "https://example.invalid/paw/s1-05b-20260906",
      authority: {
        type: "EXPLICIT_USER_DEV",
        confirmed: true,
        reference: "synthetic verification test",
      },
      idempotencyKey: "synthetic-verification-application",
    });
    expect(application.creationStatus).toBe("CREATED");
    if (application.creationStatus !== "CREATED") throw new Error("fixture creation failed");
    const created = development.taskService.createTask({
      projectId: application.project.id,
      title: "SYNTHETIC TEST - Complete once through Web",
      taskKind: "OTHER",
      priority: "LOW",
      dueAt: null,
      authority: {
        type: "EXPLICIT_USER_DEV",
        confirmed: true,
        reference: "synthetic verification test",
      },
      idempotencyKey: "synthetic-verification-task",
    });
    const web = new WorkspaceService(database, {
      ...identity,
      channel: "WEB",
      requestId: "synthetic-browser-request",
    });
    const completed = web.taskService.completeTaskFromWeb({
      taskId: created.task.id,
      expectedRecordVersion: 1,
      intentKey: randomUUID(),
    });
    expect(completed.task.status).toBe("DONE");
    database.close();

    expect(
      verifySyntheticCompletion(databasePath, created.task.id, WorkspaceService),
    ).toMatchObject({
      status: "DONE",
      recordVersion: 2,
      completedAtPresent: true,
      completionAuditRows: 1,
      idempotencyRows: 1,
      replayed: true,
      replayDatabaseChanges: 0,
    });
  });
});
