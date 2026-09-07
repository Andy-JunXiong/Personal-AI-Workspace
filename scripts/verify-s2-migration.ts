import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openDatabase } from "../src/persistence/database.js";

const baseline = ["001_integration_spike.sql", "002_real_job_application_inventory.sql",
  "003_task_attention.sql", "004_web_identity_links.sql", "005_task_command_audit.sql"];
const additions = ["006_job_candidates.sql", "007_candidate_links.sql", "008_recommendation_runs.sql"];
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const schema = (db: Database.Database) => db.prepare(
  "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
).all();
const versions = (db: Database.Database) => db.prepare(
  "SELECT version FROM schema_migrations ORDER BY version",
).all().map((row) => (row as { version: string }).version);
function digest(db: Database.Database, table: string): string {
  const columns = db.prepare(`PRAGMA table_info(${quote(table)})`).all() as { name: string }[];
  const hash = createHash("sha256");
  for (const row of db.prepare(`SELECT * FROM ${quote(table)} ORDER BY ${columns.map(c => quote(c.name)).join(", ")}`).safeIntegers().iterate()) {
    const encoded = JSON.stringify(row, (_key, value) => typeof value === "bigint" ? { integer: value.toString() } : value);
    hash.update(`${Buffer.byteLength(encoded)}:${encoded}`);
  }
  return hash.digest("hex");
}

/** Read-only verification of exactly the S1 -> S2 upgrade; never prints row data. */
export function verifyS2Migration(beforePath: string, afterPath: string, migrations = resolve("db/migrations")) {
  if (resolve(beforePath) === resolve(afterPath)) throw new Error("Distinct before/after databases required");
  const before = new Database(beforePath, { readonly: true, fileMustExist: true });
  let after: Database.Database | undefined;
  let expected: Database.Database | undefined;
  try {
    after = new Database(afterPath, { readonly: true, fileMustExist: true });
    for (const db of [before, after]) {
      if (db.pragma("integrity_check", { simple: true }) !== "ok" || (db.pragma("foreign_key_check") as unknown[]).length) {
        throw new Error("Database integrity check failed");
      }
    }
    if (!equal(versions(before), baseline) || !equal(versions(after), [...baseline, ...additions])) {
      throw new Error("Unexpected migration baseline or upgrade versions");
    }
    if (!equal(readdirSync(migrations).filter(f => f.endsWith(".sql")).sort(), [...baseline, ...additions])) {
      throw new Error("Unexpected migration source set");
    }
    expected = openDatabase(":memory:", migrations);
    if (!equal(schema(expected), schema(after))) throw new Error("Unexpected schema change");
    const oldTables = before.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
    for (const { name } of oldTables) {
      if (name === "schema_migrations") continue;
      if (digest(before, name) !== digest(after, name)) throw new Error(`Pre-existing rows changed: ${name}`);
    }
    const oldMigrations = before.prepare("SELECT * FROM schema_migrations ORDER BY version").all();
    const retained = after.prepare("SELECT * FROM schema_migrations WHERE version IN (" + baseline.map(() => "?").join(",") + ") ORDER BY version").all(...baseline);
    if (!equal(oldMigrations, retained)) throw new Error("Existing migration history changed");
    const tables = after.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
    const addedTables = tables.filter(t => !oldTables.some(old => old.name === t.name));
    for (const { name } of addedTables) {
      if (after.prepare(`SELECT 1 FROM ${quote(name)} LIMIT 1`).get()) throw new Error(`New table is not empty: ${name}`);
    }
    return { status: "PASS", preservedTables: oldTables.length - 1, addedTables: addedTables.map(t => t.name), migrations: additions };
  } finally {
    expected?.close();
    after?.close();
    before.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) throw new Error("Usage: verify-s2-migration <before.db> <after.db>");
    console.log(JSON.stringify(verifyS2Migration(process.argv[2]!, process.argv[3]!)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Migration verification failed");
    process.exitCode = 1;
  }
}
