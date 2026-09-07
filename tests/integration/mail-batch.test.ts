import { afterEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { createEmptyTestWorkspace, testPrincipal } from "../helpers/test-workspace.js";
import { openDatabase } from "../../src/persistence/database.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { MailBatchService } from "../../src/application/mail-batch-service.js";
import type { GmailMcpReader } from "../../src/gmail/mcp-reader.js";
import { mailScanPanel } from "../../src/web/views.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createWorkspaceMcpServer } from "../../src/mcp/create-server.js";
import { GmailMcpReader as Reader } from "../../src/gmail/mcp-reader.js";

const cleanups:(()=>void)[]=[];
afterEach(()=>{for(const cleanup of cleanups.splice(0).reverse())cleanup();});
const clock=()=>new Date("2026-09-07T11:00:00Z");
const authority={userConfirmed:true as const,authorityReference:"Jun authorized test fixture"};
function setup() {const w=createEmptyTestWorkspace({fileBacked:true,clock});cleanups.push(w.cleanup);return w;}
function start(service:WorkspaceService) {const runId=randomUUID();service.mailScanService.start({...authority,runId,triggerType:"MANUAL",executionReference:""});return runId;}
function input(runId:string,lane="RECENT",mailbox="mailbox-1") {return {...authority,runId,mailbox,lane,limit:2};}
function fake(pages:string[][]) {
  const listed:Parameters<GmailMcpReader["list"]>[1][]=[];
  const reads:string[]=[];let from="2026-09-05T00:00:00Z";let complete=true;let failure=false;
  const reader:Pick<GmailMcpReader,"list"|"read">={
    async list(_identity,p) {listed.push(p);from=p.searchedFrom;const index=p.pageToken ? Number(p.pageToken):0;
      return {...p,messages:(pages[index]??[]).map(id=>({id,threadId:"t"})),nextPageToken:index+1<pages.length?String(index+1):null,listingComplete:index+1>=pages.length,note:""};},
    async read(_identity,p) {reads.push(p.messageId);if(failure)throw new Error("unavailable");return {mailbox:p.mailbox,id:p.messageId,externalId:`${p.mailbox}:${p.messageId}`,threadId:"t",receivedAt:new Date(Date.parse(from)+1).toISOString(),subject:"Synthetic job alert",senderDomain:"example.test",sourceUrl:`https://mail.google.com/mail/#all/${p.messageId}`,text:"Synthetic content",bodyFormat:"TEXT",bodyComplete:complete,note:""};},
  };
  return {reader,listed,reads,setComplete:(v:boolean)=>{complete=v;},setFailure:(v:boolean)=>{failure=v;}};
}
function ack(service:WorkspaceService,runId:string,batchId:string,ids:string[]) {
  return service.mailBatchService.ack({...authority,runId,batchId,items:ids.map(messageId=>({messageId,outcome:"IRRELEVANT"}))});
}

it("resumes pending messages and page cursor after process restart and a partial receipt",async()=>{
  const w=setup(),run=start(w.service),f=fake([["a1","a2"],["a3"]]);
  const first=await w.service.mailBatchService.next(input(run),f.reader);const id=first.batch!.id;
  ack(w.service,run,id,["a1"]);
  w.service.mailScanService.finish({...authority,runId:run,mailboxes:["mailbox-1","mailbox-2"].map(mailbox=>({mailbox,status:"PARTIAL",searchedFrom:null,coveredThrough:null,failureReason:"Budget ended; queued work retained"})),newApplicationIds:[],evidenceIds:[],admittedTransitionIds:[],newTaskIds:[]});
  w.database.close();
  const db=openDatabase(w.databasePath,resolve("db/migrations"));cleanups.push(()=>db.close());
  const service=new WorkspaceService(db,testPrincipal,{clock}),nextRun=start(service);
  const next=await service.mailBatchService.next(input(nextRun),f.reader);
  expect(next.batch!.id).toBe(id);expect(next.messages.map(m=>m.id)).toEqual(["a2"]);expect(f.listed).toHaveLength(1);
  ack(service,nextRun,id,["a2"]);
  const page2=await service.mailBatchService.next(input(nextRun),f.reader);
  expect(f.listed[1]?.pageToken).toBe("1");expect(page2.messages.map(m=>m.id)).toEqual(["a3"]);
  expect(ack(service,nextRun,id,["a3"]).status).toBe("COMPLETE");
  expect(service.mailBatchService.progress().streams.find(s=>s.mailbox==="mailbox-1"&&s.lane==="RECENT")?.coveredThrough).toBe(first.batch!.coveredThrough);
  expect(service.mailScanService.get(run).status).toBe("PARTIAL");
});

it("keeps recent and backfill work independent and never advances unread coverage",async()=>{
  const w=setup(),run=start(w.service),f=fake([["a1","a2"]]);
  const historical=await w.service.mailBatchService.next(input(run,"BACKFILL"),f.reader);
  const recent=await w.service.mailBatchService.next(input(run),f.reader);
  expect(historical.batch!.id).not.toBe(recent.batch!.id);
  expect(historical.batch!.coveredThrough < recent.batch!.searchedFrom).toBe(true);
  const states=w.service.mailBatchService.progress().streams;
  expect(states.find(s=>s.lane==="BACKFILL"&&s.mailbox==="mailbox-1")!.coveredThrough).toBe(historical.batch!.searchedFrom);
  expect(()=>ack(w.service,run,recent.batch!.id,["ff"])).toThrow();
  expect(w.service.mailScanService.overview().checkpoints).toEqual([]);
  const before=w.database.prepare("SELECT total_changes() n").get();
  expect(mailScanPanel(w.service,"Australia/Sydney")).toContain("一周内补查");
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
});

it("requires complete body and saved evidence for relevant acknowledgements; retries stay idempotent",async()=>{
  const w=setup(),run=start(w.service),f=fake([["a1"]]);f.setComplete(false);
  const first=await w.service.mailBatchService.next(input(run),f.reader),id=first.batch!.id;
  expect(first.messages[0]?.processable).toBe(false);expect(()=>ack(w.service,run,id,["a1"])).toThrow();
  f.setComplete(true);await w.service.mailBatchService.next(input(run),f.reader);
  expect(()=>w.service.mailBatchService.ack({...authority,runId:run,batchId:id,items:[{messageId:"a1",outcome:"RECORDED"}]})).toThrow("persisted");
  ack(w.service,run,id,["a1"]);const before=w.database.prepare("SELECT total_changes() n").get();
  ack(w.service,run,id,["a1"]);expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
  expect(()=>w.service.mailBatchService.ack({...authority,runId:run,batchId:id,items:[{messageId:"a1",outcome:"EXISTING"}]})).toThrow("immutable");
});

it("retains unread failures and can restart stale pagination without losing acknowledgements",async()=>{
  const w=setup(),run=start(w.service),f=fake([["a1"],["a2"]]);
  const first=await w.service.mailBatchService.next(input(run),f.reader);ack(w.service,run,first.batch!.id,["a1"]);
  f.setFailure(true);
  const second=await w.service.mailBatchService.next(input(run),f.reader);
  expect(second.progress.streams.find(s=>s.activeBatchId===first.batch!.id)?.blockedMessages).toBe(1);
  f.setFailure(false);
  await w.service.mailBatchService.next({...input(run),restartListing:true},f.reader);
  expect(f.listed.at(-1)?.pageToken).toBeUndefined();
  expect(f.reads.filter(id=>id==="a1")).toHaveLength(1);
  ack(w.service,run,first.batch!.id,["a2"]);
  const next=await w.service.mailBatchService.next(input(run),f.reader);
  expect(next.batch!.status).toBe("COMPLETE");
});

it("enforces caller, standing authorization and run ownership before queue or Gmail access",async()=>{
  const w=setup(),run=start(w.service),f=fake([[]]);
  const web=new MailBatchService(w.database,()=>({...w.identity,channel:"WEB"}),clock);
  await expect(web.next(input(run),f.reader)).rejects.toThrow();
  await expect(w.service.mailBatchService.next({...input(run),userConfirmed:false},f.reader)).rejects.toThrow();
  await expect(w.service.mailBatchService.next(input(randomUUID()),f.reader)).rejects.toThrow();
  const foreign=new MailBatchService(w.database,()=>({...w.identity,workspaceId:randomUUID(),channel:"MCP"}),clock);
  await expect(foreign.next(input(run),f.reader)).rejects.toThrow();
  expect(f.listed).toHaveLength(0);expect(w.service.mailBatchService.progress().streams).toEqual([]);
});

it("refuses full receipt coverage while durable history is incomplete",async()=>{
  const w=setup(),run=start(w.service),f=fake([[]]);
  await w.service.mailBatchService.next(input(run),f.reader);
  expect(()=>w.service.mailScanService.finish({...authority,runId:run,mailboxes:["mailbox-1","mailbox-2"].map(mailbox=>({mailbox,status:"COMPLETE",searchedFrom:"2026-08-31T11:00:00Z",coveredThrough:"2026-09-07T11:00:00Z",failureReason:""})),newApplicationIds:[],evidenceIds:[],admittedTransitionIds:[],newTaskIds:[]})).toThrow("incomplete");
  expect(w.service.mailScanService.get(run).status).toBe("RUNNING");
  expect(w.service.mailScanService.overview().checkpoints).toEqual([]);
});

it("advances full source coverage only after both independent lanes are exhausted",async()=>{
  const w=setup(),run=start(w.service),f=fake([[]]);
  for(const mailbox of ["mailbox-1","mailbox-2"]) for(const lane of ["RECENT","BACKFILL"]) {
    let done=false;
    for(let n=0;n<32;n++) {const result=await w.service.mailBatchService.next(input(run,lane,mailbox),f.reader);if(!result.batch){done=true;break;}}
    expect(done).toBe(true);
  }
  const result=w.service.mailScanService.finish({...authority,runId:run,mailboxes:["mailbox-1","mailbox-2"].map(mailbox=>({mailbox,status:"COMPLETE",searchedFrom:"2026-08-31T11:00:00Z",coveredThrough:"2026-09-07T11:00:00Z",failureReason:""})),newApplicationIds:[],evidenceIds:[],admittedTransitionIds:[],newTaskIds:[]});
  expect(result.run.status).toBe("COMPLETE");expect(w.service.mailScanService.overview().checkpoints).toHaveLength(2);
  expect(w.service.mailBatchService.progress().streams.filter(s=>s.backfillComplete)).toHaveLength(2);
});

it("persists next/ack processing through real MCP tools and exposes read-only progress",async()=>{
  const w=setup(),run=start(w.service);
  const reader=new Reader({get:()=>({email:"one@example.test",subject:"one",refreshToken:"test"})},{access:async()=>"test"},async url=>String(url).includes("format=full")
    ? Response.json({id:"a1",threadId:"t",internalDate:String(Date.parse("2026-09-05T12:00:00Z")),payload:{mimeType:"text/plain",body:{data:Buffer.from("Synthetic alert").toString("base64url")}}})
    :Response.json({messages:[{id:"a1",threadId:"t"}]}));
  const server=createWorkspaceMcpServer(w.service,undefined,reader),client=new Client({name:"batch-test",version:"1"});
  const [a,b]=InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b);await client.connect(a);
    const next=await client.callTool({name:"workspace_next_mail_batch",arguments:input(run)});
    expect(next.isError).not.toBe(true);
    const result=next.structuredContent as {result:{batch:{id:string}}};
    const acknowledged=await client.callTool({name:"workspace_ack_mail_batch",arguments:{...authority,runId:run,batchId:result.result.batch.id,items:[{messageId:"a1",outcome:"IRRELEVANT"}]}});
    expect(acknowledged.isError).not.toBe(true);
    const read=await client.callTool({name:"workspace_get_mail_scans",arguments:{runId:run}});
    const saved=read.structuredContent as {result:{processing:{streams:unknown[]};run:{status:string}}};
    expect(Array.isArray(saved.result.processing.streams)).toBe(true);
    expect(saved.result.processing.streams).toHaveLength(4);
    expect(saved.result.run.status).toBe("RUNNING");
    expect(w.database.prepare("SELECT count(*) n FROM resources").get()).toEqual({n:0});
  } finally {await client.close();await server.close();}
});

it("upgrades existing receipts without changing application rows or the saved partial run",()=>{
  const w=setup(),oldMigrations=resolve(w.directory,"old");mkdirSync(oldMigrations);
  for(const file of readdirSync(resolve("db/migrations")).filter(f=>/^00[1-9]_/.test(f))) copyFileSync(resolve("db/migrations",file),resolve(oldMigrations,file));
  const path=resolve(w.directory,"legacy.db"),old=openDatabase(path,oldMigrations);
  const service=new WorkspaceService(old,testPrincipal,{clock});service.ensureDevelopmentIdentity();const run=start(service);
  service.mailScanService.finish({...authority,runId:run,mailboxes:["mailbox-1","mailbox-2"].map(mailbox=>({mailbox,status:"PARTIAL",searchedFrom:null,coveredThrough:null,failureReason:"Original interrupted run"})),newApplicationIds:[],evidenceIds:[],admittedTransitionIds:[],newTaskIds:[]});
  const tables=old.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'schema_migrations'").all() as {name:string}[];
  const rows=tables.map(t=>({name:t.name,rows:old.prepare(`SELECT * FROM "${t.name}" ORDER BY rowid`).all()}));old.close();
  const upgraded=openDatabase(path);try {
    for(const table of rows)expect(upgraded.prepare(`SELECT * FROM "${table.name}" ORDER BY rowid`).all()).toEqual(table.rows);
    expect(upgraded.prepare("SELECT count(*) n FROM mail_scan_streams").get()).toEqual({n:0});
    expect(upgraded.pragma("integrity_check",{simple:true})).toBe("ok");
  }finally{upgraded.close();}
  openDatabase(path).close();openDatabase(path,oldMigrations).close();
});

it("caps first-run history at seven days and explicitly expires old unfinished work after a long pause",async()=>{
  const w=setup(),run=start(w.service),f=fake([["a1"]]);
  const initial=await w.service.mailBatchService.next(input(run,"BACKFILL"),f.reader);
  expect(initial.batch!.searchedFrom).toBe("2026-08-31T11:00:00.000Z");
  const later=new WorkspaceService(w.database,testPrincipal,{clock:()=>new Date("2026-09-20T11:00:00Z")});
  const nextRun=start(later);
  const next=await later.mailBatchService.next(input(nextRun),f.reader);
  expect(next.batch!.searchedFrom).toBe("2026-09-13T11:00:00.000Z");
  expect(f.listed.at(-1)!.searchedFrom).toBe("2026-09-13T11:00:00.000Z");
  expect(next.progress.streams.filter(s=>s.mailbox==="mailbox-1").every(s=>s.excludedBefore==="2026-09-13T11:00:00.000Z")).toBe(true);
  expect(w.database.prepare("SELECT status FROM mail_scan_batches WHERE id=?").get(initial.batch!.id)).toEqual({status:"EXPIRED"});
  expect(later.mailScanService.overview().checkpoints).toEqual([]);
  expect(()=>ack(later,nextRun,initial.batch!.id,["a1"])).toThrow("one-week");
});
