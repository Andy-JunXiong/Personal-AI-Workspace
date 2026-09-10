import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyAdditiveMigration } from "./verify-s2-migration.js";

export function verifyPlatformWatchMigration(
  before: string,
  after: string,
  migrations = resolve("db/migrations"),
) {
  const baseline = readdirSync(migrations)
    .filter((file) => file.endsWith(".sql") && file < "017_")
    .sort();
  return verifyAdditiveMigration(
    before,
    after,
    baseline,
    ["017_platform_watch_reports.sql"],
    migrations,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 4) throw new Error("Expected before and after database paths");
  console.log(JSON.stringify(verifyPlatformWatchMigration(process.argv[2]!, process.argv[3]!)));
}
