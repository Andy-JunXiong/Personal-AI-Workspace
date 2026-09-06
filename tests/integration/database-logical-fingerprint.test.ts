import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const fingerprintScript = resolve(
  process.cwd(),
  "deploy/cloud/database-logical-fingerprint.mjs",
);

function fingerprint(databasePath: string): string {
  const result = spawnSync(process.execPath, [fingerprintScript, databasePath], {
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

describe("database logical fingerprint", () => {
  it("ignores journal representation but detects logical row changes", () => {
    const root = mkdtempSync(join(tmpdir(), "paw-logical-fingerprint-"));
    const databasePath = join(root, "workspace.db");
    const database = new Database(databasePath);
    database.exec(`
      CREATE TABLE example(id TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO example(id, value) VALUES ('b', 'second'), ('a', 'first');
    `);

    const before = fingerprint(databasePath);
    database.pragma("journal_mode = WAL");
    database.pragma("wal_checkpoint(TRUNCATE)");
    const afterJournalChange = fingerprint(databasePath);
    expect(afterJournalChange).toBe(before);

    database.prepare("UPDATE example SET value = ? WHERE id = ?").run("changed", "a");
    const afterRowChange = fingerprint(databasePath);
    expect(afterRowChange).not.toBe(before);
    database.close();
  });
});
