import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {readdirSync} from "node:fs";
import {verifyAdditiveMigration} from "./verify-s2-migration.js";
export function verifyResumeMigration(before:string,after:string,migrations=resolve("db/migrations")){
  const baseline=readdirSync(migrations).filter(f=>f.endsWith(".sql")&&f<"016_").sort();
  return verifyAdditiveMigration(before,after,baseline,["016_resume_editor.sql"],migrations);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.length!==4)throw new Error("Expected before and after database paths");
  console.log(JSON.stringify(verifyResumeMigration(process.argv[2]!,process.argv[3]!)));
}
