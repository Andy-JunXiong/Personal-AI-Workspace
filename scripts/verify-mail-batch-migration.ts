import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyAdditiveMigration } from "./verify-s2-migration.js";

const baseline = [
  "001_integration_spike.sql", "002_real_job_application_inventory.sql",
  "003_task_attention.sql", "004_web_identity_links.sql", "005_task_command_audit.sql",
  "006_job_candidates.sql", "007_candidate_links.sql", "008_recommendation_runs.sql",
  "009_mail_scan_runs.sql",
];

/** Exact 009 -> 010 gate: preserve old rows/history and require empty new queues. */
export function verifyMailBatchMigration(beforePath: string, afterPath: string,
  migrations = resolve("db/migrations")) {
  return verifyAdditiveMigration(beforePath, afterPath, baseline,
    ["010_mail_scan_batches.sql"], migrations);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) throw new Error("Usage: verify-mail-batch-migration <before.db> <after.db>");
    console.log(JSON.stringify(verifyMailBatchMigration(process.argv[2]!, process.argv[3]!)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Migration verification failed");
    process.exitCode = 1;
  }
}
