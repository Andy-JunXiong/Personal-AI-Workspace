import {createHash} from "node:crypto";
import type {WorkspaceDatabase} from "../persistence/database.js";
import type {IdentityContext} from "../domain/types.js";
import {ConcurrencyConflictError,NotFoundError,ValidationError} from "../domain/errors.js";
import {resumeDocumentSchema,resumeSaveSchema} from "../domain/resume-document.js";

interface Row {template_docx:Buffer;template_sha256:string;source_url:string;content_json:string;record_version:number;updated_at:string}
export class ResumeService {
  constructor(private db:WorkspaceDatabase,private identity:()=>IdentityContext,private clock=()=>new Date()){}
  private row(){return this.db.prepare("SELECT * FROM resume_documents WHERE workspace_id=?").get(this.identity().workspaceId) as Row|undefined;}
  get(){const r=this.row();return r?{content:resumeDocumentSchema.parse(JSON.parse(r.content_json)),recordVersion:r.record_version,updatedAt:r.updated_at,sourceUrl:r.source_url}:null;}
  // Administrative initialization only: the private template is never committed to Git.
  initialize(template:Buffer,content:unknown,sourceUrl:string){
    const parsed=resumeDocumentSchema.parse(content);
    if(template.length>2_000_000||template.subarray(0,2).toString()!=="PK"||!/^https:\/\/(docs|drive)\.google\.com\//u.test(sourceUrl))throw new ValidationError("Invalid template");
    this.db.transaction(()=>{
      if(this.row())throw new ConcurrencyConflictError("Resume is already initialized");
      this.db.prepare("INSERT INTO resume_documents VALUES (?,?,?,?,?,1,?,?)").run(this.identity().workspaceId,template,createHash("sha256").update(template).digest("hex"),sourceUrl,JSON.stringify(parsed),this.identity().principalId,this.clock().toISOString());
    })();return this.get()!;
  }
  save(input:unknown){const {expectedVersion,content}=resumeSaveSchema.parse(input);
    return this.db.transaction(()=>{
      const current=this.get();if(!current)throw new NotFoundError("Resume template not configured");
      if(content.name!==current.content.name||content.contact!==current.content.contact)throw new ValidationError("Name and contact are fixed template fields");
      if(expectedVersion!==current.recordVersion)throw new ConcurrencyConflictError("Resume changed in another window");
      if(JSON.stringify(content)===JSON.stringify(current.content))return current;
      this.db.prepare("UPDATE resume_documents SET content_json=?,record_version=record_version+1,updated_by=?,updated_at=? WHERE workspace_id=? AND record_version=?")
        .run(JSON.stringify(content),this.identity().principalId,this.clock().toISOString(),this.identity().workspaceId,expectedVersion);
      return this.get()!;
    })();
  }
  exportSnapshot(version:number){const r=this.row();if(!r)throw new NotFoundError("Resume template not configured");
    if(r.record_version!==version)throw new ConcurrencyConflictError("Resume changed; reload before export");
    return {template:r.template_docx,content:resumeDocumentSchema.parse(JSON.parse(r.content_json)),version};
  }
  previewSnapshot(version:number,input:unknown){
    const snapshot=this.exportSnapshot(version),content=resumeDocumentSchema.parse(input);
    if(content.name!==snapshot.content.name||content.contact!==snapshot.content.contact)throw new ValidationError("Name and contact are fixed template fields");
    return {...snapshot,content};
  }
}
