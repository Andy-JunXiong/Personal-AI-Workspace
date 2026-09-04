import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyDatabaseFile } from "./backup-database.js";

function main(): void {
  const suppliedPath = process.argv[2]?.trim();
  if (!suppliedPath) {
    throw new Error("Usage: npm run db:verify -- <database-path>");
  }
  const databasePath = resolve(suppliedPath);
  const result = verifyDatabaseFile(databasePath);
  console.log(
    JSON.stringify({
      level: "info",
      event: "database_verification_completed",
      database: basename(databasePath),
      ...result,
    }),
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    main();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "database_verification_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    process.exitCode = 1;
  }
}
