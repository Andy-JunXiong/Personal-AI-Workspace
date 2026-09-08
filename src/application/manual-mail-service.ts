import { randomUUID } from "node:crypto";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { IdentityContext } from "../domain/types.js";
import { AuthorizationError, ValidationError } from "../domain/errors.js";
import { diagnosticText, type MailDiagnostic } from "../domain/mail-diagnostics.js";

export type ManualMailOutcome = "UPDATED" | "NO_UPDATE" | "PARTIAL" | "FAILED";
type RunRow = { id:string; project_id:string; started_at:string; finished_at:string|null;
  status:"RUNNING"|"DONE"|"FAILED"|"INTERRUPTED"; outcome:ManualMailOutcome|null; result_json:string|null };
const DAY=86400000;

// Application-scoped evidence checks. These never advance full-mailbox scan
// checkpoints or authorize lifecycle/task mutations.
export class ManualMailService {
  constructor(private db:WorkspaceDatabase, private context:()=>IdentityContext & {channel:"WEB"|"MCP"},
    private clock=()=>new Date()) {}
  private owner(projectId?:string,write=false) {
    const identity=this.context();
    if(write && identity.channel!=="WEB") throw new AuthorizationError("Manual checks require an authenticated website action");
    if(projectId && !this.db.prepare("SELECT 1 FROM projects WHERE id=? AND workspace_id=? AND project_type='job_application'")
      .get(projectId,identity.workspaceId)) throw new AuthorizationError("Application unavailable");
    return identity.workspaceId;
  }
  private map(row:RunRow) {
    const expired=row.status==="RUNNING" && Date.parse(row.started_at)+180000<this.clock().getTime();
    const result=row.result_json?JSON.parse(row.result_json) as {scope?:string[];diagnostics?:MailDiagnostic[]}:null;
    return {id:row.id,projectId:row.project_id,startedAt:Date.parse(row.started_at),finishedAt:row.finished_at,
      state:expired?"FAILED" as const:row.status==="INTERRUPTED"?"FAILED" as const:row.status,
      outcome:row.outcome??(expired?"PARTIAL" as const:undefined),
      interrupted:expired||row.status==="INTERRUPTED",scope:result?.scope??[],diagnostics:result?.diagnostics??[]};
  }
  current(projectId:string) {
    const row=this.db.prepare("SELECT * FROM mail_manual_runs WHERE workspace_id=? AND project_id=? ORDER BY started_at DESC,rowid DESC LIMIT 1")
      .get(this.owner(projectId),projectId) as RunRow|undefined;
    return row?this.map(row):null;
  }
  recent() {
    return (this.db.prepare("SELECT * FROM mail_manual_runs WHERE workspace_id=? ORDER BY started_at DESC,rowid DESC LIMIT 10")
      .all(this.owner()) as RunRow[]).map(row=>this.map(row));
  }
  begin(projectId:string) {
    const workspaceId=this.owner(projectId,true),now=this.clock();
    return this.db.transaction(()=>{
      this.db.prepare("UPDATE mail_manual_runs SET status='INTERRUPTED',outcome='PARTIAL',finished_at=? WHERE workspace_id=? AND project_id=? AND status='RUNNING' AND started_at<?")
        .run(now.toISOString(),workspaceId,projectId,new Date(now.getTime()-180000).toISOString());
      const current=this.current(projectId);
      if(current && (current.state==="RUNNING" || now.getTime()-current.startedAt<60000)) return {...current,created:false};
      const id=randomUUID();
      this.db.prepare("INSERT INTO mail_manual_runs(id,workspace_id,project_id,started_at,status) VALUES(?,?,?,?,'RUNNING')")
        .run(id,workspaceId,projectId,now.toISOString());
      return {...this.current(projectId)!,created:true};
    })();
  }
  range(projectId:string,accountKey:string,queryKey:string,cutoff:number) {
    const row=this.db.prepare("SELECT covered_through FROM mail_manual_coverage WHERE workspace_id=? AND project_id=? AND account_key=? AND query_key=?")
      .get(this.owner(projectId),projectId,accountKey,queryKey) as {covered_through:string}|undefined;
    const from=Math.max(cutoff-7*DAY,row?Date.parse(row.covered_through)-DAY:cutoff-2*DAY);
    return {searchedFrom:new Date(Math.min(from,cutoff-1)).toISOString(),coveredThrough:new Date(cutoff).toISOString()};
  }
  complete(runId:string,projectId:string,outcome:ManualMailOutcome,result:unknown,
    coverage:{accountKey:string;queryKey:string;coveredThrough:string}[],saveReceipt:()=>void) {
    const workspaceId=this.owner(projectId,true);
    this.db.transaction(()=>{
      const run=this.db.prepare("SELECT * FROM mail_manual_runs WHERE id=? AND workspace_id=? AND project_id=?")
        .get(runId,workspaceId,projectId) as RunRow|undefined;
      if(!run || run.status!=="RUNNING" || this.map(run).interrupted) throw new ValidationError("Manual check no longer active; retry from saved coverage");
      // Evidence may already have been saved, but success coverage is committed
      // atomically with the completion receipt. Failed mailboxes do not advance.
      saveReceipt();
      this.db.prepare("UPDATE mail_manual_runs SET status='DONE',outcome=?,finished_at=?,result_json=? WHERE id=?")
        .run(outcome,this.clock().toISOString(),JSON.stringify(result),runId);
      for(const item of coverage) this.db.prepare(`INSERT INTO mail_manual_coverage VALUES(?,?,?,?,?,?)
        ON CONFLICT(workspace_id,project_id,account_key,query_key) DO UPDATE SET
        covered_through=max(covered_through,excluded.covered_through),run_id=excluded.run_id`)
        .run(workspaceId,projectId,item.accountKey,item.queryKey,item.coveredThrough,runId);
    })();
  }
  fail(runId:string,projectId:string,diagnostics:MailDiagnostic[]=[]) {
    this.db.prepare("UPDATE mail_manual_runs SET status='FAILED',outcome='PARTIAL',finished_at=?,result_json=? WHERE id=? AND workspace_id=? AND project_id=? AND status='RUNNING'")
      .run(this.clock().toISOString(),JSON.stringify({diagnostics,scope:diagnostics.map(diagnosticText)}),runId,this.owner(projectId,true),projectId);
  }
}
