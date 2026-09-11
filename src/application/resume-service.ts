import {z} from "zod";
import {canonicalHash} from "../domain/canonical-json.js";
import {createHash,randomUUID} from "node:crypto";
import type {WorkspaceDatabase} from "../persistence/database.js";
import type {IdentityContext} from "../domain/types.js";
import {ConcurrencyConflictError,IdempotencyConflictError,NotFoundError,ValidationError} from "../domain/errors.js";
import {resumeDocumentSchema,resumeSaveSchema,resumeVariantCreateSchema} from "../domain/resume-document.js";

interface Row {template_docx:Buffer;template_sha256:string;source_url:string;content_json:string;record_version:number;updated_at:string;id?:string;name?:string;candidate_id?:string|null;project_id?:string|null;company?:string;role?:string;source_base_version?:number}
export class ResumeService {
  constructor(private db:WorkspaceDatabase,private identity:()=>IdentityContext,private clock=()=>new Date()){}
  private row(variantId?:string):Row|undefined{
    if(!variantId)return this.db.prepare("SELECT * FROM resume_documents WHERE workspace_id=?").get(this.identity().workspaceId) as Row|undefined;
    z.uuid().parse(variantId);
    const row=this.db.prepare("SELECT v.*,b.template_docx,b.template_sha256,b.source_url FROM resume_variants v JOIN resume_documents b ON b.workspace_id=v.workspace_id WHERE v.workspace_id=? AND v.id=?").get(this.identity().workspaceId,variantId) as Row|undefined;
    if(!row)throw new NotFoundError("Resume version not found");return row;
  }
  get(variantId?:string){const r=this.row(variantId);return r?{content:resumeDocumentSchema.parse(JSON.parse(r.content_json)),recordVersion:r.record_version,updatedAt:r.updated_at,sourceUrl:r.source_url,variant:r.id?{id:r.id,name:r.name!,candidateId:r.candidate_id??null,projectId:r.project_id??null,company:r.company!,role:r.role!,sourceBaseVersion:r.source_base_version!}:null}:null;}

  listVariants(){
    return this.db.prepare("SELECT id,name,company,role,candidate_id AS candidateId,project_id AS projectId,source_base_version AS sourceBaseVersion,record_version AS recordVersion,updated_at AS updatedAt FROM resume_variants WHERE workspace_id=? ORDER BY updated_at DESC,id").all(this.identity().workspaceId) as Array<{id:string;name:string;company:string;role:string;candidateId:string|null;projectId:string|null;sourceBaseVersion:number;recordVersion:number;updatedAt:string}>;
  }
  listApplicationVariants(projectId:string){
    z.uuid().parse(projectId);
    const workspace=this.identity().workspaceId;
    return this.db.prepare(`SELECT v.id,v.name,v.company,v.role,v.candidate_id AS candidateId,
      v.project_id AS projectId,v.source_base_version AS sourceBaseVersion,
      v.record_version AS recordVersion,v.updated_at AS updatedAt
      FROM resume_variants v JOIN projects p ON p.id=v.project_id
      WHERE v.workspace_id=? AND v.project_id=? AND p.workspace_id=?
      AND p.project_type='job_application' ORDER BY v.updated_at DESC,v.id`)
      .all(workspace,projectId,workspace) as ReturnType<ResumeService["listVariants"]>;
  }
  targets(){
    const workspace=this.identity().workspaceId;
    const candidates=this.db.prepare("SELECT id,company,role FROM job_candidates WHERE workspace_id=? ORDER BY updated_at DESC,id").all(workspace) as Array<{id:string;company:string;role:string}>;
    const applications=this.db.prepare("SELECT id,json_extract(metadata_json,'$.company') AS company,json_extract(metadata_json,'$.role') AS role FROM projects WHERE workspace_id=? AND project_type='job_application' ORDER BY updated_at DESC,id").all(workspace) as Array<{id:string;company:string;role:string}>;
    return {candidates,applications};
  }
  createVariant(input:unknown){
    const parsed=resumeVariantCreateSchema.parse(input),identity=this.identity(),hash=canonicalHash(parsed);
    return this.db.transaction(()=>{
      const prior=this.db.prepare("SELECT request_hash,response_json FROM idempotency_records WHERE workspace_id=? AND operation='resume.variant.create' AND idempotency_key=?").get(identity.workspaceId,parsed.intentKey) as {request_hash:string;response_json:string}|undefined;
      if(prior){if(prior.request_hash!==hash)throw new IdempotencyConflictError("Create request changed; use a new intent");return JSON.parse(prior.response_json) as NonNullable<ReturnType<ResumeService["get"]>>;}
      const base=this.get();if(!base)throw new NotFoundError("Resume template not configured");
      if(base.recordVersion!==parsed.expectedBaseVersion)throw new ConcurrencyConflictError("Base resume changed; reload before copying");
      const target=(parsed.targetType==="CANDIDATE"?this.targets().candidates:this.targets().applications).find(t=>t.id===parsed.targetId);
      if(!target)throw new NotFoundError("Job target not found");
      if(this.listVariants().length>=200)throw new ValidationError("At most 200 named resume versions");
      if(this.db.prepare("SELECT 1 FROM resume_variants WHERE workspace_id=? AND name=? COLLATE NOCASE").get(identity.workspaceId,parsed.name))throw new ConcurrencyConflictError("Resume version name already exists");
      const id=randomUUID(),now=this.clock().toISOString();
      this.db.prepare("INSERT INTO resume_variants(id,workspace_id,name,candidate_id,project_id,company,role,source_base_version,content_json,record_version,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?)")
        .run(id,identity.workspaceId,parsed.name,parsed.targetType==="CANDIDATE"?target.id:null,parsed.targetType==="APPLICATION"?target.id:null,target.company,target.role,base.recordVersion,JSON.stringify(base.content),identity.principalId,identity.principalId,now,now);
      const saved=this.get(id)!;
      this.db.prepare("INSERT INTO idempotency_records VALUES(?,?,?,?,?,?)").run(identity.workspaceId,"resume.variant.create",parsed.intentKey,hash,JSON.stringify(saved),now);return saved;
    })();
  }
  // Administrative initialization only: the private template is never committed to Git.
  initialize(template:Buffer,content:unknown,sourceUrl:string){
    const parsed=resumeDocumentSchema.parse(content);
    if(template.length>2_000_000||template.subarray(0,2).toString()!=="PK"||!/^https:\/\/(docs|drive)\.google\.com\//u.test(sourceUrl))throw new ValidationError("Invalid template");
    this.db.transaction(()=>{
      if(this.row())throw new ConcurrencyConflictError("Resume is already initialized");
      this.db.prepare("INSERT INTO resume_documents VALUES (?,?,?,?,?,1,?,?)").run(this.identity().workspaceId,template,createHash("sha256").update(template).digest("hex"),sourceUrl,JSON.stringify(parsed),this.identity().principalId,this.clock().toISOString());
    })();return this.get()!;
  }
  save(input:unknown,variantId?:string){const {expectedVersion,content}=resumeSaveSchema.parse(input);
    return this.db.transaction(()=>{
      const current=this.get(variantId);if(!current)throw new NotFoundError("Resume template not configured");
      // An editor opened before section ordering was released must not erase it.
      if(content.sectionOrder===undefined&&current.content.sectionOrder)content.sectionOrder=current.content.sectionOrder;
      if(content.name!==current.content.name||content.contact!==current.content.contact)throw new ValidationError("Name and contact are fixed template fields");
      if(expectedVersion!==current.recordVersion)throw new ConcurrencyConflictError("Resume changed in another window");
      if(JSON.stringify(content)===JSON.stringify(current.content))return current;
      const args=[JSON.stringify(content),this.identity().principalId,this.clock().toISOString(),this.identity().workspaceId,expectedVersion];
      const updated=variantId?this.db.prepare("UPDATE resume_variants SET content_json=?,record_version=record_version+1,updated_by=?,updated_at=? WHERE workspace_id=? AND record_version=? AND id=?").run(...args,variantId)
        :this.db.prepare("UPDATE resume_documents SET content_json=?,record_version=record_version+1,updated_by=?,updated_at=? WHERE workspace_id=? AND record_version=?").run(...args);
      if(updated.changes!==1)throw new ConcurrencyConflictError("Resume changed in another window");
      return this.get(variantId)!;
    })();
  }
  exportSnapshot(version:number,variantId?:string){const r=this.row(variantId);if(!r)throw new NotFoundError("Resume template not configured");
    if(r.record_version!==version)throw new ConcurrencyConflictError("Resume changed; reload before export");
    return {template:r.template_docx,content:resumeDocumentSchema.parse(JSON.parse(r.content_json)),version,name:r.name??"Resume"};
  }
  previewSnapshot(version:number,input:unknown,variantId?:string){
    const snapshot=this.exportSnapshot(version,variantId),content=resumeDocumentSchema.parse(input);
    if(content.name!==snapshot.content.name||content.contact!==snapshot.content.contact)throw new ValidationError("Name and contact are fixed template fields");
    return {...snapshot,content};
  }
}
