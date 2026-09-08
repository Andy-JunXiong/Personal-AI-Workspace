import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyAdditiveMigration } from "./verify-s2-migration.js";

const baseline=["001_integration_spike.sql","002_real_job_application_inventory.sql",
  "003_task_attention.sql","004_web_identity_links.sql","005_task_command_audit.sql",
  "006_job_candidates.sql","007_candidate_links.sql","008_recommendation_runs.sql",
  "009_mail_scan_runs.sql","010_mail_scan_batches.sql"];

export function verifyMailIngestionMigration(before:string,after:string,migrations=resolve("db/migrations")) {
  return verifyAdditiveMigration(before,after,baseline,["011_mail_ingestion_identity.sql"],migrations);
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if(process.argv.length!==4) throw new Error("Usage: verify-mail-ingestion-migration <before.db> <after.db>");
    console.log(JSON.stringify(verifyMailIngestionMigration(process.argv[2]!,process.argv[3]!)));
  } catch(error) {console.error(error instanceof Error?error.message:"Migration verification failed");process.exitCode=1;}
}
