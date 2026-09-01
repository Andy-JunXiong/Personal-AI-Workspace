import Database from "better-sqlite3";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type WorkspaceDatabase = Database.Database;

function ensureDatabaseDirectory(databasePath: string): void {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }
}

export function openDatabase(
  databasePath: string,
  migrationsDirectory = resolve("db/migrations"),
): WorkspaceDatabase {
  ensureDatabaseDirectory(databasePath);

  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  if (databasePath !== ":memory:") {
    database.pragma("journal_mode = WAL");
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const migrations = readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const migration of migrations) {
    const alreadyApplied = database
      .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
      .get(migration);

    if (alreadyApplied) {
      continue;
    }

    const sql = readFileSync(resolve(migrationsDirectory, migration), "utf8");
    database.transaction(() => {
      database.exec(sql);
      database
        .prepare(
          "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
        )
        .run(migration, new Date().toISOString());
    })();
  }

  return database;
}
