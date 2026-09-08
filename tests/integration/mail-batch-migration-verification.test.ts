import Database from "better-sqlite3";
import { copyFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/persistence/database.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { verifyMailBatchMigration } from "../../scripts/verify-mail-batch-migration.js";
import { testPrincipal } from "../helpers/test-workspace.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "paw-mail-migration-"));
  roots.push(root);
  const oldMigrations = join(root, "migrations");
  mkdirSync(oldMigrations);
  for (const file of readdirSync(resolve("db/migrations")).filter(f => /^00[1-9]_/.test(f))) {
    copyFileSync(resolve("db/migrations", file), join(oldMigrations, file));
  }
  const sourceMigrations = join(root, "source-010");
  mkdirSync(sourceMigrations);
  for (const file of readdirSync(resolve("db/migrations")).filter(f => /^(00[1-9]|010)_/.test(f))) {
    copyFileSync(resolve("db/migrations", file), join(sourceMigrations, file));
  }
  const before = join(root, "before.db"), after = join(root, "after.db");
  const db = openDatabase(before, oldMigrations);
  const service = new WorkspaceService(db, testPrincipal);
  service.ensureDevelopmentIdentity();
  service.createJobApplication({ company: "SYNTHETIC migration", role: "Engineer",
    authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Migration test" },
    idempotencyKey: "migration-test" });
  db.exec(`INSERT INTO mail_scan_runs
    (id, workspace_id, authority_reference, trigger_type, execution_reference, started_at, finished_at, status, result_json, result_hash)
    SELECT 'historical-partial', id, 'Synthetic authority', 'MANUAL', '',
      '2026-09-07T10:00:00Z', '2026-09-07T10:01:00Z', 'PARTIAL', '{}', 'historical-hash' FROM workspaces`);
  db.close();
  copyFileSync(before, after);
  openDatabase(after, sourceMigrations).close();
  return { before, after, oldMigrations, sourceMigrations };
}
function mutate(path: string, sql: string) {
  const db = new Database(path);
  try { db.exec(sql); } finally { db.close(); }
}

describe("009 to 010 mail batch migration release gate", () => {
  it("preserves applications and a historical PARTIAL receipt through repeat and old-loader startup", () => {
    const f = fixture();
    openDatabase(f.after, f.sourceMigrations).close();
    openDatabase(f.after, f.oldMigrations).close();
    expect(verifyMailBatchMigration(f.before, f.after, f.sourceMigrations)).toMatchObject({
      status: "PASS", migrations: ["010_mail_scan_batches.sql"],
      addedTables: ["mail_scan_batch_items", "mail_scan_batches", "mail_scan_processed", "mail_scan_streams"],
    });
  });
  it.each([
    ["UPDATE projects SET title = 'changed'", /Pre-existing rows changed/],
    ["UPDATE mail_scan_runs SET result_json = 'changed'", /Pre-existing rows changed: mail_scan_runs/],
    ["UPDATE schema_migrations SET applied_at = 'changed' WHERE version LIKE '009%'", /history changed/],
    ["DELETE FROM schema_migrations WHERE version LIKE '010%'", /versions/],
    ["DROP INDEX idx_mail_batch_active", /schema change/],
    ["INSERT INTO mail_scan_streams (workspace_id,mailbox,lane,starts_at,covered_through) SELECT id,'mailbox-1','RECENT','2026-09-05','2026-09-05' FROM workspaces", /not empty/],
  ])("rejects unsafe upgrade: %s", (sql, error) => {
    const f = fixture();
    mutate(f.after, sql);
    expect(() => verifyMailBatchMigration(f.before, f.after, f.sourceMigrations)).toThrow(error);
  });
  it("rejects an already-upgraded baseline, missing source migration and identical input paths", () => {
    const f = fixture();
    expect(() => verifyMailBatchMigration(f.after, f.before)).toThrow(/baseline/);
    expect(() => verifyMailBatchMigration(f.before, f.after, f.oldMigrations)).toThrow(/source set/);
    expect(() => verifyMailBatchMigration(f.before, f.before)).toThrow(/Distinct/);
  });
});
