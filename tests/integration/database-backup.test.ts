import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDatabaseBackup,
  verifyDatabaseFile,
} from "../../scripts/backup-database.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { openDatabase } from "../../src/persistence/database.js";

describe("SQLite-consistent cloud backup", () => {
  it("backs up a live WAL database, verifies it, and retains only bounded backups", async () => {
    const root = mkdtempSync(join(tmpdir(), "paw-database-backup-"));
    const databasePath = join(root, "data", "workspace.db");
    const backupDirectory = join(root, "backups");
    const database = openDatabase(databasePath);
    const service = new WorkspaceService(
      database,
      {
        issuer: "backup-test",
        subject: "single-user",
        workspaceName: "Backup Test Workspace",
      },
      { timeZone: "Australia/Sydney" },
    );
    const identity = service.ensureDevelopmentIdentity();

    const first = await createDatabaseBackup({
      databasePath,
      backupDirectory,
      retentionCount: 2,
      now: new Date("2026-09-05T00:00:00.000Z"),
    });
    const second = await createDatabaseBackup({
      databasePath,
      backupDirectory,
      retentionCount: 2,
      now: new Date("2026-09-05T01:00:00.000Z"),
    });
    const unrelated = join(backupDirectory, "keep-me.txt");
    writeFileSync(unrelated, "not a database backup", "utf8");
    const third = await createDatabaseBackup({
      databasePath,
      backupDirectory,
      retentionCount: 2,
      now: new Date("2026-09-05T02:00:00.123Z"),
    });
    database.close();

    expect(first.integrity).toBe("ok");
    expect(existsSync(first.backupPath)).toBe(false);
    expect(existsSync(second.backupPath)).toBe(true);
    expect(existsSync(third.backupPath)).toBe(true);
    expect(existsSync(`${third.backupPath}-wal`)).toBe(false);
    expect(existsSync(`${third.backupPath}-shm`)).toBe(false);
    expect(existsSync(`${third.backupPath}.partial`)).toBe(false);
    expect(existsSync(`${third.backupPath}.partial-wal`)).toBe(false);
    expect(existsSync(`${third.backupPath}.partial-shm`)).toBe(false);
    expect(existsSync(unrelated)).toBe(true);
    expect(third.removedBackups).toEqual([
      "workspace-20260905T000000Z.db",
    ]);

    const restored = openDatabase(third.backupPath);
    try {
      expect(
        restored.prepare("SELECT id FROM workspaces WHERE id = ?").get(
          identity.workspaceId,
        ),
      ).toBeTruthy();
    } finally {
      restored.close();
    }
    expect(verifyDatabaseFile(third.backupPath)).toEqual({
      integrity: "ok",
      migrations: [
        "001_integration_spike.sql",
        "002_real_job_application_inventory.sql",
        "003_task_attention.sql",
        "004_web_identity_links.sql",
      ],
    });
  });
});
