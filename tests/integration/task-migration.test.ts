import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/persistence/database.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("003 Task attention migration", () => {
  it("upgrades a pre-M2 transition-derived Task without changing its ownership", () => {
    const directory = mkdtempSync(join(tmpdir(), "paw-m2-migration-"));
    cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
    const oldMigrations = join(directory, "old-migrations");
    mkdirSync(oldMigrations);
    for (const fileName of [
      "001_integration_spike.sql",
      "002_real_job_application_inventory.sql",
    ]) {
      copyFileSync(
        resolve("db/migrations", fileName),
        join(oldMigrations, fileName),
      );
    }

    const databasePath = join(directory, "workspace.db");
    const oldDatabase = openDatabase(databasePath, oldMigrations);
    oldDatabase.exec(`
      INSERT INTO principals(id, issuer, subject, created_at)
      VALUES ('principal', 'test', 'user', '2026-09-01T00:00:00.000Z');
      INSERT INTO workspaces(id, owner_principal_id, name, created_at)
      VALUES ('workspace', 'principal', 'Test', '2026-09-01T00:00:00.000Z');
      INSERT INTO projects(
        id, workspace_id, project_type, title, status, lifecycle_state,
        lifecycle_version, metadata_json, created_at, updated_at
      ) VALUES (
        'project', 'workspace', 'job_application', 'Example - Engineer',
        'ACTIVE', 'APPLIED', 1, '{"company":"Example","role":"Engineer"}',
        '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'
      );
      INSERT INTO tasks(
        id, project_id, title, task_kind, status, priority, due_at,
        created_by, source_transition_id, created_at, updated_at
      ) VALUES (
        'task', 'project', 'Existing derived Task', 'RESPOND_TO_RECRUITER',
        'TODO', 'HIGH', NULL, 'SYSTEM', NULL,
        '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'
      );
    `);
    oldDatabase.close();

    const migratedDatabase = openDatabase(databasePath, resolve("db/migrations"));
    try {
      expect(
        migratedDatabase
          .prepare(
            `SELECT record_version, updated_by, completed_at, created_by
             FROM tasks WHERE id = 'task'`,
          )
          .get(),
      ).toEqual({
        record_version: 1,
        updated_by: "SYSTEM",
        completed_at: null,
        created_by: "SYSTEM",
      });
      expect(
        migratedDatabase
          .prepare(
            "SELECT COUNT(*) AS count FROM schema_migrations WHERE version = '003_task_attention.sql'",
          )
          .get(),
      ).toEqual({ count: 1 });
    } finally {
      migratedDatabase.close();
    }
  });
});
