import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyAdditiveMigration } from "./verify-s2-migration.js";

export function verifyCandidateScreeningMigration(before: string, after: string, migrations = resolve("db/migrations")) {
  const baseline = readdirSync(migrations).filter(f => f.endsWith(".sql") && f < "020_").sort();
  return verifyAdditiveMigration(before, after, baseline, ["020_candidate_screening.sql"], migrations);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 4) throw new Error("Expected before and after database paths");
  console.log(JSON.stringify(verifyCandidateScreeningMigration(process.argv[2]!, process.argv[3]!)));
}
