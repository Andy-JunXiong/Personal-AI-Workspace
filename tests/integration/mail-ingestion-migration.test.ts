import { afterEach, expect, it } from "vitest";
import { copyFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openDatabase } from "../../src/persistence/database.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { testPrincipal } from "../helpers/test-workspace.js";
import { verifyMailIngestionMigration } from "../../scripts/verify-mail-ingestion-migration.js";

const roots:string[]=[];
afterEach(()=>roots.splice(0).forEach(root=>rmSync(root,{recursive:true,force:true})));
it("adds empty ingestion metadata while preserving populated historical queues, evidence and receipts",()=>{
  const root=mkdtempSync(join(tmpdir(),"paw-ingestion-upgrade-"));roots.push(root);
  const old=join(root,"old");mkdirSync(old);
  for(const file of readdirSync(resolve("db/migrations")).filter(file=>/^(00[1-9]|010)_/.test(file)))
    copyFileSync(resolve("db/migrations",file),join(old,file));
  const v11=join(root,"v11");mkdirSync(v11);
  for(const file of readdirSync(resolve("db/migrations")).filter(f=>f.endsWith(".sql") && f<"012")) copyFileSync(resolve("db/migrations",file),join(v11,file));
  const before=join(root,"before.db"),after=join(root,"after.db");
  const db=openDatabase(before,old),service=new WorkspaceService(db,testPrincipal);
  const identity=service.ensureDevelopmentIdentity();
  service.createJobApplication({company:"Synthetic migration",role:"Engineer",authority:{type:"EXPLICIT_USER_DEV",confirmed:true,reference:"Migration test"},idempotencyKey:"migration"});
  db.prepare("INSERT INTO mail_scan_runs(id,workspace_id,authority_reference,trigger_type,execution_reference,started_at,status) VALUES('old-run',?,'test','MANUAL','','2026-09-07T00:00:00Z','RUNNING')").run(identity.workspaceId);
  db.prepare("INSERT INTO mail_scan_streams VALUES(?,'mailbox-1','RECENT','2026-09-06','2026-09-06',NULL,NULL)").run(identity.workspaceId);
  db.prepare("INSERT INTO mail_scan_batches(id,workspace_id,mailbox,lane,searched_from,covered_through,status) VALUES('old-batch',?,'mailbox-1','RECENT','2026-09-06','2026-09-07','ACTIVE')").run(identity.workspaceId);
  db.exec("INSERT INTO mail_scan_batch_items(batch_id,message_id) VALUES('old-batch','aa')");
  db.close();copyFileSync(before,after);openDatabase(after,v11).close();
  openDatabase(after,v11).close();openDatabase(after,old).close();
  expect(verifyMailIngestionMigration(before,after,v11)).toMatchObject({status:"PASS",migrations:["011_mail_ingestion_identity.sql"],
    addedTables:["mail_batch_source_ids","mail_manual_coverage","mail_manual_runs","mail_source_bindings"]});
  const changed=openDatabase(after,v11);changed.exec("UPDATE mail_scan_batches SET page_token='modified'");changed.close();
  expect(()=>verifyMailIngestionMigration(before,after,v11)).toThrow(/Pre-existing rows changed/);
});
