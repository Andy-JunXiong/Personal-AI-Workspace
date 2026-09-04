import Database from "better-sqlite3";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const backupFilePattern = /^workspace-\d{8}T\d{6}Z\.db$/u;

export interface DatabaseBackupOptions {
  databasePath: string;
  backupDirectory: string;
  retentionCount: number;
  now?: Date;
}

export interface DatabaseVerification {
  integrity: "ok";
  migrations: string[];
}

export interface DatabaseBackupResult extends DatabaseVerification {
  backupPath: string;
  removedBackups: string[];
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function backupFileName(now: Date): string {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Backup timestamp must be a valid Date");
  }
  const timestamp = now
    .toISOString()
    .replace(/\.\d{3}Z$/u, "Z")
    .replaceAll("-", "")
    .replaceAll(":", "");
  return `workspace-${timestamp}.db`;
}

export function verifyDatabaseFile(databasePath: string): DatabaseVerification {
  const resolvedPath = resolve(databasePath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Database does not exist: ${resolvedPath}`);
  }

  const database = new Database(resolvedPath, { fileMustExist: true });
  try {
    // Backups are standalone recovery artifacts. Converting the copied file
    // to DELETE mode checkpoints it and avoids orphaned WAL/SHM sidecars.
    const journalMode = database.pragma("journal_mode = DELETE", {
      simple: true,
    });
    if (journalMode !== "delete") {
      throw new Error(`Could not normalize backup journal mode: ${String(journalMode)}`);
    }
    const integrity = database.pragma("integrity_check", {
      simple: true,
    });
    if (integrity !== "ok") {
      throw new Error(`Database integrity check failed: ${String(integrity)}`);
    }
    const migrations = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all()
      .map((row) => (row as { version: string }).version);
    return { integrity: "ok", migrations };
  } finally {
    database.close();
  }
}

function enforceRetention(
  backupDirectory: string,
  retentionCount: number,
): string[] {
  const backupNames = readdirSync(backupDirectory)
    .filter((name) => backupFilePattern.test(name))
    .sort()
    .reverse();
  const removedBackups: string[] = [];

  for (const name of backupNames.slice(retentionCount)) {
    unlinkSync(join(backupDirectory, name));
    removedBackups.push(name);
  }
  return removedBackups;
}

export async function createDatabaseBackup(
  options: DatabaseBackupOptions,
): Promise<DatabaseBackupResult> {
  assertPositiveInteger(options.retentionCount, "retentionCount");
  const sourcePath = resolve(options.databasePath);
  const backupDirectory = resolve(options.backupDirectory);
  mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });

  const targetPath = join(
    backupDirectory,
    backupFileName(options.now ?? new Date()),
  );
  const partialPath = `${targetPath}.partial`;
  if (existsSync(targetPath) || existsSync(partialPath)) {
    throw new Error(`Backup target already exists: ${targetPath}`);
  }

  const source = new Database(sourcePath, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    await source.backup(partialPath);
  } catch (error) {
    if (existsSync(partialPath)) unlinkSync(partialPath);
    throw error;
  } finally {
    source.close();
  }

  const verification = verifyDatabaseFile(partialPath);
  for (const sidecarPath of [`${partialPath}-wal`, `${partialPath}-shm`]) {
    if (existsSync(sidecarPath)) unlinkSync(sidecarPath);
  }
  chmodSync(partialPath, 0o600);
  renameSync(partialPath, targetPath);
  const removedBackups = enforceRetention(
    backupDirectory,
    options.retentionCount,
  );

  return {
    backupPath: targetPath,
    removedBackups,
    ...verification,
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const retentionCount = Number.parseInt(
    process.env.PAW_BACKUP_RETENTION_COUNT ?? "14",
    10,
  );
  const result = await createDatabaseBackup({
    databasePath: requiredEnvironment("PAW_DB_PATH"),
    backupDirectory: requiredEnvironment("PAW_BACKUP_DIR"),
    retentionCount,
  });
  console.log(
    JSON.stringify({
      level: "info",
      event: "database_backup_completed",
      backup: basename(result.backupPath),
      integrity: result.integrity,
      migrations: result.migrations,
      removedBackups: result.removedBackups,
    }),
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "database_backup_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    process.exitCode = 1;
  });
}
