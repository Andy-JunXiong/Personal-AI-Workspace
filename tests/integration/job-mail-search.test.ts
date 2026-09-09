import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createTestWorkspace, testPrincipal } from "../helpers/test-workspace.js";
import { GmailMcpReader } from "../../src/gmail/mcp-reader.js";
import { jobMailQuery, matchesJobMail } from "../../src/gmail/job-mail-search.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { openDatabase } from "../../src/persistence/database.js";
import { verifyJobMailSearchMigration } from "../../scripts/verify-job-mail-search-migration.js";

const cleanups:(()=>void)[]=[];
afterEach(()=>{for(const fn of cleanups.splice(0).reverse())fn();vi.restoreAllMocks();});
const auth={userConfirmed:true as const,authorityReference:"Jun synthetic keyword search authorization"};
function fixture() {
  let now=new Date("2026-09-09T02:00:00Z");
  vi.spyOn(Date,"now").mockImplementation(()=>now.getTime());
  const w=createTestWorkspace({fileBacked:true,clock:()=>now});cleanups.push(w.cleanup);
  const sources:Record<string,{subject:string;sender:string;body:string;at?:string}>={
    a1:{subject:"Example Co interview",sender:"hr@example.test",body:"Interview on Friday."},
    b1:{subject:"Weekly shopping discounts",sender:"shop@example.test",body:"x".repeat(100000)},
  };
  const queries:string[]=[],fullReads:string[]=[],metadataReads:string[]=[];
  const reader=new GmailMcpReader({get:(_c,n)=>({subject:`search-${n}`,email:`box${n}@example.test`,refreshToken:"test"})},
    {access:async()=>"test"},async input=>{
      const url=new URL(String(input)),format=url.searchParams.get("format");
      if(!format) {queries.push(url.searchParams.get("q")!);return Response.json({messages:Object.keys(sources).map(id=>({id,threadId:"t"+id}))});}
      const id=url.pathname.split("/").at(-1)!,s=sources[id]!;
      (format==="full"?fullReads:metadataReads).push(id);
      return Response.json({id,threadId:"t"+id,internalDate:String(Date.parse(s.at??"2026-09-09T01:00:00Z")),
        payload:{headers:[{name:"Subject",value:s.subject},{name:"From",value:`HR <${s.sender}>`}],
          ...(format==="full"?{mimeType:"text/plain",body:{data:Buffer.from(s.body).toString("base64url")}}:{})}});
    });
  const begin=(s=w.service)=>{const runId=randomUUID();s.mailScanService.start({...auth,runId,triggerType:"MANUAL",executionReference:"synthetic",receiptMode:"BACKEND",searchMode:"JOB_METADATA"},reader);return runId;};
  const args=(runId:string,mailbox="mailbox-1")=>({...auth,runId,mailbox,lane:"RECENT",limit:5});
  return {...w,reader,sources,queries,fullReads,metadataReads,begin,args,clock:()=>now,advance:(days:number)=>{now=new Date(now.getTime()+days*86400000);}};
}

it("screens headers first, never fetches excluded bodies or counts them as reviewed, and completes only the filtered scope",async()=>{
  const w=fixture(),run=w.begin();
  const result=await w.service.mailBatchService.next(w.args(run),w.reader);
  expect(w.fullReads).toEqual(["a1"]);expect(w.metadataReads).toEqual(["a1","b1"]);
  expect(w.queries[0]).toContain('subject:"interview"');expect(w.queries[0]).toContain('subject:"Example Co"');
  expect(result.messages).toHaveLength(1);expect(result.messages[0]).toMatchObject({metadata:{senderEmail:"hr@example.test"},processable:true});
  expect(w.service.mailScanService.get(run)).toMatchObject({searchPolicy:{coverage:"MATCHING_JOB_MAIL_ONLY"},screening:{metadataChecked:2,excludedWithoutBody:1}});
  expect(()=>w.service.mailBatchService.ack({...auth,runId:run,batchId:result.batch!.id,items:[{messageId:"b1",outcome:"IRRELEVANT",verified:true,requiredActionKeys:[]}]},w.reader)).toThrow(/complete source/);
  w.service.mailBatchService.ack({...auth,runId:run,batchId:result.batch!.id,items:[{messageId:"a1",outcome:"IRRELEVANT",verified:true,requiredActionKeys:[]}]},w.reader);
  delete w.sources.a1;delete w.sources.b1;
  await w.service.mailBatchService.next(w.args(run,"mailbox-2"),w.reader);
  const done=w.service.mailScanService.get(run);
  expect(done.status).toBe("COMPLETE");expect(done.mailboxes.every(m=>m.searchedFrom==="2026-09-08T02:00:00.000Z")).toBe(true);
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_processed").get()).toEqual({n:1});
  expect(JSON.stringify(w.database.prepare("SELECT * FROM job_mail_metadata").all())).not.toContain("Interview on Friday");
});

it("retains acknowledged application sender metadata for later follow-up and always retains new-application keyword discovery",async()=>{
  const w=fixture();delete w.sources.b1;const run=w.begin();
  const result=await w.service.mailBatchService.next(w.args(run),w.reader);
  const message=result.messages[0] as {externalId:string;receivedAt:string};
  const scanContext={runId:run,batchId:result.batch!.id,messageId:"a1",actionKey:"evidence"};
  const input={projectId:w.projectId,resourceType:"EMAIL" as const,provider:"gmail",externalId:message.externalId,externalUri:null,title:"Interview",
    observedFacts:{contractVersion:"gmail-job-observation-v0.1",sourceFacts:{receivedAt:message.receivedAt,senderDomain:"example.test"},
      interpretation:{company:"Example Co",role:"Software Engineer",emailKind:"RECRUITER_CONTACT",summary:"Interview Friday"}},
    observedAt:message.receivedAt,idempotencyKey:"search-evidence"};
  w.service.mailScanLedger.action(scanContext,"workspace_record_observation",input,()=>w.service.recordObservation(input));
  w.service.mailBatchService.ack({...auth,runId:run,batchId:result.batch!.id,items:[{messageId:"a1",outcome:"RECORDED",projectId:w.projectId,verified:true,requiredActionKeys:["evidence"]}]},w.reader);
  w.service.mailScanLedger.settle(run,"Other mailbox deferred");w.advance(0.25);
  w.sources.c1={subject:"Following up",sender:"hr@example.test",body:"Please confirm availability."};
  const next=w.begin(),again=await w.service.mailBatchService.next(w.args(next),w.reader);
  expect(w.queries.at(-1)).toContain('from:"hr@example.test"');expect(w.queries.at(-1)).toContain('subject:"application"');
  expect(again.messages).toHaveLength(1);expect(again.messages[0]).toMatchObject({id:"c1"});
  expect(w.fullReads.filter(id=>id==="a1")).toHaveLength(1);
});

it("caps interrupted recovery at 72 hours, excludes old windows without acknowledgements, and forbids mode downgrade",async()=>{
  const w=fixture();const run=w.begin();await w.service.mailBatchService.next(w.args(run),w.reader);
  w.service.mailScanLedger.settle(run,"Synthetic interruption");w.advance(5);
  w.sources.a1!.at="2026-09-13T01:00:00Z";
  const second=w.begin();const policy=w.service.mailScanService.get(second).searchPolicy!;
  expect(policy.mailboxes[0]!.searchedFrom).toBe("2026-09-11T02:00:00.000Z");
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_batches WHERE status='EXPIRED'").get()).toEqual({n:1});
  expect(w.database.prepare("SELECT count(*) n FROM mail_scan_processed").get()).toEqual({n:0});
  const resumed=new WorkspaceService(w.database,testPrincipal,{clock:w.clock});
  await resumed.mailBatchService.next(w.args(second),w.reader);
  expect(w.fullReads.filter(id=>id==="b1")).toHaveLength(0);
  resumed.mailScanLedger.settle(second,"Synthetic closure");
  expect(()=>resumed.mailScanService.start({...auth,runId:randomUUID(),triggerType:"MANUAL",executionReference:"",receiptMode:"BACKEND"},w.reader)).toThrow(/superseded/);
  expect(()=>resumed.mailScanService.start({...auth,runId:second,triggerType:"MANUAL",executionReference:"synthetic",receiptMode:"BACKEND"},w.reader)).toThrow(/immutable/);
});

it("keeps uncertain matched bodies pending and gates multipart acknowledgement until all parts are read",async()=>{
  const w=fixture();delete w.sources.b1;w.sources.a1!.body="x".repeat(50000)+" Final interview details.";
  const run=w.begin(),first=await w.service.mailBatchService.next(w.args(run),w.reader);
  const ack={...auth,runId:run,batchId:first.batch!.id,items:[{messageId:"a1",outcome:"IRRELEVANT",verified:true,requiredActionKeys:[]}]};
  expect(()=>w.service.mailBatchService.ack(ack,w.reader)).toThrow(/complete source/);
  const c=(first.messages[0] as {bodyContinuation:object}).bodyContinuation;
  const second=await w.service.mailBatchService.next({...w.args(run),bodyContinuation:c},w.reader);
  const third=await w.service.mailBatchService.next({...w.args(run),bodyContinuation:(second.messages[0] as {bodyContinuation:object}).bodyContinuation},w.reader);
  expect(third.messages[0]).toMatchObject({bodyReadProgress:{complete:true},processable:true});
  w.service.mailBatchService.ack(ack,w.reader);
});

it("treats search terms as literals and matches sender addresses exactly",()=>{
  const criteria={companies:['Acme" } after:1900 { subject:"Sale'],senders:["hr@example.test"]};
  expect(jobMailQuery(criteria)).not.toContain("after:");
  expect(matchesJobMail("Following up","fakehr@example.test",criteria)).toBeNull();
  expect(matchesJobMail("Following up","HR@example.test",criteria)).toBe("KNOWN_SENDER");
  expect(matchesJobMail("jobless newsletter",null,{companies:[],senders:[]})).toBeNull();
  expect(matchesJobMail("Thank you for applying",null,{companies:[],senders:[]})).toBe("JOB_SUBJECT");
});

it("builds follow-up company and sender criteria only from ongoing applications", () => {
  const w = fixture();
  const workspaceId = w.service.getProject(w.projectId).project.workspaceId;
  const create = (company: string, status: string, lifecycle: string) => {
    const projectId = randomUUID();
    w.service.seedJobApplication({ projectId, initialTransitionId: randomUUID(), title: company, company, role: "Engineer" });
    w.database.prepare("UPDATE projects SET status=?, lifecycle_state=? WHERE id=?").run(status, lifecycle, projectId);
    w.database.prepare("INSERT INTO job_mail_metadata VALUES(?,?,?,?,?,?,?,?)")
      .run(workspaceId, "mailbox-1", randomUUID(), "thread", "Follow up", `${company}@example.test`, "2026-09-09T01:00:00Z", projectId);
    return projectId;
  };
  const excluded = [create("rejected", "CLOSED", "REJECTED"), create("withdrawn", "CLOSED", "WITHDRAWN"),
    create("accepted", "CLOSED", "ACCEPTED"), create("paused", "PAUSED", "APPLIED"),
    create("inconsistent", "ACTIVE", "REJECTED")];
  const included = create("ongoing", "ACTIVE", "INTERVIEWING");
  const policy = w.service.mailScanService.get(w.begin()).searchPolicy!;
  const criteria = policy.mailboxes[0]!.criteria;
  expect(criteria.companies).toContain("ongoing");
  expect(criteria.senders).toEqual(["ongoing@example.test"]);
  for (const company of ["rejected", "withdrawn", "accepted", "paused", "inconsistent"]) expect(criteria.companies).not.toContain(company);
  const targets = w.service.jobSearchQueryService.applicationCheckTargets().map(p => p.projectId);
  expect(targets).toContain(included);
  for (const id of excluded) expect(targets).not.toContain(id);
  expect(policy.mailboxes[0]!.query).toContain('subject:"application"');
  expect(w.database.prepare("SELECT count(*) n FROM job_mail_metadata").get()).toEqual({ n: 6 });
});

it("adds only empty policy/metadata tables and supports repeated and older startup against a migrated copy",()=>{
  const w=fixture(),base=resolve(w.directory!,"before014"),old=resolve(w.directory!,"old014");
  mkdirSync(old);for(const f of readdirSync("db/migrations").filter(f=>f.endsWith('.sql')&&!f.startsWith('014_')))copyFileSync(resolve("db/migrations",f),resolve(old,f));
  const before=openDatabase(base,old);before.close();const after=resolve(w.directory!,"after014");copyFileSync(base,after);
  openDatabase(after).close();openDatabase(after).close();openDatabase(after,old).close();
  expect(verifyJobMailSearchMigration(base,after).status).toBe("PASS");
});
