import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { openDatabase } from "../../src/persistence/database.js";
import { spikeFixture } from "../../src/spike-fixture.js";

export const testPrincipal = {
  issuer: "test-suite",
  subject: "test-user",
  workspaceName: "Test Workspace",
};

export function createEmptyTestWorkspace(options?: { fileBacked?: boolean }) {
  const directory = mkdtempSync(join(tmpdir(), "paw-spike-"));
  const databasePath = options?.fileBacked
    ? join(directory, "workspace.db")
    : ":memory:";
  const database = openDatabase(databasePath, resolve("db/migrations"));
  const service = new WorkspaceService(database, testPrincipal);
  const identity = service.ensureDevelopmentIdentity();

  return {
    database,
    databasePath,
    directory,
    service,
    identity,
    cleanup(): void {
      if (database.open) {
        database.close();
      }
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export function createTestWorkspace(options?: { fileBacked?: boolean }) {
  const workspace = createEmptyTestWorkspace(options);
  const details = workspace.service.seedJobApplication(spikeFixture);
  return {
    ...workspace,
    projectId: details.project.id,
  };
}
