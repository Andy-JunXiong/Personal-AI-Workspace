import {createHash,randomUUID} from "node:crypto";
import {z} from "zod";
import type {WorkspaceDatabase} from "../persistence/database.js";
import type {IdentityContext} from "../domain/types.js";
import {ConcurrencyConflictError,NotFoundError} from "../domain/errors.js";
import {validateJobFit} from "../domain/job-fit.js";

export const libraryInputSchema=z.object({sourceKey:z.string().trim().min(1).max(500),title:z.string().trim().min(1).max(500),
 sourceUrl:z.string().url().max(2000).nullable(),content:z.string().trim().min(1).max(50000),
 reviewStatus:z.enum(["SOURCE","CONFIRMED","EXCLUDED"]),expectedVersion:z.number().int().min(0)}).strict();
export interface LibrarySource {id:string;source_key:string;title:string;source_url:string|null;content:string;review_status:"SOURCE"|"CONFIRMED"|"EXCLUDED";record_version:number;updated_at:string}
export interface CandidateFit {candidate_id:string;jd_text:string;jd_source_url:string|null;library_hash:string;assessment_json:string;score:number|null;coverage:number;resume_draft:string;updated_at:string}

export class JobLibraryService {
 constructor(private db:WorkspaceDatabase,private identity:()=>IdentityContext,private clock=()=>new Date()){}
 workspaceId(){return this.identity().workspaceId;}
 identityContext(){return this.identity();}
 knownPostingUrls(){return new Set((this.db.prepare("SELECT source_url FROM job_candidates WHERE workspace_id=?")
   .all(this.workspaceId()) as {source_url:string|null}[]).flatMap(r=>r.source_url?[r.source_url]:[]));}
 applicationPostingUrls(){return (this.db.prepare("SELECT json_extract(metadata_json,'$.postingReference') AS url FROM projects WHERE workspace_id=? AND project_type='job_application'")
   .all(this.workspaceId()) as {url:string|null}[]).flatMap(r=>typeof r.url==="string"?[r.url]:[]);}
 description(id:string){this.candidate(id);return this.db.prepare("SELECT jd_text,source_url FROM job_candidate_descriptions WHERE candidate_id=? AND workspace_id=?").get(id,this.workspaceId()) as {jd_text:string;source_url:string}|undefined;}
 saveDescription(id:string,jd:string,url:string){this.candidate(id);
   this.db.prepare("INSERT INTO job_candidate_descriptions VALUES(?,?,?,?,?) ON CONFLICT(candidate_id) DO UPDATE SET jd_text=excluded.jd_text,source_url=excluded.source_url,updated_at=excluded.updated_at")
     .run(id,this.workspaceId(),z.string().min(200).max(50000).parse(jd),z.string().url().parse(url),this.clock().toISOString());}
 sources():LibrarySource[]{return this.db.prepare("SELECT * FROM job_library_sources WHERE workspace_id=? ORDER BY title,id").all(this.identity().workspaceId) as LibrarySource[];}
 snapshot(){const sources=this.sources().filter(s=>s.review_status!=="EXCLUDED");
   return {sources,hash:createHash("sha256").update(JSON.stringify(sources.map(s=>[s.id,s.record_version,s.review_status]))).digest("hex")};}
 saveSource(input:unknown){const v=libraryInputSchema.parse(input),ws=this.identity().workspaceId;
   return this.db.transaction(()=>{
     const old=this.db.prepare("SELECT * FROM job_library_sources WHERE workspace_id=? AND source_key=?").get(ws,v.sourceKey) as LibrarySource|undefined;
     if(old&&old.title===v.title&&old.source_url===v.sourceUrl&&old.content===v.content&&old.review_status===v.reviewStatus)
       return {id:old.id,recordVersion:old.record_version};
     if((old?.record_version??0)!==v.expectedVersion) throw new ConcurrencyConflictError("Library source changed; reload before saving");
     const id=old?.id??randomUUID(),version=(old?.record_version??0)+1;
     this.db.prepare(`INSERT INTO job_library_sources(id,workspace_id,source_key,title,source_url,content,review_status,record_version,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,source_key) DO UPDATE SET title=excluded.title,source_url=excluded.source_url,
       content=excluded.content,review_status=excluded.review_status,record_version=excluded.record_version,updated_at=excluded.updated_at`)
       .run(id,ws,v.sourceKey,v.title,v.sourceUrl,v.content,v.reviewStatus,version,this.clock().toISOString());
     return {id,recordVersion:version};
   })();
 }
 private candidate(id:string){if(!this.db.prepare("SELECT 1 FROM job_candidates WHERE id=? AND workspace_id=?").get(id,this.identity().workspaceId))throw new NotFoundError("Candidate unavailable");}
 fit(id:string){this.candidate(id);return this.db.prepare("SELECT * FROM job_candidate_fit WHERE candidate_id=? AND workspace_id=?").get(id,this.identity().workspaceId) as CandidateFit|undefined;}
 fits(){return this.db.prepare("SELECT * FROM job_candidate_fit WHERE workspace_id=?").all(this.identity().workspaceId) as CandidateFit[];}
 saveFit(id:string,jd:string,sourceUrl:string|null,input:unknown,libraryHash:string,expectedUpdatedAt?:string|null){this.candidate(id);const snapshot=this.snapshot();
   const previous=this.fit(id);
   if(expectedUpdatedAt!==undefined&&(previous?.updated_at??null)!==expectedUpdatedAt)throw new ConcurrencyConflictError("Comparison or draft changed during analysis");
   if(snapshot.hash!==libraryHash)throw new ConcurrencyConflictError("Library changed during comparison; rerun");
   const result=validateJobFit(input,jd,snapshot.sources);
   const draft=result.report.resumeSections.map(s=>`## ${s.heading}\n\n${s.quotes.map(q=>q.text).join("\n\n")}`).join("\n\n");
   this.db.prepare(`INSERT INTO job_candidate_fit VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(candidate_id) DO UPDATE SET
     jd_text=excluded.jd_text,jd_source_url=excluded.jd_source_url,library_hash=excluded.library_hash,assessment_json=excluded.assessment_json,
     score=excluded.score,coverage=excluded.coverage,resume_draft=excluded.resume_draft,updated_at=excluded.updated_at`)
     .run(id,this.identity().workspaceId,jd,sourceUrl,libraryHash,JSON.stringify(result.report),result.score,result.coverage,draft,
       new Date(Math.max(this.clock().valueOf(),previous?Date.parse(previous.updated_at)+1:0)).toISOString());
   return this.fit(id)!;
 }
 saveDraft(id:string,draft:string,expectedUpdatedAt:string){this.candidate(id);const value=z.string().max(50000).parse(draft);
   if(!this.db.prepare("UPDATE job_candidate_fit SET resume_draft=?,updated_at=? WHERE candidate_id=? AND workspace_id=? AND updated_at=?")
     .run(value,new Date(Math.max(this.clock().valueOf(),Date.parse(expectedUpdatedAt)+1)).toISOString(),id,this.identity().workspaceId,expectedUpdatedAt).changes)throw new ConcurrencyConflictError("Draft changed; reload");
   return this.fit(id)!;
 }
 beginRun(){return this.db.transaction(()=>{const ws=this.identity().workspaceId;
   this.db.prepare("UPDATE job_discovery_runs SET status='INTERRUPTED',finished_at=? WHERE workspace_id=? AND status='RUNNING' AND started_at<?")
     .run(this.clock().toISOString(),ws,new Date(this.clock().valueOf()-1800000).toISOString());
   const last=this.recentRun();if(last?.status==='RUNNING')return {id:last.id,created:false};
   const id=randomUUID();this.db.prepare("INSERT INTO job_discovery_runs(id,workspace_id,started_at,status) VALUES(?,?,?,'RUNNING')").run(id,ws,this.clock().toISOString());return {id,created:true};})();}
 finishRun(id:string,result:unknown,status="DONE"){this.db.prepare("UPDATE job_discovery_runs SET status=?,finished_at=?,result_json=? WHERE id=? AND workspace_id=?")
   .run(status,this.clock().toISOString(),JSON.stringify(result),id,this.identity().workspaceId);}
 recentRun(){const run=this.db.prepare("SELECT * FROM job_discovery_runs WHERE workspace_id=? ORDER BY started_at DESC,rowid DESC LIMIT 1").get(this.identity().workspaceId) as {id:string;status:string;result_json:string;started_at:string}|undefined;
   return run?.status==="RUNNING"&&this.clock().valueOf()-Date.parse(run.started_at)>1800000?{...run,status:"INTERRUPTED",result_json:JSON.stringify({error:"上次同步中断，请重新同步。"})}:run;}
}
