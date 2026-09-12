import {Router,type Request} from "express";
import {z} from "zod";
import type {WorkspaceService} from "../application/workspace-service.js";
import type {JobFitAnalyzer} from "../application/job-fit-analyzer.js";
import {ConcurrencyConflictError,ValidationError} from "../domain/errors.js";
import type {GmailMcpReader} from "../gmail/mcp-reader.js";
import {discoverJobs} from "../application/job-discovery.js";
import {githubRefreshSchema} from "../domain/skill-library.js";

export function createJobLibraryRouter(serviceFor:(request:Request)=>WorkspaceService,
  authorizeWrite:(request:Request)=>unknown,analyzer?:JobFitAnalyzer,reader?:GmailMcpReader){
  const router=Router();
  const active=new Set<string>();
  router.post("/library/github-projects/refresh",async(request,response)=>{
    authorizeWrite(request);
    const input=githubRefreshSchema.omit({userConfirmed:true,authorityReference:true}).parse(request.body);
    const service=serviceFor(request),key=`github:${service.jobLibraryService.workspaceId()}`;
    if(active.has(key))throw new ConcurrencyConflictError("A GitHub refresh is already running");
    active.add(key);
    try{response.json(await service.skillLibraryService.refreshGithub({...input,userConfirmed:true,
      authorityReference:`Authenticated GitHub project refresh button ${input.idempotencyKey}`},()=>authorizeWrite(request)));}
    finally{active.delete(key);}
  });
  router.get("/library/discovery",(request,response)=>response.json({run:serviceFor(request).jobLibraryService.recentRun()??null}));
  router.post("/library/discovery",(request,response)=>{
    authorizeWrite(request);z.object({}).strict().parse(request.body);
    if(!reader)throw new ValidationError("Connect mailboxes first");
    const service=serviceFor(request),library=service.jobLibraryService;
    const run=library.beginRun();
    if(run.created)void discoverJobs(service,reader,()=>authorizeWrite(request),analyzer)
      .then(result=>library.finishRun(run.id,result))
      .catch(()=>{try{library.finishRun(run.id,{error:"同步中断，已导入的候选职位会保留。"},"FAILED");}
        catch{console.error(JSON.stringify({event:"job_discovery_receipt_unavailable"}));}});
    response.status(202).json(run);
  });
  router.post("/library/sources",(request,response)=>{
    authorizeWrite(request);
    response.json(serviceFor(request).jobLibraryService.saveSource(request.body));
  });
  router.post("/library/candidates/:id/decide",(request,response)=>{
    authorizeWrite(request);
    const input=z.object({action:z.enum(["SAVE","DISMISS","RESTORE"]),expectedRecordVersion:z.number().int().positive(),intentKey:z.string().uuid()}).strict().parse(request.body);
    response.json(serviceFor(request).candidateService.decideCandidateFromWeb({...input,candidateId:z.string().uuid().parse(request.params.id)}));
  });
  router.post("/library/candidates/:id/screening-override", (request, response) => {
    authorizeWrite(request);
    const input = z.object({ mode: z.enum(["KEEP", "AUTOMATIC"]), expectedCandidateVersion: z.number().int().positive(),
      expectedScreeningVersion: z.number().int().min(0), expectedOverrideVersion: z.number().int().min(0),
      intentKey: z.uuid() }).strict().parse(request.body);
    const { intentKey, ...versions } = input;
    response.json(serviceFor(request).candidateScreeningService.setOverride({ ...versions,
      candidateId: z.uuid().parse(request.params.id), userConfirmed: true, idempotencyKey: intentKey,
      reason: input.mode === "KEEP" ? "用户选择保留此职位，不受自动筛选隐藏。" : "用户选择取消保留，恢复按筛选结果显示。",
      authorityReference: `Authenticated website screening ${input.mode} button intent ${intentKey}` }));
  });
  router.post("/library/candidates/:id/compare",async(request,response)=>{
    authorizeWrite(request);
    const service=serviceFor(request),id=z.string().uuid().parse(request.params.id);
    service.jobSearchQueryService.getCandidate(id);
    const input=z.object({jd:z.string().trim().min(200).max(50000),sourceUrl:z.string().url().max(2000).nullable()}).strict().parse(request.body);
    if(!analyzer)throw new ValidationError("Comparison is not configured");
    const snapshot=service.jobLibraryService.snapshot();
    const expectedUpdatedAt=service.jobLibraryService.fit(id)?.updated_at??null;
    // One potentially expensive comparison per workspace, including overlapping tabs.
    const key=service.jobLibraryService.workspaceId();
    if(active.has(key))throw new ConcurrencyConflictError("Comparison already running");
    active.add(key);
    try{
      const result=await analyzer.analyze(input.jd,snapshot.sources,AbortSignal.timeout(120000));
      // Revalidate session/membership after the asynchronous provider call.
      authorizeWrite(request);
      response.json(serviceFor(request).jobLibraryService.saveFit(id,input.jd,input.sourceUrl,result,snapshot.hash,expectedUpdatedAt));
    }finally{active.delete(key);}
  });
  router.post("/library/candidates/:id/draft",(request,response)=>{
    authorizeWrite(request);
    const input=z.object({draft:z.string().max(50000),expectedUpdatedAt:z.string().datetime()}).strict().parse(request.body);
    response.json(serviceFor(request).jobLibraryService.saveDraft(z.string().uuid().parse(request.params.id),input.draft,input.expectedUpdatedAt));
  });
  router.post("/library/candidates/:id/description",(request,response)=>{
    authorizeWrite(request);
    const service=serviceFor(request),id=z.string().uuid().parse(request.params.id);
    const candidate=service.jobSearchQueryService.getCandidate(id);
    const input=z.object({jd:z.string().trim().min(1).max(50000),sourceUrl:z.string().url().max(2000).nullable()}).strict().parse(request.body);
    const url=input.sourceUrl??candidate.sourceUrl;
    if(!url)throw new ValidationError("Posting source URL required");
    service.jobLibraryService.saveDescription(id,input.jd,url);
    response.json({saved:true});
  });
  router.get("/library/candidates/:id/resume",(request,response)=>{
    const service=serviceFor(request),id=z.string().uuid().parse(request.params.id);
    const candidate=service.jobSearchQueryService.getCandidate(id),fit=service.jobLibraryService.fit(id);
    if(!fit)throw new ValidationError("No draft available");
    if(fit.library_hash!==service.jobLibraryService.snapshot().hash)throw new ConcurrencyConflictError("Library changed; compare again before downloading");
    const filename=`Jun_Xiong_${candidate.company}_${candidate.role}_Resume_Draft.md`.replace(/[^A-Za-z0-9_.-]/g,"_").slice(0,180);
    response.set("Content-Disposition",`attachment; filename="${filename}"`).type("text/markdown").send(fit.resume_draft);
  });
  return router;
}
