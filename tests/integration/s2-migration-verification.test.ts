import Database from "better-sqlite3";
import { copyFileSync, mkdtempSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/persistence/database.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { verifyS2Migration } from "../../scripts/verify-s2-migration.js";
import { testPrincipal } from "../helpers/test-workspace.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "paw-s2-migration-"));
  roots.push(root);
  const oldMigrations = join(root, "migrations");
  mkdirSync(oldMigrations);
  for (const file of readdirSync(resolve("db/migrations")).filter(f => /^00[1-5]_/u.test(f))) {
    copyFileSync(resolve("db/migrations", file), join(oldMigrations, file));
  }
  const before = join(root, "before.db");
  const after = join(root, "after.db");
  const db = openDatabase(before, oldMigrations);
  const service = new WorkspaceService(db, testPrincipal);
  service.ensureDevelopmentIdentity();
  service.createJobApplication({ company: "SYNTHETIC migration", role: "Engineer",
    authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Migration test" },
    idempotencyKey: "migration-test" });
  db.close();
  copyFileSync(before, after);
  openDatabase(after).close();
  return { before, after, oldMigrations };
}
function mutate(path: string, sql: string) {
  const db = new Database(path);
  try { db.exec(sql); } finally { db.close(); }
}
describe("S1 to S2 migration verification", () => {
  it("preserves existing data and accepts only expected schema additions, including repeat and old migration startup", () => {
    const f = fixture();
    expect(verifyS2Migration(f.before, f.after)).toMatchObject({ status: "PASS" });
    openDatabase(f.after).close();
    openDatabase(f.after, f.oldMigrations).close();
    expect(verifyS2Migration(f.before, f.after).status).toBe("PASS");
  });
  it("rejects modification to pre-existing application data", () => {
    const f = fixture();
    mutate(f.after, "UPDATE projects SET title = 'changed'");
    expect(() => verifyS2Migration(f.before, f.after)).toThrow(/Pre-existing rows changed/u);
  });
  it("rejects unexpected indexes even if all rows are preserved", () => {
    const f = fixture();
    mutate(f.after, "CREATE INDEX unexpected_index ON projects(title)");
    expect(() => verifyS2Migration(f.before, f.after)).toThrow(/schema change/u);
  });
  it("rejects missing migration history and changed existing history", () => {
    const f = fixture();
    mutate(f.after, "UPDATE schema_migrations SET applied_at = 'changed' WHERE version LIKE '001%'");
    expect(() => verifyS2Migration(f.before, f.after)).toThrow(/history changed/u);
    mutate(f.after, "DELETE FROM schema_migrations WHERE version LIKE '008%'");
    expect(() => verifyS2Migration(f.before, f.after)).toThrow(/versions/u);
  });
  it("rejects unplanned data in new tables", () => {
    const f = fixture();
    mutate(f.after, `INSERT INTO recommendation_runs
      (id,workspace_id,provider,run_at,coverage_status,delivery_status,item_count,recorded_at)
      SELECT 'test',id,'test','2026-09-07','COMPLETE','UNKNOWN',0,'2026-09-07' FROM workspaces`);
    expect(() => verifyS2Migration(f.before, f.after)).toThrow(/not empty/u);
  });
  it("rejects an already-upgraded baseline and the same path", () => {
    const f = fixture();
    expect(() => verifyS2Migration(f.after, f.before)).toThrow(/baseline/u);
    expect(() => verifyS2Migration(f.before, f.before)).toThrow(/Distinct/u);
  });
});
