import { afterEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createTestWorkspace } from "../helpers/test-workspace.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { verifiedRequestContext } from "../../src/application/request-context.js";
import { GmailChecks, type GmailRuntime } from "../../src/gmail/checks.js";
import { GmailConnections } from "../../src/gmail/connections.js";
import { GmailMcpReader } from "../../src/gmail/mcp-reader.js";
import { gmailAccountKey, gmailSourceId } from "../../src/gmail/source-identity.js";
import { mailScanPanel } from "../../src/web/views.js";
import { MailCheckError } from "../../src/domain/mail-diagnostics.js";
import { OpenAiMailInterpreter, type Interpretation } from "../../src/gmail/providers.js";

const cleanups:(()=>void)[]=[];
afterEach(()=>cleanups.splice(0).reverse().forEach(fn=>fn()));
const authority={userConfirmed:true as const,authorityReference:"Synthetic ingestion test authorization"};
function setup() {
  let time=Date.parse("2026-09-08T00:00:00Z");
  const w=createTestWorkspace({fileBacked:true,clock:()=>new Date(time)});cleanups.push(w.cleanup);
  const web=()=>new WorkspaceService(w.database,verifiedRequestContext(w.database,w.identity,"WEB",randomUUID()),{clock:()=>new Date(time)});
  const connections=new GmailConnections(join(w.directory,"gmail"),Buffer.alloc(32,7));
  for(const slot of [1,2]) connections.put(w.identity,slot,{subject:`s${slot}`,email:`s${slot}@example.test`,refreshToken:`s${slot}`});
  const calls:{models:number;ranges:{from:string;through:string}[]}={models:0,ranges:[]};
  const source={id:"aa",threadId:"a1",receivedAt:"2026-09-06T12:00:00.000Z",senderDomain:"example.test",subject:"Job",text:"Application received"};
  let messages=[source];let failSecond=false;
  const runtime:GmailRuntime={connections,authorization:{async access(c){return c.subject;},async authorizationUrl(){throw new Error("unused");},async authenticate(){throw new Error("unused");}},
    reader:{async search(token,_company,_role,_since,_signal,range){
      calls.ranges.push({from:range!.searchedFrom,through:range!.coveredThrough});
      if(token==="s2") {if(failSecond) throw new Error("Mailbox unavailable");return {messages:[],complete:true,scope:"synthetic"};}
      return {messages,complete:true,scope:"synthetic"};
    }},interpreter:{async interpret(_company,_role,items){calls.models++;return {items:items.map(m=>({messageId:m.id,relevant:true,category:"APPLICATION_CONFIRMATION" as const,summary:"申请已收到",evidenceQuote:m.text,requiresAction:false}))};}}};
  const mcp=new GmailMcpReader(connections,runtime.authorization,async input=>String(input).includes("format=full")
    ?Response.json({id:source.id,threadId:source.threadId,internalDate:String(Date.parse(source.receivedAt)),payload:{mimeType:"text/plain",body:{data:Buffer.from(source.text).toString("base64url")}}})
    :Response.json({messages:[{id:source.id,threadId:source.threadId}]}));
  return {...w,web,runtime,mcp,calls,source,now:()=>time,advance:(ms:number)=>{time+=ms;},
    setMessages:(value:typeof messages)=>{messages=value;},failSecond:()=>{failSecond=true;}};
}
function observation(w:ReturnType<typeof setup>,externalId:string) {
  return {projectId:w.projectId,provider:"gmail",resourceType:"EMAIL" as const,externalId,externalUri:null,title:"Mail",
    observedAt:w.source.receivedAt,idempotencyKey:randomUUID(),observedFacts:{contractVersion:"gmail-job-observation-v0.1",
      sourceFacts:{receivedAt:w.source.receivedAt,senderDomain:"example.test",threadId:w.source.threadId},
      interpretation:{company:"Example",role:"Engineer",emailKind:"OTHER",summary:"申请已收到"}}};
}
async function check(w:ReturnType<typeof setup>,checks=new GmailChecks(w.runtime,w.now)) {
  const service=w.web();checks.start(w.identity,service,w.projectId);
  await expect.poll(()=>service.manualMailService.current(w.projectId)?.state).not.toBe("RUNNING");
  return service.manualMailService.current(w.projectId)!;
}

it.each(["web-first","mcp-first"])("deduplicates the same mailbox message across both entry points (%s)",async order=>{
  const w=setup(),before=w.service.getProject(w.projectId);
  const mail=await w.mcp.read(w.identity,{mailbox:"mailbox-1",messageId:"aa"});
  expect(mail.externalId).toBe(gmailSourceId(gmailAccountKey("s1"),"aa"));
  if(order==="mcp-first") w.service.recordObservation(observation(w,mail.externalId));
  const run=await check(w);
  expect(run.outcome).toBe(order==="web-first"?"UPDATED":"NO_UPDATE");
  expect(w.service.recordObservation(observation(w,mail.externalId)).deduplicated).toBe(true);
  expect(w.calls.models).toBe(order==="web-first"?1:0);
  expect(w.database.prepare("SELECT count(*) n FROM resources WHERE provider='gmail'").get()).toEqual({n:1});
  const after=w.service.getProject(w.projectId);
  expect(after.project).toEqual(before.project);
  expect(after.transitions).toEqual(before.transitions);
  expect(after.totalCounts.openTasks).toBe(before.totalCounts.openTasks);
  expect(w.service.mailScanService.overview().checkpoints).toEqual([]);
});

it("acknowledges website evidence with the exact identity returned by the source reader",async()=>{
  const w=setup();await check(w);
  const runId=randomUUID();w.service.mailScanService.start({...authority,runId,triggerType:"MANUAL",executionReference:""});
  const next=await w.service.mailBatchService.next({...authority,runId,mailbox:"mailbox-1",lane:"RECENT"},w.mcp);
  expect(next.messages).toHaveLength(1);
  expect(w.service.mailBatchService.ack({...authority,runId,batchId:next.batch!.id,items:[{messageId:"aa",outcome:"EXISTING"}]},w.mcp).status).toBe("COMPLETE");
});

it("keeps ambiguous legacy slot evidence intact rather than merging or duplicating it",async()=>{
  const w=setup();w.service.recordObservation(observation(w,"mailbox-1:aa"));
  const rows=w.database.prepare("SELECT * FROM resources WHERE provider='gmail'").all();
  const run=await check(w);
  expect(run.outcome).toBe("PARTIAL");
  expect(run.scope.join(" ")).toContain("历史邮件归属");
  expect(run.diagnostics).toEqual([{mailbox:"mailbox-1",stage:"DEDUPLICATE",code:"IDENTITY_UNPROVEN"}]);
  expect(w.database.prepare("SELECT * FROM resources WHERE provider='gmail'").all()).toEqual(rows);
  expect(w.calls.models).toBe(0);
});

it("refuses to reuse slot coverage after an account rebind, including acknowledgements",async()=>{
  const w=setup(),runId=randomUUID();w.service.mailScanService.start({...authority,runId,triggerType:"MANUAL",executionReference:""});
  const input={...authority,runId,mailbox:"mailbox-1",lane:"RECENT"};
  const next=await w.service.mailBatchService.next(input,w.mcp);
  w.runtime.connections.put(w.identity,1,{subject:"replacement",email:"replacement@example.test",refreshToken:"new"});
  await expect(w.service.mailBatchService.next(input,w.mcp)).rejects.toThrow("account changed");
  expect(()=>w.service.mailBatchService.ack({...authority,runId,batchId:next.batch!.id,items:[{messageId:"aa",outcome:"IRRELEVANT"}]},w.mcp)).toThrow("account changed");
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_processed").get()).toEqual({n:0});
});

it("checks new afternoon mail using persisted per-application coverage without changing full-mailbox coverage",async()=>{
  const w=setup();await check(w);w.advance(4*3600000);
  w.setMessages([w.source,{...w.source,id:"bb",receivedAt:"2026-09-08T03:00:00.000Z"}]);
  expect((await check(w)).outcome).toBe("UPDATED");
  expect(w.calls.ranges[2]).toEqual({from:"2026-09-07T00:00:00.000Z",through:"2026-09-08T04:00:00.000Z"});
  expect(w.calls.models).toBe(2);
  expect(w.database.prepare("SELECT count(*) n FROM resources WHERE provider='gmail'").get()).toEqual({n:2});
  expect(w.service.mailScanService.overview().checkpoints).toEqual([]);
  const calls=structuredClone(w.calls);const html=mailScanPanel(w.service,"Australia/Sydney");
  expect(html).toContain("网页按需补查");expect(html).toContain("2026-09-08T04:00:00.000Z");
  expect(html).toContain("2026-09-07T00:00:00.000Z");
  expect(html).toContain(`/applications/${w.projectId}`);
  expect(html).toContain("不代表每日全邮箱扫描完成");
  expect(w.calls).toEqual(calls);
});

it("retains failure, restart and account-specific coverage without reporting false success",async()=>{
  const w=setup();w.failSecond();expect((await check(w)).outcome).toBe("PARTIAL");
  expect(w.database.prepare("SELECT account_key FROM mail_manual_coverage").all()).toEqual([{account_key:gmailAccountKey("s1")}]);
  w.advance(61000);const started=w.web().manualMailService.begin(w.projectId);
  expect(w.web().manualMailService.begin(w.projectId).id).toBe(started.id);
  w.advance(181000);
  expect(w.web().manualMailService.current(w.projectId)).toMatchObject({state:"FAILED",interrupted:true});
  const retry=w.web().manualMailService.begin(w.projectId);
  expect(retry.id).not.toBe(started.id);
  expect(w.database.prepare("SELECT status FROM mail_manual_runs WHERE id=?").get(started.id)).toEqual({status:"INTERRUPTED"});
  expect(w.web().manualMailService.range(w.projectId,gmailAccountKey("replacement"),"different-query",w.now()).searchedFrom)
    .toBe(new Date(w.now()-2*86400000).toISOString());
});

it("does not advance manual coverage when completion receipt persistence fails",async()=>{
  const w=setup();w.database.exec("CREATE TRIGGER fail_manual_receipt BEFORE INSERT ON resources WHEN NEW.provider='workspace-gmail-check' BEGIN SELECT RAISE(ABORT,'receipt failed'); END");
  const run=await check(w);expect(run.state).toBe("FAILED");
  expect(run.diagnostics).toEqual([{mailbox:null,stage:"COMPLETE",code:"RECEIPT_SAVE_FAILED"}]);
  expect(w.database.prepare("SELECT count(*) n FROM mail_manual_coverage").get()).toEqual({n:0});
  expect(w.database.prepare("SELECT count(*) n FROM resources WHERE provider='gmail'").get()).toEqual({n:1});
});

it("does not bind unproven historical queue ownership to the currently connected account",async()=>{
  const w=setup(),runId=randomUUID();w.service.mailScanService.start({...authority,runId,triggerType:"MANUAL",executionReference:""});
  w.database.prepare("INSERT INTO mail_scan_processed VALUES(?,'mailbox-1','aa','IRRELEVANT',?,'2026-09-07T00:00:00Z')").run(w.identity.workspaceId,runId);
  await expect(w.service.mailBatchService.next({...authority,runId,mailbox:"mailbox-1",lane:"RECENT"},w.mcp)).rejects.toThrow("Historical mailbox coverage");
  expect(w.database.prepare("SELECT count(*) n FROM mail_source_bindings").get()).toEqual({n:0});
});

it("uses independent identities for identical Gmail IDs in different accounts",()=>{
  const w=setup();
  w.service.recordObservation(observation(w,gmailSourceId(gmailAccountKey("s1"),"aa")));
  w.service.recordObservation(observation(w,gmailSourceId(gmailAccountKey("s2"),"aa")));
  expect(w.database.prepare("SELECT count(*) n FROM resources WHERE provider='gmail'").get()).toEqual({n:2});
});

it("shares manual run ownership across handlers and deduplicates a concurrent MCP save",async()=>{
  const w=setup();let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const interpret=w.runtime.interpreter.interpret.bind(w.runtime.interpreter);
  let entered=false;
  w.runtime.interpreter.interpret=async(...args)=>{entered=true;await gate;return interpret(...args);};
  const first=new GmailChecks(w.runtime,w.now),second=new GmailChecks(w.runtime,w.now);
  const started=first.start(w.identity,w.web(),w.projectId);
  await expect.poll(()=>entered).toBe(true);
  expect(second.start(w.identity,w.web(),w.projectId).id).toBe(started.id);
  w.service.recordObservation(observation(w,gmailSourceId(gmailAccountKey("s1"),"aa")));
  release();await expect.poll(()=>w.web().manualMailService.current(w.projectId)?.state).toBe("DONE");
  expect(w.database.prepare("SELECT count(*) n FROM resources WHERE provider='gmail'").get()).toEqual({n:1});
  expect(w.calls.models).toBe(1);
  expect(w.web().manualMailService.current(w.projectId)?.outcome).toBe("NO_UPDATE");
});

it("retains website authority and project ownership boundaries for manual checks",()=>{
  const w=setup();
  expect(()=>w.service.manualMailService.begin(w.projectId)).toThrow("website action");
  expect(()=>w.web().manualMailService.begin(randomUUID())).toThrow("Application unavailable");
  expect(w.database.prepare("SELECT count(*) n FROM mail_manual_runs").get()).toEqual({n:0});
});

it("saves a confirmation but excludes matching job ads even when the model marks both relevant",async()=>{
  const w=setup(),before=w.service.getProject(w.projectId);
  w.setMessages([w.source,{...w.source,id:"bb",text:"Recommended for you: Example Engineer. Apply now."}]);
  w.runtime.interpreter=new OpenAiMailInterpreter("test","configured-model",async()=>Response.json({status:"completed",output:[{content:[{
    type:"output_text",text:JSON.stringify({items:[
      {messageId:"aa",category:"APPLICATION_CONFIRMATION",relevant:true,summary:"申请已收到",evidenceQuote:w.source.text,requiresAction:false},
      {messageId:"bb",category:"JOB_ADVERTISEMENT",relevant:true,summary:"推荐岗位",evidenceQuote:"Apply now.",requiresAction:true},
    ]}),
  }]}]}));
  const run=await check(w);
  expect(run.outcome).toBe("UPDATED");expect(run.diagnostics).toEqual([]);
  expect(w.database.prepare("SELECT external_id FROM resources WHERE provider='gmail'").all())
    .toEqual([{external_id:gmailSourceId(gmailAccountKey("s1"),"aa")}]);
  expect(w.database.prepare("SELECT count(*) n FROM mail_manual_coverage").get()).toEqual({n:2});
  const after=w.service.getProject(w.projectId);
  expect(after.project).toEqual(before.project);expect(after.transitions).toEqual(before.transitions);
  expect(after.totalCounts.openTasks).toBe(before.totalCounts.openTasks);
});

it("retains valid evidence but does not advance a mailbox containing an uncertain classification",async()=>{
  const w=setup();w.setMessages([w.source,{...w.source,id:"bb"}]);
  w.runtime.interpreter.interpret=async()=>({items:[
    {messageId:"aa",category:"APPLICATION_CONFIRMATION",relevant:true,summary:"申请已收到",evidenceQuote:w.source.text,requiresAction:false},
    {messageId:"bb",category:"UNCERTAIN",relevant:false,summary:"",evidenceQuote:"",requiresAction:false},
  ]});
  const run=await check(w);
  expect(run.outcome).toBe("PARTIAL");
  expect(run.diagnostics).toEqual([{mailbox:"mailbox-1",stage:"INTERPRET",code:"CLASSIFICATION_UNCERTAIN"}]);
  expect(w.database.prepare("SELECT count(*) n FROM resources WHERE provider='gmail'").get()).toEqual({n:1});
  expect(w.database.prepare("SELECT account_key FROM mail_manual_coverage").all()).toEqual([{account_key:gmailAccountKey("s2")}]);
});

it.each(["AUTHORIZE","SEARCH","INTERPRET","SAVE"] as const)("persists safe %s failure diagnostics across service instances",async stage=>{
  const w=setup();
  const privateError=new Error("private-token person@example.test mail body");
  const codes={AUTHORIZE:"AUTHORIZATION_FAILED",SEARCH:"GMAIL_RATE_LIMITED",INTERPRET:"TIMEOUT",SAVE:"EVIDENCE_SAVE_FAILED"};
  if(stage==="AUTHORIZE") w.runtime.authorization.access=async c=>{if(c.subject==="s1") throw privateError;return c.subject;};
  if(stage==="SEARCH") w.runtime.reader.search=async token=>{if(token==="s1") throw new MailCheckError("GMAIL_RATE_LIMITED");return {messages:[],complete:true,scope:"synthetic"};};
  if(stage==="INTERPRET") w.runtime.interpreter.interpret=async()=>{throw new DOMException(privateError.message,"TimeoutError");};
  if(stage==="SAVE") w.database.exec("CREATE TRIGGER fail_email BEFORE INSERT ON resources WHEN NEW.provider='gmail' BEGIN SELECT RAISE(ABORT,'private-token'); END");
  const run=await check(w);
  expect(run.outcome).toBe("PARTIAL");
  expect(w.web().manualMailService.current(w.projectId)?.diagnostics).toEqual([{mailbox:"mailbox-1",stage,code:codes[stage]}]);
  const row=w.database.prepare("SELECT result_json FROM mail_manual_runs WHERE id=?").get(run.id) as {result_json:string};
  expect(row.result_json).not.toContain("private-token");expect(row.result_json).not.toContain("person@example.test");
  expect(w.database.prepare("SELECT account_key FROM mail_manual_coverage").all()).toEqual([{account_key:gmailAccountKey("s2")}]);
  expect(mailScanPanel(w.web(),"Australia/Sydney")).toContain(run.scope.at(-2)!);
  expect(w.service.mailScanService.overview().checkpoints).toEqual([]);
});

it("rejects an entire malformed model batch before saving its otherwise valid first item",async()=>{
  const w=setup();w.setMessages([w.source,{...w.source,id:"bb"}]);
  w.runtime.interpreter.interpret=async()=>({items:[
    {messageId:"aa",category:"APPLICATION_CONFIRMATION",relevant:true,summary:"申请已收到",evidenceQuote:w.source.text,requiresAction:false},
    {messageId:"bb",relevant:true,summary:"缺少类别",evidenceQuote:w.source.text,requiresAction:false},
  ]} as Interpretation);
  const run=await check(w);
  expect(run.diagnostics).toEqual([{mailbox:"mailbox-1",stage:"INTERPRET",code:"MODEL_RESPONSE_INVALID"}]);
  expect(w.database.prepare("SELECT count(*) n FROM resources WHERE provider='gmail'").get()).toEqual({n:0});
  expect(w.database.prepare("SELECT account_key FROM mail_manual_coverage").all()).toEqual([{account_key:gmailAccountKey("s2")}]);
});

it("keeps a body-limited search partial and preserves its diagnostic without calling the model",async()=>{
  const w=setup();
  w.runtime.reader.search=async token=>({messages:[],complete:token==="s2",scope:"synthetic",issues:token==="s1"?["BODY_MISSING","BODY_TRUNCATED"]:[]});
  const run=await check(w);
  expect(run.outcome).toBe("PARTIAL");expect(w.calls.models).toBe(0);
  expect(run.diagnostics.map(d=>d.code)).toEqual(["BODY_MISSING","BODY_TRUNCATED"]);
  expect(w.database.prepare("SELECT account_key FROM mail_manual_coverage").all()).toEqual([{account_key:gmailAccountKey("s2")}]);
});

it("preserves earlier success coverage when a later check fails, and reads old receipts without inventing diagnostics",async()=>{
  const w=setup();const first=await check(w);
  w.database.prepare("UPDATE mail_manual_runs SET result_json=? WHERE id=?").run(JSON.stringify({scope:["Historical generic failure"]}),first.id);
  expect(w.web().manualMailService.current(w.projectId)?.diagnostics).toEqual([]);
  const previous=w.database.prepare("SELECT covered_through FROM mail_manual_coverage WHERE account_key=?").get(gmailAccountKey("s1"));
  w.advance(4*3600000);
  w.runtime.authorization.access=async c=>{if(c.subject==="s1") throw new Error("expired");return c.subject;};
  expect((await check(w)).outcome).toBe("PARTIAL");
  expect(w.database.prepare("SELECT covered_through FROM mail_manual_coverage WHERE account_key=?").get(gmailAccountKey("s1"))).toEqual(previous);
  expect(w.database.prepare("SELECT covered_through FROM mail_manual_coverage WHERE account_key=?").get(gmailAccountKey("s2")))
    .toEqual({covered_through:new Date(w.now()).toISOString()});
});
