import { verifyMailScanLedgerMigration } from "../../scripts/verify-mail-scan-ledger-migration.js";
import { verifyMailBodyReadMigration } from "../../scripts/verify-mail-body-read-migration.js";
import { afterEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createTestWorkspace, testPrincipal } from "../helpers/test-workspace.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { openDatabase } from "../../src/persistence/database.js";
import { gmailAccountKey, gmailSourceId } from "../../src/gmail/source-identity.js";
import { GmailMcpReader } from "../../src/gmail/mcp-reader.js";
import { mailScanPanel } from "../../src/web/views.js";
import { createWorkspaceMcpServer } from "../../src/mcp/create-server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const cleanups:(()=>void)[]=[];
afterEach(()=>{for(const cleanup of cleanups.splice(0).reverse())cleanup();});
const auth={userConfirmed:true as const,authorityReference:"Explicit synthetic scan authorization"};
function setup() {
  let now=new Date("2026-09-08T09:00:00Z");
  const clock=()=>now;
  const w=createTestWorkspace({fileBacked:true,clock});cleanups.push(w.cleanup);
  return {...w,clock,advance:(ms:number)=>{now=new Date(now.getTime()+ms);}};
}
function fake(ids:string[]=[]) {
  let start="",complete=true,nextPage:string|null=null,account="",calls=0;
  const reader:Pick<GmailMcpReader,"accountKey"|"list"|"read">={
    accountKey:(_c,m)=>gmailAccountKey(m+account),
    async list(_c,p) {calls++;start=p.searchedFrom;return {...p,messages:ids.map(id=>({id,threadId:"synthetic"})),nextPageToken:nextPage,listingComplete:nextPage===null,note:""};},
    async read(_c,p) {return {...p,id:p.messageId,externalId:gmailSourceId(gmailAccountKey(p.mailbox+account),p.messageId),threadId:"synthetic",
      receivedAt:new Date(Date.parse(start)+1).toISOString(),subject:"Synthetic update",senderDomain:"example.test",sourceUrl:"https://mail.google.com/mail/#all/"+p.messageId,
      text:"Synthetic source, never stored in the ledger",bodyFormat:"TEXT",bodyComplete:complete,note:""};},
  };
  return {reader,calls:()=>calls,setComplete:(v:boolean)=>{complete=v;},setPage:(v:string|null)=>{nextPage=v;},swap:()=>{account="changed";}};
}
function begin(s:WorkspaceService,f:ReturnType<typeof fake>,runId=randomUUID()) {
  s.mailScanService.start({...auth,runId,receiptMode:"BACKEND",triggerType:"MANUAL",executionReference:"synthetic"},f.reader);return runId;
}
function next(s:WorkspaceService,runId:string,f:ReturnType<typeof fake>,mailbox="mailbox-1",lane="RECENT") {
  return s.mailBatchService.next({...auth,runId,mailbox,lane},f.reader);
}
function acknowledge(s:WorkspaceService,runId:string,batchId:string,f:ReturnType<typeof fake>,extra:object={}) {
  return s.mailBatchService.ack({...auth,runId,batchId,items:[{messageId:"a1",outcome:"IRRELEVANT",verified:true,requiredActionKeys:[],...extra}]},f.reader);
}
function observation(projectId:string) {
  return {projectId,resourceType:"EMAIL" as const,provider:"gmail",externalId:gmailSourceId(gmailAccountKey("mailbox-1"),"a1"),externalUri:null,title:"Synthetic evidence",
    observedFacts:{contractVersion:"gmail-job-observation-v0.1",sourceFacts:{receivedAt:"2026-09-06T09:00:00.001Z",senderDomain:"example.test"},
      interpretation:{company:"Example Co",role:"Engineer",emailKind:"RECRUITER_CONTACT",summary:"Recruiter requested a conversation."}},
    observedAt:"2026-09-06T09:00:00.001Z",idempotencyKey:"synthetic-ledger-observation"};
}

function pagedFixture() {
  const w=setup(); let body="x".repeat(50000)+" Final interview deadline: Friday.";
  const reader=new GmailMcpReader({get:(_identity,slot)=>({subject:`paged-${slot}`,email:`box${slot}@example.test`,refreshToken:"synthetic"})},
    {access:async()=>"synthetic"},async url=>String(url).includes("format=full")
      ? Response.json({id:"a1",threadId:"t",internalDate:String(Date.parse("2026-09-06T10:00:00Z")),payload:{mimeType:"text/plain",body:{data:Buffer.from(body).toString("base64url")}}})
      : Response.json({messages:[{id:"a1",threadId:"t"}]}));
  const runId=randomUUID();
  w.service.mailScanService.start({...auth,runId,receiptMode:"BACKEND",triggerType:"MANUAL",executionReference:"synthetic"},reader);
  const args={...auth,runId,mailbox:"mailbox-1",lane:"RECENT",limit:1};
  return {...w,reader,runId,args,change:()=>{body+=" changed";}};
}

it("persists contiguous same-version parts across service restart and gates business writes and ack until the tail",async()=>{
  const w=pagedFixture();
  const first=await w.service.mailBatchService.next(w.args,w.reader);
  const message=first.messages[0] as {text:string;bodyContinuation:object};
  const ack={...auth,runId:w.runId,batchId:first.batch!.id,items:[{messageId:"a1",outcome:"IRRELEVANT",verified:true,requiredActionKeys:[]}]};
  const context={runId:w.runId,batchId:first.batch!.id,messageId:"a1",actionKey:"synthetic"};
  expect(()=>w.service.mailScanLedger.source(context)).toThrow(/completely read/);
  expect(()=>w.service.mailBatchService.ack(ack,w.reader)).toThrow(/complete source/);
  await w.reader.read(w.service.resolveIdentity(),{mailbox:"mailbox-1",messageId:"a1",bodyOffset:24000,bodyVersion:(message.bodyContinuation as {bodyVersion:string}).bodyVersion});
  expect(()=>w.service.mailBatchService.ack(ack,w.reader)).toThrow(/complete source/);
  await expect(w.service.mailBatchService.next({...w.args,bodyContinuation:{...message.bodyContinuation,offset:48000}},w.reader)).rejects.toThrow(/skip parts/);
  await expect(w.service.mailBatchService.next({...w.args,mailbox:"mailbox-2",bodyContinuation:message.bodyContinuation},w.reader)).rejects.toThrow(/owned/);
  const resumed=new WorkspaceService(w.database,testPrincipal,{clock:w.clock});
  const second=await resumed.mailBatchService.next({...w.args,bodyContinuation:message.bodyContinuation},w.reader);
  const middle=second.messages[0] as {text:string;bodyContinuation:object;processable:boolean};
  expect(middle.processable).toBe(false);
  const replay=await resumed.mailBatchService.next({...w.args,bodyContinuation:message.bodyContinuation},w.reader);
  expect(replay.messages[0]).toEqual(second.messages[0]);
  expect(()=>resumed.mailBatchService.ack(ack,w.reader)).toThrow(/complete source/);
  const final=await resumed.mailBatchService.next({...w.args,bodyContinuation:middle.bodyContinuation},w.reader);
  expect(final.messages[0]).toMatchObject({bodyComplete:true,processable:true,bodyDiagnostics:{issues:[]},bodyContinuation:null});
  expect((final.messages[0] as {text:string}).text).toContain("Final interview deadline: Friday.");
  expect(message.text+middle.text+(final.messages[0] as {text:string}).text).toBe("x".repeat(50000)+" Final interview deadline: Friday.");
  expect(resumed.mailScanLedger.source(context).mailbox).toBe("mailbox-1");
  resumed.mailBatchService.ack(ack,w.reader);
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_acknowledgements WHERE run_id=?").get(w.runId)).toEqual({n:1});
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_actions WHERE run_id=?").get(w.runId)).toEqual({n:0});
  expect(JSON.stringify(w.database.prepare("SELECT * FROM mail_body_read_progress").all())).not.toContain("interview");
});

it("invalidates a changed body and requires a new first-part read",async()=>{
  const w=pagedFixture(),first=await w.service.mailBatchService.next(w.args,w.reader);
  const c=(first.messages[0] as {bodyContinuation:object}).bodyContinuation;
  w.change();
  await expect(w.service.mailBatchService.next({...w.args,bodyContinuation:c},w.reader)).rejects.toThrow(/changed/);
  expect(w.database.prepare("SELECT body_complete FROM mail_scan_batch_items WHERE batch_id=?").get(first.batch!.id)).toEqual({body_complete:0});
  expect(w.database.prepare("SELECT count(*) n FROM mail_body_read_progress").get()).toEqual({n:0});
  const fresh=await w.service.mailBatchService.next(w.args,w.reader);
  expect((fresh.messages[0] as {bodyContinuation:object}).bodyContinuation).not.toEqual(c);
});

it("does not reuse body progress across closed runs or another workspace",async()=>{
  const w=pagedFixture(),first=await w.service.mailBatchService.next(w.args,w.reader);
  const c=(first.messages[0] as {bodyContinuation:object}).bodyContinuation;
  w.service.mailScanLedger.settle(w.runId,"Synthetic interruption");
  await expect(w.service.mailBatchService.next({...w.args,bodyContinuation:c},w.reader)).rejects.toThrow();
  const newRun=randomUUID(); w.advance(1000);
  w.service.mailScanService.start({...auth,runId:newRun,receiptMode:"BACKEND",triggerType:"MANUAL",executionReference:"new synthetic run"},w.reader);
  await expect(w.service.mailBatchService.next({...w.args,runId:newRun,bodyContinuation:c},w.reader)).rejects.toThrow(/first part/);
  const other=new WorkspaceService(w.database,{...testPrincipal,subject:"other"},{clock:w.clock});other.ensureDevelopmentIdentity();
  await expect(other.mailBatchService.next({...w.args,runId:newRun,bodyContinuation:c},w.reader)).rejects.toThrow();
  const restarted=await w.service.mailBatchService.next({...w.args,runId:newRun},w.reader);
  expect(restarted.messages[0]).toMatchObject({bodyReadProgress:{readThrough:24000,complete:false}});
  expect(w.database.prepare("SELECT run_id FROM mail_body_read_progress WHERE batch_id=?").get(first.batch!.id)).toEqual({run_id:newRun});
});

it("requires a fresh complete extracted body before a blocked backend source can be acknowledged", async () => {
  const w=setup();
  let body="x".repeat(24001);
  const reader=new GmailMcpReader({get:(_identity,slot)=>({subject:`synthetic-${slot}`,email:`box${slot}@example.test`,refreshToken:"synthetic"})},
    {access:async()=>"synthetic"},async url=>String(url).includes("format=full")
      ? Response.json({id:"a1",threadId:"t",internalDate:String(Date.parse("2026-09-06T10:00:00Z")),payload:{mimeType:"text/html",body:{data:Buffer.from(body).toString("base64url")}}})
      : Response.json({messages:[{id:"a1",threadId:"t"}]}));
  const runId=randomUUID();
  w.service.mailScanService.start({...auth,runId,receiptMode:"BACKEND",triggerType:"MANUAL",executionReference:"synthetic"},reader);
  const args={...auth,runId,mailbox:"mailbox-1",lane:"RECENT",limit:1};
  const first=await w.service.mailBatchService.next(args,reader);
  const ack={...auth,runId,batchId:first.batch!.id,items:[{messageId:"a1",outcome:"IRRELEVANT",verified:true,requiredActionKeys:[]}]};
  expect(first.messages[0]).toMatchObject({processable:false,bodyDiagnostics:{issues:["BODY_TOO_LONG"]}});
  expect(w.database.prepare("SELECT last_error FROM mail_scan_batch_items WHERE batch_id=?").get(first.batch!.id))
    .toEqual({last_error:"Message body is incomplete (BODY_TOO_LONG); source processing remains pending"});
  expect(()=>w.service.mailBatchService.ack(ack,reader)).toThrow(/complete source/);
  body=`<style>${".layout{color:red}".repeat(3000)}</style><p>Complete synthetic irrelevant message.</p>`;
  // A standalone diagnostic read cannot clear the persisted batch obligation.
  expect((await reader.read(w.service.resolveIdentity(),{mailbox:"mailbox-1",messageId:"a1"})).bodyComplete).toBe(true);
  expect(()=>w.service.mailBatchService.ack(ack,reader)).toThrow(/complete source/);
  expect((await w.service.mailBatchService.next(args,reader)).messages[0]).toMatchObject({processable:true,bodyComplete:true});
  w.service.mailBatchService.ack(ack,reader);
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_acknowledgements WHERE run_id=?").get(runId)).toEqual({n:1});
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_actions WHERE run_id=?").get(runId)).toEqual({n:0});
  expect(w.service.mailScanService.overview().checkpoints).toEqual([]);
});

it("atomically binds both mailboxes before acquisition, replays start and excludes concurrent legacy/backend runs",()=>{
  const w=setup(),f=fake(),run=begin(w.service,f);
  expect(f.calls()).toBe(0);
  const before=w.database.prepare("SELECT total_changes() n").get();
  begin(w.service,f,run);expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
  expect(w.database.prepare("SELECT count(*) n FROM mail_source_bindings").get()).toEqual({n:2});
  expect(()=>begin(w.service,f)).toThrow(/owns/);
  expect(()=>w.service.mailScanService.start({...auth,runId:randomUUID(),triggerType:"MANUAL",executionReference:""})).toThrow(/owns/);
  expect(w.service.mailScanService.get(run).receiptMode).toBe("BACKEND");
  const other=new WorkspaceService(w.database,{...testPrincipal,subject:"other"},{clock:w.clock});other.ensureDevelopmentIdentity();
  expect(()=>other.mailScanService.get(run)).toThrow();
  expect(()=>begin(other,f,run)).toThrow();
});

it("rolls back a start if the second mailbox is unavailable and preserves legacy active runs",()=>{
  const w=setup(),f=fake();
  const broken={...f.reader,accountKey:(_c:unknown,m:string)=>{if(m==="mailbox-2")throw new Error("missing");return gmailAccountKey(m);}};
  expect(()=>w.service.mailScanService.start({...auth,runId:randomUUID(),receiptMode:"BACKEND",triggerType:"MANUAL",executionReference:""},broken)).toThrow();
  expect(w.service.mailScanService.overview().runs).toHaveLength(0);
  expect(w.database.prepare("SELECT count(*) n FROM mail_source_bindings").get()).toEqual({n:0});
  w.service.mailScanService.start({...auth,runId:randomUUID(),triggerType:"MANUAL",executionReference:""});
  expect(()=>begin(w.service,f)).toThrow(/existing/);
  expect(w.service.mailScanService.overview().runs).toHaveLength(1);
});

it("automatically completes an honestly empty scan and exposes it through a read-only website",async()=>{
  const w=setup(),f=fake(),run=begin(w.service,f);
  for(const mailbox of ["mailbox-1","mailbox-2"]) for(const lane of ["RECENT","BACKFILL"])
    for(let i=0;i<(lane==="RECENT"?2:5);i++) await next(w.service,run,f,mailbox,lane);
  expect(w.service.mailScanService.get(run)).toMatchObject({status:"COMPLETE",counts:{applications:0,evidence:0,transitions:0,tasks:0}});
  expect(w.service.mailScanService.overview().checkpoints).toHaveLength(2);
  const before=w.database.prepare("SELECT total_changes() n").get();
  expect(mailScanPanel(w.service,"Australia/Sydney")).toContain("两邮箱检查完成");
  w.service.mailScanService.overview();
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
  expect(()=>w.service.mailScanLedger.settle(run,"retry")).not.toThrow();
  await expect(next(w.service,run,f)).rejects.toThrow(/RUNNING/);
});

it("keeps pagination, incomplete bodies, missing confirmation and mailbox swaps incomplete",async()=>{
  const w=setup(),f=fake(["a1"]),run=begin(w.service,f);f.setPage("next");f.setComplete(false);
  const first=await next(w.service,run,f),batchId=first.batch!.id;
  expect(()=>acknowledge(w.service,run,batchId,f)).toThrow();
  f.setComplete(true);f.setPage("next-2");await next(w.service,run,f);
  expect(()=>acknowledge(w.service,run,batchId,f,{verified:undefined})).toThrow(/Confirm/);
  acknowledge(w.service,run,batchId,f);
  expect(w.service.mailScanService.get(run).status).toBe("RUNNING");
  expect(w.service.mailScanService.overview().checkpoints).toEqual([]);
  f.swap();await expect(next(w.service,run,f)).rejects.toThrow(/account changed/);
  w.service.mailScanLedger.settle(run,"Mailbox unavailable; pagination remains incomplete");
  expect(w.service.mailScanService.get(run).status).toBe("PARTIAL");
});

it("captures actual writes atomically, excludes ordinary/replayed writes and blocks failed required actions",async()=>{
  const w=setup(),f=fake(["a1"]),run=begin(w.service,f),batchId=(await next(w.service,run,f)).batch!.id;
  const c={runId:run,batchId,messageId:"a1",actionKey:"save-evidence"},input=observation(w.projectId);
  const apply=()=>w.service.mailScanLedger.action(c,"workspace_record_observation",input,()=>w.service.recordObservation(input));
  expect(apply().replayed).toBe(false);expect(apply().replayed).toBe(true);
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_effects").get()).toEqual({n:1});
  const taskContext={...c,actionKey:"required-task"};
  expect(()=>w.service.mailScanLedger.action(taskContext,"workspace_create_task",{},()=>{throw new Error("synthetic failure");})).toThrow();
  expect(()=>acknowledge(w.service,run,batchId,f,{outcome:"RECORDED",projectId:w.projectId})).toThrow(/resolve/);
  const taskInput={projectId:w.projectId,title:"Synthetic follow up",taskKind:"OTHER" as const,priority:"LOW" as const,
    authority:{type:"EXPLICIT_USER_DEV" as const,confirmed:true as const,reference:"Explicit synthetic task request"},idempotencyKey:"ledger-task"};
  w.service.mailScanLedger.action(taskContext,"workspace_create_task",taskInput,()=>w.service.taskService.createTask(taskInput));
  w.service.recordObservation({...input,externalId:gmailSourceId(gmailAccountKey("mailbox-1"),"b1"),idempotencyKey:"outside-run"});
  expect(()=>acknowledge(w.service,run,batchId,f,{outcome:"EXISTING",projectId:w.projectId})).toThrow(/RECORDED/);
  acknowledge(w.service,run,batchId,f,{outcome:"RECORDED",projectId:w.projectId,requiredActionKeys:["save-evidence","required-task"]});
  w.service.mailScanLedger.settle(run,"Bounded manual run ended");
  expect(w.service.mailScanService.get(run).counts).toEqual({applications:0,evidence:1,transitions:0,tasks:1});
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_write_scope").get()).toEqual({n:0});
  const before=w.database.prepare("SELECT total_changes() n").get();
  expect(acknowledge(w.service,run,batchId,f,{outcome:"RECORDED",projectId:w.projectId,requiredActionKeys:["save-evidence","required-task"]})).toMatchObject({replayed:true});
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
  expect(JSON.stringify(w.database.prepare("SELECT * FROM mail_scan_actions").all())).not.toContain("Recruiter requested");
  const closed=w.service.mailScanService.get(run);w.advance(60_000);
  expect(()=>apply()).toThrow(/Closed/);
  expect(w.service.mailScanService.get(run)).toEqual(closed);
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
});

it("rolls back business writes with failed ledger actions and enforces original admission authority",async()=>{
  const w=setup(),f=fake(["a1"]),run=begin(w.service,f),batchId=(await next(w.service,run,f)).batch!.id;
  const input=observation(w.projectId),c={runId:run,batchId,messageId:"a1",actionKey:"transaction"};
  expect(()=>w.service.mailScanLedger.action(c,"workspace_record_observation",input,()=>{w.service.recordObservation(input);throw new Error("after insert");})).toThrow();
  expect(w.database.prepare("SELECT count(*) n FROM resources").get()).toEqual({n:0});
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_effects").get()).toEqual({n:0});
  expect(()=>w.service.mailScanLedger.action({...c,actionKey:"admit"},"workspace_admit_transition",{},()=>w.service.admitTransition({
    transitionId:randomUUID(),expectedLifecycleVersion:1,idempotencyKey:"unauthorized",
    authority:{type:"EXPLICIT_USER_DEV",confirmed:true,reference:""},
  }))).toThrow(/authority/);
  expect(w.database.prepare("SELECT status FROM mail_scan_actions").all()).toEqual([{status:"FAILED"},{status:"FAILED"}]);
});

it("retains failed source obligations across timeout, database restart and a new run",async()=>{
  const w=setup(),f=fake(["a1"]),run=begin(w.service,f),batchId=(await next(w.service,run,f)).batch!.id;
  const c={runId:run,batchId,messageId:"a1",actionKey:"required"};
  expect(()=>w.service.mailScanLedger.action(c,"workspace_record_observation",observation(w.projectId),()=>{throw new Error("failure");})).toThrow();
  w.advance(31*60_000);
  expect(w.service.mailScanService.get(run).ledger?.liveness).toBe("EXPIRED");
  await expect(next(w.service,run,f)).rejects.toThrow(/expired/);
  w.database.close();const db=openDatabase(w.databasePath);cleanups.push(()=>db.close());
  const service=new WorkspaceService(db,testPrincipal,{clock:w.clock}),newRun=begin(service,f);
  expect(service.mailScanService.get(run).status).toBe("PARTIAL");
  const resumed=await next(service,newRun,f);expect(resumed.batch!.id).toBe(batchId);
  expect(()=>acknowledge(service,newRun,batchId,f)).toThrow(/resolve/);
  const input=observation(w.projectId);
  service.mailScanLedger.action({...c,runId:newRun},"workspace_record_observation",input,()=>service.recordObservation(input));
  acknowledge(service,newRun,batchId,f,{outcome:"RECORDED",projectId:w.projectId,requiredActionKeys:["required"]});
  service.mailScanLedger.settle(newRun,"Stop after recovery verification");
  expect(service.mailScanService.get(run).counts?.evidence).toBe(0);
  expect(service.mailScanService.get(newRun).counts?.evidence).toBe(1);
});

it("rejects a late source response after closure without changing the immutable receipt or advancing coverage",async()=>{
  const w=setup(),f=fake(),run=begin(w.service,f);
  let release!:()=>void;
  const wait=new Promise<void>(resolve=>{release=resolve;});
  const reader={...f.reader,list:async(...args:Parameters<GmailMcpReader["list"]>)=>{await wait;return f.reader.list(...args);}};
  const request=w.service.mailBatchService.next({...auth,runId:run,mailbox:"mailbox-1",lane:"RECENT"},reader);
  w.service.mailScanLedger.settle(run,"Interrupted while fetching");
  const snapshot=w.service.mailScanService.get(run);release();
  await expect(request).rejects.toThrow(/RUNNING/);
  expect(w.service.mailScanService.get(run)).toEqual(snapshot);
  expect(w.service.mailScanService.overview().checkpoints).toEqual([]);
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_batch_items").get()).toEqual({n:0});
});

it("commits final receipt and checkpoints atomically and retries after a database failure",async()=>{
  const w=setup(),f=fake(),run=begin(w.service,f);
  for(const mailbox of ["mailbox-1","mailbox-2"]) for(const lane of ["RECENT","BACKFILL"])
    for(let i=0;i<(lane==="RECENT"?2:mailbox==="mailbox-2"?4:5);i++) await next(w.service,run,f,mailbox,lane);
  w.database.exec("CREATE TRIGGER fail_checkpoint BEFORE INSERT ON mail_scan_checkpoints BEGIN SELECT RAISE(ABORT,'synthetic checkpoint failure'); END");
  await expect(next(w.service,run,f,"mailbox-2","BACKFILL")).rejects.toThrow(/checkpoint failure/);
  expect(w.service.mailScanService.get(run).status).toBe("RUNNING");
  expect(w.service.mailScanService.overview().checkpoints).toEqual([]);
  w.database.exec("DROP TRIGGER fail_checkpoint");await next(w.service,run,f,"mailbox-2","BACKFILL");
  expect(w.service.mailScanService.get(run).status).toBe("COMPLETE");
});

it("upgrades a populated version-11 copy without rewriting rows and supports reopen/old-binary schema access",()=>{
  const w=setup(),dir=resolve(w.directory,"v11");mkdirSync(dir);
  for(const file of readdirSync(resolve("db/migrations")).filter(f=>f.endsWith(".sql") && f<"012")) copyFileSync(resolve("db/migrations",file),resolve(dir,file));
  const path=resolve(w.directory,"upgrade.db"),old=openDatabase(path,dir),s=new WorkspaceService(old,testPrincipal,{clock:w.clock});s.ensureDevelopmentIdentity();
  s.createJobApplication({company:"Upgrade fixture",role:"Engineer",authority:{type:"EXPLICIT_USER_DEV",confirmed:true,reference:"Synthetic"},idempotencyKey:"upgrade-app"});
  const run=randomUUID();s.mailScanService.start({...auth,runId:run,triggerType:"MANUAL",executionReference:"historical"});
  const tables=old.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'schema_migrations'").all() as {name:string}[];
  const rows=tables.map(t=>({name:t.name,rows:old.prepare(`SELECT * FROM "${t.name}" ORDER BY rowid`).all()}));old.close();
  const before=resolve(w.directory,"before.db");copyFileSync(path,before);
  const v12=resolve(w.directory,"v12");mkdirSync(v12);
  for(const file of readdirSync(resolve("db/migrations")).filter(f=>f.endsWith(".sql") && f<"013")) copyFileSync(resolve("db/migrations",file),resolve(v12,file));
  const upgraded=openDatabase(path,v12);
  for(const t of rows)expect(upgraded.prepare(`SELECT * FROM "${t.name}" ORDER BY rowid`).all()).toEqual(t.rows);
  expect(upgraded.pragma("integrity_check",{simple:true})).toBe("ok");expect(upgraded.pragma("foreign_key_check")).toEqual([]);upgraded.close();
  expect(verifyMailScanLedgerMigration(before,path,v12)).toMatchObject({status:"PASS",migrations:["012_mail_scan_backend_ledger.sql"]});
  openDatabase(path,v12).close();const rollback=openDatabase(path,dir);expect(rollback.prepare("SELECT status FROM mail_scan_runs WHERE id=?").get(run)).toEqual({status:"RUNNING"});rollback.close();
  const before13=resolve(w.directory,"before13.db");copyFileSync(path,before13);
  const v13=resolve(w.directory,"v13");mkdirSync(v13);
  for(const file of readdirSync(resolve("db/migrations")).filter(f=>f.endsWith(".sql") && f<"014")) copyFileSync(resolve("db/migrations",file),resolve(v13,file));
  openDatabase(path,v13).close();openDatabase(path,v13).close();openDatabase(path,v12).close();
  expect(verifyMailBodyReadMigration(before13,path,v13)).toMatchObject({status:"PASS",migrations:["013_mail_body_read_progress.sql"],addedTables:["mail_body_read_progress"]});
});

it("publishes accurate write metadata and persists the optional mode through real MCP transport",async()=>{
  const w=setup(),f=fake(["a1"]),server=createWorkspaceMcpServer(w.service,undefined,f.reader as GmailMcpReader);
  const client=new Client({name:"ledger-test",version:"1"}),[a,b]=InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b);await client.connect(a);
    const list=await client.listTools();
    for(const name of ["workspace_start_mail_scan","workspace_close_mail_scan","workspace_ack_mail_batch","workspace_record_observation"])
      expect(list.tools.find(t=>t.name===name)?.annotations?.readOnlyHint).toBe(false);
    expect(list.tools.find(t=>t.name==="workspace_record_observation")?.inputSchema.properties).toHaveProperty("scanContext");
    expect(list.tools.find(t=>t.name==="workspace_next_mail_batch")?.inputSchema.properties).toHaveProperty("bodyContinuation");
    expect(list.tools.find(t=>t.name==="workspace_read_mail_message")?.inputSchema.properties).toHaveProperty("bodyOffset");
    const runId=randomUUID();
    expect((await client.callTool({name:"workspace_start_mail_scan",arguments:{...auth,runId,receiptMode:"BACKEND",triggerType:"MANUAL",executionReference:"transport"}})).isError).not.toBe(true);
    const fetched=await client.callTool({name:"workspace_next_mail_batch",arguments:{...auth,runId,mailbox:"mailbox-1",lane:"RECENT"}});
    const batchId=(fetched.structuredContent as {result:{batch:{id:string}}}).result.batch.id;
    const {externalUri:_unused,...input}=observation(w.projectId);
    const saved=await client.callTool({name:"workspace_record_observation",arguments:{...input,scanContext:{runId,batchId,messageId:"a1",actionKey:"evidence"}}});
    expect(saved.isError).not.toBe(true);
    expect((await client.callTool({name:"workspace_ack_mail_batch",arguments:{...auth,runId,batchId,items:[{messageId:"a1",outcome:"RECORDED",projectId:w.projectId,verified:true,requiredActionKeys:["evidence"]}]}})).isError).not.toBe(true);
    expect((await client.callTool({name:"workspace_close_mail_scan",arguments:{...auth,runId,reason:"Transport acceptance only"}})).isError).not.toBe(true);
    expect(w.service.mailScanService.get(runId).status).toBe("PARTIAL");
    expect(w.service.mailScanService.get(runId).counts?.evidence).toBe(1);
  }finally {await client.close();await server.close();}
});

it("counts new applications and admitted transitions from their actual transactions, preserving duplicate warnings",async()=>{
  const w=setup(),f=fake(["a1"]),runId=begin(w.service,f),batchId=(await next(w.service,runId,f)).batch!.id;
  const c={runId,batchId,messageId:"a1",actionKey:"register"};
  const creation={company:"Example Co",role:"Software Engineer",authority:{type:"EXPLICIT_USER_DEV" as const,confirmed:true as const,reference:"Explicit registration"},idempotencyKey:"register-ledger"};
  const duplicate=w.service.mailScanLedger.action(c,"workspace_create_job_application",creation,()=>w.service.createJobApplication(creation));
  expect(duplicate.creationStatus).toBe("POSSIBLE_DUPLICATE");
  expect(()=>acknowledge(w.service,runId,batchId,f)).toThrow(/resolve/);
  const distinct={...creation,company:"New synthetic company",idempotencyKey:"register-corrected"};
  const created=w.service.mailScanLedger.action(c,"workspace_create_job_application",distinct,()=>w.service.createJobApplication(distinct));
  if(created.creationStatus!=="CREATED") throw new Error("Expected creation");
  const projectId=created.project.id,input=observation(projectId);
  const evidence=w.service.mailScanLedger.action({...c,actionKey:"evidence"},"workspace_record_observation",input,()=>w.service.recordObservation(input));
  const proposalInput={projectId,expectedLifecycleVersion:1,toState:"RECRUITER_CONTACT" as const,triggerType:"EXTERNAL_EVIDENCE" as const,evidenceResourceIds:[evidence.resource.id],rationale:"Synthetic source",idempotencyKey:"proposal-ledger"};
  const proposal=w.service.mailScanLedger.action({...c,actionKey:"proposal"},"workspace_propose_transition",proposalInput,()=>w.service.proposeTransition(proposalInput));
  const admission={transitionId:proposal.transition.id,expectedLifecycleVersion:1,authority:creation.authority,idempotencyKey:"admission-ledger"};
  const admit=()=>w.service.mailScanLedger.action({...c,actionKey:"admission"},"workspace_admit_transition",admission,()=>w.service.admitTransition(admission));
  const admitted=admit();expect(admit().replayed).toBe(true);
  acknowledge(w.service,runId,batchId,f,{outcome:"RECORDED",projectId,requiredActionKeys:["register","evidence","proposal","admission"]});
  w.service.mailScanLedger.settle(runId,"Synthetic lifecycle acceptance");
  expect(w.service.mailScanService.get(runId).counts).toEqual({applications:1,evidence:1,transitions:1,tasks:admitted.derivedTask?1:0});
});

it("retains per-mailbox completion on early closure and carries monotonic coverage to a second execution",async()=>{
  const w=setup(),f=fake(),runId=begin(w.service,f);
  for(const lane of ["RECENT","BACKFILL"]) for(let i=0;i<(lane==="RECENT"?2:5);i++) await next(w.service,runId,f,"mailbox-1",lane);
  const first=w.service.mailScanLedger.settle(runId,"Second mailbox unavailable")!;
  expect(first.mailboxes.map(m=>m.status)).toEqual(["COMPLETE","PARTIAL"]);
  expect(w.service.mailScanService.overview().checkpoints).toHaveLength(1);
  w.advance(24*3600_000);const second=begin(w.service,f);
  for(const mailbox of ["mailbox-1","mailbox-2"]) for(const lane of ["RECENT","BACKFILL"]) {
    for(let i=0;i<10;i++) {
      if(w.service.mailScanService.get(second).status!=="RUNNING") break;
      const result=await next(w.service,second,f,mailbox,lane);if(!result.batch)break;
    }
  }
  expect(w.service.mailScanService.get(second).status).toBe("COMPLETE");
  expect(w.service.mailScanService.get(runId)).toEqual(first);
  expect(w.service.mailScanService.overview().checkpoints.every(cp=>cp.coveredThrough===w.clock().toISOString())).toBe(true);
});
