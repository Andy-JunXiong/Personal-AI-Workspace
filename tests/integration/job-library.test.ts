import {randomUUID} from "node:crypto";
import {copyFileSync,mkdirSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {expect,it,vi} from "vitest";
import {createEmptyTestWorkspace} from "../helpers/test-workspace.js";
import {WorkspaceService} from "../../src/application/workspace-service.js";
import {validateJobFit} from "../../src/domain/job-fit.js";
import {libraryView,fitPanel} from "../../src/web/job-library-views.js";
import {alertJobLinks,canonicalJobUrl,fetchJobPosting,postingFromHtml} from "../../src/application/job-posting-source.js";
import {openDatabase} from "../../src/persistence/database.js";
import {verifyJobLibraryMigration} from "../../scripts/verify-job-library-migration.js";
import * as postingSource from "../../src/application/job-posting-source.js";
import {discoverJobs} from "../../src/application/job-discovery.js";
import type {GmailMcpReader} from "../../src/gmail/mcp-reader.js";

const sourceInput={sourceKey:"test:resume",title:"Historical resume",sourceUrl:"https://example.test/resume",content:"Acme 2020–2024: Built Python APIs.",reviewStatus:"SOURCE",expectedVersion:0};
const report=(sourceId:string)=>({summary:"Evidence-based comparison",conflicts:[],requirements:[
  {requirement:"Python",jdQuote:"Python",importance:"REQUIRED",assessment:"MATCH",sourceId,evidenceQuote:"Built Python APIs.",explanation:"Documented experience"},
  {requirement:"Java",jdQuote:"Java",importance:"PREFERRED",assessment:"UNKNOWN",sourceId:"",evidenceQuote:"",explanation:"No evidence"},
],resumeSections:[{heading:"Experience",quotes:[{sourceId,text:sourceInput.content}]}]});

it("migrates an existing workspace additively and supports repeat and older starts",()=>{
  const w=createEmptyTestWorkspace();
  try{
    const old=resolve(w.directory,"migrations014");mkdirSync(old);
    for(const f of readdirSync("db/migrations").filter(f=>f.endsWith(".sql")&&f<"015_"))copyFileSync(resolve("db/migrations",f),resolve(old,f));
    const before=resolve(w.directory,"before.db"),after=resolve(w.directory,"after.db");
    const baseline=openDatabase(before,old);
    new WorkspaceService(baseline,{issuer:"migration",subject:"user",workspaceName:"Retained"}).ensureDevelopmentIdentity();
    baseline.close();copyFileSync(before,after);
    openDatabase(after).close();openDatabase(after).close();openDatabase(after,old).close();
    expect(verifyJobLibraryMigration(before,after)).toMatchObject({status:"PASS",addedTables:["job_candidate_descriptions","job_candidate_fit","job_discovery_runs","job_library_sources"]});
  }finally{w.cleanup();}
});

it("isolates source ownership, rejects stale writes and evidence, invalidates fits and preserves edited drafts on comparison races",()=>{
  const w=createEmptyTestWorkspace({clock:()=>new Date("2026-09-09T00:00:00Z")});
  try{
    const library=w.service.jobLibraryService;
    const source=library.saveSource(sourceInput);
    expect(library.saveSource(sourceInput)).toEqual(source);
    expect(()=>library.saveSource({...sourceInput,content:"Changed"})).toThrow(/changed/);
    const other=new WorkspaceService(w.database,{issuer:"other",subject:"other",workspaceName:"Other"});other.ensureDevelopmentIdentity();
    expect(other.jobLibraryService.sources()).toEqual([]);
    const {candidate}=w.service.candidateService.recordCandidate({provider:"seek",postingId:"123",sourceUrl:"https://www.seek.com.au/job/123",title:"Python Developer",company:"Acme",role:"Developer",authority:{type:"EXPLICIT_USER_DEV",confirmed:true,reference:"test"},idempotencyKey:randomUUID()});
    expect(()=>other.jobLibraryService.fit(candidate.id)).toThrow();
    const snapshot=library.snapshot();
    const fit=library.saveFit(candidate.id,"Python required. Java preferred.",candidate.sourceUrl,report(source.id),snapshot.hash,null);
    expect(fit).toMatchObject({score:75,coverage:75});
    expect(fit.resume_draft).toContain(sourceInput.content);
    const edited=library.saveDraft(candidate.id,"User reviewed draft",fit.updated_at);
    expect(edited.updated_at).not.toBe(fit.updated_at);
    expect(()=>library.saveDraft(candidate.id,"Stale tab",fit.updated_at)).toThrow();
    expect(()=>library.saveFit(candidate.id,fit.jd_text,candidate.sourceUrl,report(source.id),snapshot.hash,fit.updated_at)).toThrow();
    expect(library.fit(candidate.id)?.resume_draft).toBe("User reviewed draft");
    library.saveSource({...sourceInput,content:"<script>alert(1)</script> Updated experience",expectedVersion:source.recordVersion});
    expect(()=>library.saveFit(candidate.id,fit.jd_text,candidate.sourceUrl,report(source.id),snapshot.hash)).toThrow();
    const html=libraryView(w.service);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(fitPanel(w.service,candidate.id,candidate.sourceUrl)).toContain("资料库已更新");
  }finally{w.cleanup();}
});

it("does not count unsupported quotes, duplicate requirements or unknown evidence; conflicts suppress score",()=>{
  const sources=[{id:"source",title:"Resume",content:sourceInput.content,review_status:"SOURCE"}];
  expect(validateJobFit({...report("source"),conflicts:["Dates differ"]},"Python Java",sources).score).toBeNull();
  expect(()=>validateJobFit(report("foreign-source"),"Python Java",sources)).toThrow();
  expect(()=>validateJobFit(report("source"),"Python Java",[{...sources[0]!,review_status:"EXCLUDED"}])).toThrow();
  expect(()=>validateJobFit({...report("source"),requirements:[report("source").requirements[0],report("source").requirements[0]]},"Python Java",sources)).toThrow(/Duplicate/);
  expect(()=>validateJobFit({...report("source"),resumeSections:[{heading:"Experience",quotes:[{sourceId:"source",text:"Invented achievement"}]}]},"Python Java",sources)).toThrow();
});

it("only follows public canonical posting URLs and requires a substantive unique JobPosting",async()=>{
  expect(canonicalJobUrl("https://www.linkedin.com/comm/jobs/view/123?tracking=x")?.url).toBe("https://www.linkedin.com/jobs/view/123");
  expect(canonicalJobUrl("https://www.linkedin.com/jobs/view/engineer-123?trackingId=x")?.postingId).toBe("123");
  for(const url of ["http://www.seek.com.au/job/123","https://seek.com.au.evil.test/job/123","https://user@www.seek.com.au/job/123","https://127.0.0.1/job/123","https://www.seek.com.au:8443/job/123"])
    expect(canonicalJobUrl(url)).toBeNull();
  expect(alertJobLinks("https://www.seek.com.au/job/123?a=x https://www.seek.com.au/job/123?b=x")).toHaveLength(1);
  expect(postingFromHtml("<h1>Sign in to view jobs</h1>")).toBeNull();
  const html=`<script type="application/ld+json">${JSON.stringify({"@type":"JobPosting",title:"Engineer",hiringOrganization:{name:"Acme"},description:"<p>Build Python APIs and collaborate with the team. </p>".repeat(8)})}</script>`;
  expect(postingFromHtml(html)?.company).toBe("Acme");
  expect(postingFromHtml(html+html)).toBeNull();
  let calls=0;
  const fetcher=(async()=>{calls++;return new Response(null,{status:302,headers:{location:"http://127.0.0.1/secrets"}});}) as typeof fetch;
  expect(await fetchJobPosting("https://www.seek.com.au/job/123",fetcher)).toBeNull();expect(calls).toBe(1);
});

it("imports targeted alert links without application events, preserves decisions and known details on blocked JD fetches",async()=>{
  const w=createEmptyTestWorkspace();
  const fetcher=vi.spyOn(postingSource,"fetchJobPosting").mockResolvedValue(null);
  try{
    const web=new WorkspaceService(w.database,{...w.identity,channel:"WEB",requestId:randomUUID()});
    const {candidate}=web.candidateService.recordDiscoveredCandidateFromWeb({provider:"seek",postingId:"123",sourceUrl:"https://www.seek.com.au/job/123",title:"Known engineer",company:"Acme",role:"Engineer",sourceAvailability:"AVAILABLE"});
    web.candidateService.decideCandidateFromWeb({candidateId:candidate.id,action:"DISMISS",expectedRecordVersion:candidate.recordVersion,intentKey:randomUUID()});
    let bodyReads=0,modelCalls=0;
    const reader={accountKey:()=>"same",jobAlerts:async()=>({messages:[{id:"abc",threadId:"abc"},{id:"def",threadId:"def"}],complete:false}),
      metadata:async(_identity:unknown,input:{messageId:string})=>({senderEmail:input.messageId==="abc"?"jobs@seek.com.au":"unrelated@example.test",receivedAt:new Date().toISOString()}),
      read:async()=>{bodyReads++;return {text:"https://www.seek.com.au/job/123 https://www.linkedin.com/comm/jobs/view/456",bodyComplete:true};}} as unknown as GmailMcpReader;
    const result=await discoverJobs(web,reader,()=>{}, {analyze:async()=>{modelCalls++;throw new Error("Unexpected call without JD");}});
    expect(result).toMatchObject({candidateCount:2,jdCount:0,missingJd:2});
    expect(bodyReads).toBe(2);expect(modelCalls).toBe(0);expect(fetcher).toHaveBeenCalledTimes(2);
    expect(web.jobSearchQueryService.getCandidate(candidate.id)).toMatchObject({company:"Acme",decision:"DISMISSED",role:"Engineer"});
    expect(w.database.prepare("SELECT count(*) n FROM projects").get()).toEqual({n:0});
    expect(w.database.prepare("SELECT count(*) n FROM resources").get()).toEqual({n:0});
    expect(web.jobSearchQueryService.listCandidates().totalCount).toBe(2);
  }finally{fetcher.mockRestore();w.cleanup();}
});
