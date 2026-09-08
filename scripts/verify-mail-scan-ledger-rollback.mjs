// Synthetic, local-only compatibility check. Build both revisions first.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openDatabase } from "../dist/src/persistence/database.js";
import { WorkspaceService } from "../dist/src/application/workspace-service.js";

if (!process.argv[2]) throw new Error("Usage: node scripts/verify-mail-scan-ledger-rollback.mjs <built-previous-source-root>");
const previous = resolve(process.argv[2]);
const { openDatabase: oldOpen } = await import(pathToFileURL(join(previous,"dist/src/persistence/database.js")).href);
const { WorkspaceService: OldService } = await import(pathToFileURL(join(previous,"dist/src/application/workspace-service.js")).href);
const directory = mkdtempSync(join(tmpdir(),"paw-ledger-rollback-"));
const databasePath = join(directory,"synthetic.db");
const principal = {issuer:"rollback-fixture",subject:"synthetic",workspaceName:"Rollback fixture"};
let database;
try {
  database = openDatabase(databasePath);
  const current = new WorkspaceService(database,principal);
  current.ensureDevelopmentIdentity();
  const application = current.createJobApplication({company:"Synthetic rollback",role:"Engineer",
    authority:{type:"EXPLICIT_USER_DEV",confirmed:true,reference:"Local fixture"},idempotencyKey:"fixture"});
  assert.equal(application.creationStatus,"CREATED");
  const projectId = application.project.id, runId = randomUUID();
  current.mailScanService.start({runId,userConfirmed:true,authorityReference:"Synthetic scan",triggerType:"MANUAL",
    executionReference:"rollback-test",receiptMode:"BACKEND"},{accountKey:(_c,alias)=>alias});
  current.mailScanLedger.settle(runId,"Closed before rollback; no acquisition");
  const receipt = current.mailScanService.get(runId);
  database.close();
  database = oldOpen(databasePath,join(previous,"db/migrations"));
  const old = new OldService(database,principal);
  const before = database.serialize();
  assert.equal(old.getProject(projectId).project.id,projectId);
  assert.equal(old.mailScanService.get(runId).status,"PARTIAL");
  assert.deepEqual(database.serialize(),before);
  const observation = {projectId,resourceType:"NOTE",provider:"synthetic-rollback",externalId:"fixture-note",
    externalUri:null,title:"Synthetic note",observedFacts:{synthetic:true},observedAt:new Date().toISOString(),idempotencyKey:"old-note"};
  assert.equal(old.recordObservation(observation).replayed,false);
  assert.equal(old.recordObservation(observation).replayed,true);
  assert.equal(database.prepare("SELECT count(*) n FROM mail_scan_effects").get().n,0);
  database.close();
  database = openDatabase(databasePath);
  const restored = new WorkspaceService(database,principal);
  assert.deepEqual(restored.mailScanService.get(runId),receipt);
  assert.equal(restored.getProject(projectId).resources.length,1);
  assert.equal(database.pragma("integrity_check",{simple:true}),"ok");
  assert.deepEqual(database.pragma("foreign_key_check"),[]);
  console.log(JSON.stringify({status:"PASS",previousReadOnly:true,previousWriteReplay:true,
    upgradeReopen:true,retainedClosedBackendReceipt:true,liveDataAccess:false}));
} finally {
  if(database?.open) database.close();
  if(dirname(resolve(directory))!==resolve(tmpdir()) || !basename(directory).startsWith("paw-ledger-rollback-"))
    throw new Error("Unexpected cleanup path");
  rmSync(directory,{recursive:true,force:true});
}
