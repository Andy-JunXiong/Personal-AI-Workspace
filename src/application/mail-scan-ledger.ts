import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { IdentityContext } from "../domain/types.js";
import { canonicalHash } from "../domain/canonical-json.js";
import { AuthorizationError, ValidationError } from "../domain/errors.js";
import type { MailScanService } from "./mail-scan-service.js";

export const scanContextSchema = z.object({ runId:z.string().uuid(), batchId:z.string().uuid(),
  messageId:z.string().regex(/^[a-f0-9]{1,128}$/u), actionKey:z.string().trim().min(1).max(200),
}).strict();
type ScanContext = z.infer<typeof scanContextSchema>;
type Context = IdentityContext & { channel:"MCP"|"WEB" };
type Scope = {mailbox:string; accountKey:string; searchedFrom:string; cutoff:string}[];
const IDLE_MS = 30 * 60_000;

/** Domain receipt ownership, not a scheduler. Every mutation needs a write tool. */
export class MailScanLedger {
  constructor(private db:WorkspaceDatabase, private context:()=>Context,
    private scans:MailScanService, private clock=()=>new Date()) {}

  enabled() { return !!this.db.prepare("SELECT 1 FROM sqlite_master WHERE name='mail_scan_ledgers'").get(); }
  managed(runId:string) {
    return this.enabled() && !!this.db.prepare("SELECT 1 FROM mail_scan_ledgers WHERE run_id=? AND workspace_id=?")
      .get(runId,this.context().workspaceId);
  }
  private identity() {
    const c=this.context();
    if(c.channel!=="MCP") throw new AuthorizationError("Scan ledger writes require the authorized MCP channel");
    return c;
  }
  guard(runId:string) {
    const c=this.identity();
    if(!this.enabled()) return;
    const active=this.db.prepare(`SELECT r.id,l.heartbeat_at FROM mail_scan_runs r
      JOIN mail_scan_ledgers l ON l.run_id=r.id WHERE r.workspace_id=? AND r.status='RUNNING'`).all(c.workspaceId) as {id:string;heartbeat_at:string}[];
    for(const r of active) {
      if(r.id!==runId) throw new ValidationError("A backend scan owns this workspace; close or recover it before another scan");
      if(Date.parse(r.heartbeat_at)+IDLE_MS<=this.clock().getTime())
        throw new ValidationError("Scan lease expired; start a new authorized run to retain and resume pending work");
    }
  }
  touch(runId:string) {
    this.guard(runId);
    if(this.managed(runId)) {
      const updated=this.db.prepare(`UPDATE mail_scan_ledgers SET heartbeat_at=? WHERE run_id=?
        AND EXISTS(SELECT 1 FROM mail_scan_runs r WHERE r.id=run_id AND r.status='RUNNING')`)
        .run(this.clock().toISOString(),runId);
      if(updated.changes!==1) throw new ValidationError("Closed scans cannot accept activity");
    }
  }
  recoverExpired() {
    const c=this.identity();
    const rows=this.db.prepare(`SELECT r.id FROM mail_scan_runs r JOIN mail_scan_ledgers l ON l.run_id=r.id
      WHERE r.workspace_id=? AND r.status='RUNNING' AND l.heartbeat_at<=?`)
      .all(c.workspaceId,new Date(this.clock().getTime()-IDLE_MS).toISOString()) as {id:string}[];
    for(const row of rows) this.settle(row.id,"Interrupted: authorization lease expired; pending work retained",true);
  }
  initialize(runId:string, scope:Scope) {
    const c=this.identity();
    const other=this.db.prepare("SELECT 1 FROM mail_scan_runs WHERE workspace_id=? AND status='RUNNING' AND id<>?").get(c.workspaceId,runId);
    if(other) throw new ValidationError("Finish the existing scan before starting a backend scan");
    this.db.prepare("INSERT INTO mail_scan_ledgers VALUES(?,?,?,?)")
      .run(runId,c.workspaceId,this.clock().toISOString(),JSON.stringify(scope));
  }
  claim(runId:string,batchId:string) {
    if(this.managed(runId)) this.db.transaction(()=>{
      this.touch(runId);
      if(this.scans.get(runId).status!=="RUNNING") throw new ValidationError("Run closed before batch acquisition");
      this.db.prepare("INSERT OR IGNORE INTO mail_scan_batch_runs VALUES(?,?)").run(runId,batchId);
    })();
  }
  saveAck(runId:string,batchId:string,item:{messageId:string}) {
    if(this.managed(runId)) this.db.prepare("INSERT OR IGNORE INTO mail_scan_acknowledgements VALUES(?,?,?,?)")
      .run(runId,batchId,item.messageId,canonicalHash(item));
  }
  replayAck(runId:string,batchId:string,items:{messageId:string}[]) {
    this.identity();
    if(!this.managed(runId)) return false;
    const saved=items.map(item=>this.db.prepare("SELECT request_hash FROM mail_scan_acknowledgements WHERE run_id=? AND batch_id=? AND message_id=?")
      .get(runId,batchId,item.messageId) as {request_hash:string}|undefined);
    for(let i=0;i<items.length;i++) if(saved[i] && saved[i]!.request_hash!==canonicalHash(items[i]))
      throw new ValidationError("Saved source confirmation is immutable");
    return saved.every(Boolean);
  }
  source(c:ScanContext) {
    this.touch(c.runId);
    if(!this.managed(c.runId)) throw new ValidationError("Scan context requires a backend-managed run");
    const row=this.db.prepare(`SELECT b.mailbox,s.external_id FROM mail_scan_batch_runs br
      JOIN mail_scan_runs r ON r.id=br.run_id JOIN mail_scan_batches b ON b.id=br.batch_id
      JOIN mail_scan_batch_items i ON i.batch_id=b.id
      JOIN mail_batch_source_ids s ON s.batch_id=i.batch_id AND s.message_id=i.message_id
      WHERE br.run_id=? AND br.batch_id=? AND i.message_id=? AND r.workspace_id=? AND r.status='RUNNING'
      AND b.status='ACTIVE' AND i.read_run_id=r.id AND i.body_complete=1 AND i.outside_range=0
      AND NOT EXISTS(SELECT 1 FROM mail_scan_processed p WHERE p.workspace_id=r.workspace_id AND p.mailbox=b.mailbox AND p.message_id=i.message_id)`)
      .get(c.runId,c.batchId,c.messageId,this.context().workspaceId) as {mailbox:string;external_id:string}|undefined;
    if(!row) throw new ValidationError("An owned, pending, completely read source in this run is required");
    return row;
  }

  private sourceActions(batchId:string,messageId:string) {
    const rows=this.db.prepare(`SELECT a.* FROM mail_scan_actions a JOIN mail_scan_batches b ON b.id=a.batch_id
      JOIN mail_scan_batches target ON target.workspace_id=b.workspace_id AND target.mailbox=b.mailbox
      WHERE target.id=? AND target.workspace_id=? AND a.message_id=? ORDER BY a.rowid`)
      .all(batchId,this.context().workspaceId,messageId) as {action_key:string;operation:string;status:string;request_hash:string;result_json:string|null}[];
    return [...new Map(rows.map(a=>[a.action_key,a])).values()];
  }

  /** The original business callback still performs all authorization and version checks. */
  action<T extends object>(context:unknown,operation:string,input:object,write:()=>T):T {
    if(context===undefined) return write();
    const c=scanContextSchema.parse(context), source=this.source(c);
    const p=input as {externalId?:string;provider?:string;resourceType?:string};
    if(operation==="workspace_record_observation" &&
      (p.externalId!==source.external_id || p.provider!=="gmail" || p.resourceType!=="EMAIL"))
      throw new ValidationError("Observation must refer to this account-qualified source");
    const previous=this.sourceActions(c.batchId,c.messageId).find(a=>a.action_key===c.actionKey);
    const hash=canonicalHash(input);
    if(previous && (previous.operation!==operation || (previous.status==="SUCCEEDED" && previous.request_hash!==hash)))
      throw new ValidationError("A successful action key is immutable; use a distinct key for another operation");
    const id=randomUUID();
    // Intent survives a failed business transaction. No raw payload or exception text is persisted.
    this.db.transaction(()=>{
      this.source(c);
      this.db.prepare("INSERT INTO mail_scan_actions VALUES(?,?,?,?,?,?,?,'PENDING',?,NULL)")
        .run(id,c.runId,c.batchId,c.messageId,c.actionKey,operation,hash,this.clock().toISOString());
    })();
    try {
      return this.db.transaction(()=>{
        this.source(c);
        this.db.prepare("INSERT INTO mail_scan_write_scope VALUES(1,?)").run(id);
        const result=write();
        const outcome=result as {creationStatus?:string;transition?:{status:string}};
        const unresolved=outcome.creationStatus==="POSSIBLE_DUPLICATE" || outcome.transition?.status==="REJECTED";
        this.db.prepare("DELETE FROM mail_scan_write_scope WHERE singleton=1").run();
        const records=result as {project?:{id:string};resource?:{id:string;projectId:string};transition?:{id:string;projectId:string};task?:{id:string;projectId:string}};
        const refs={projectId:records.project?.id??records.resource?.projectId??records.transition?.projectId??records.task?.projectId,
          resourceId:records.resource?.id,transitionId:records.transition?.id,taskId:records.task?.id};
        this.db.prepare("UPDATE mail_scan_actions SET status=?,result_json=? WHERE id=?").run(unresolved?"FAILED":"SUCCEEDED",JSON.stringify(refs),id);
        return result;
      })();
    } catch(error) {
      this.db.prepare("UPDATE mail_scan_actions SET status='FAILED' WHERE id=?").run(id);
      throw error;
    }
  }
  verifyAck(runId:string,batchId:string,item:{messageId:string;outcome:string;projectId?:string;verified?:boolean;requiredActionKeys?:string[]}) {
    if(!this.managed(runId)) {
      if(this.enabled() && this.sourceActions(batchId,item.messageId).some(a=>a.status!=="SUCCEEDED"))
        throw new ValidationError("This source has unresolved backend actions; resume with a backend run");
      return;
    }
    const {workspaceId}=this.context();
    if(!this.db.prepare("SELECT 1 FROM mail_scan_batch_runs WHERE run_id=? AND batch_id=?").get(runId,batchId))
      throw new ValidationError("Batch has not been acquired by this run");
    const actions=this.sourceActions(batchId,item.messageId);
    if(item.verified!==true || !item.requiredActionKeys || actions.some(a=>a.status!=="SUCCEEDED") ||
      item.requiredActionKeys.some(key=>!actions.some(a=>a.action_key===key && a.status==="SUCCEEDED")))
      throw new ValidationError("Confirm classification/readback and resolve every required or attempted action before acknowledging");
    if(item.outcome==="IRRELEVANT") {
      if(actions.length || item.projectId || item.requiredActionKeys.length) throw new ValidationError("Irrelevant mail cannot have business actions");
      return;
    }
    const evidence=this.db.prepare(`SELECT r.id FROM resources r JOIN projects p ON p.id=r.project_id
      JOIN mail_batch_source_ids s ON s.external_id=r.external_id
      WHERE p.workspace_id=? AND p.id=? AND p.project_type='job_application' AND r.provider='gmail'
      AND r.resource_type='EMAIL' AND s.batch_id=? AND s.message_id=?`)
      .get(workspaceId,item.projectId??"",batchId,item.messageId);
    if(actions.some(a=>{const ref=a.result_json?JSON.parse(a.result_json) as {projectId?:string}:{};return ref.projectId && ref.projectId!==item.projectId;}))
      throw new ValidationError("Action results refer to another application");
    if(!evidence) throw new ValidationError("Resolve one application and read back its persisted source evidence");
    const effects=this.db.prepare(`SELECT e.kind,e.project_id FROM mail_scan_effects e JOIN mail_scan_actions a ON a.id=e.action_id
      WHERE a.run_id=? AND a.batch_id=? AND a.message_id=?`).all(runId,batchId,item.messageId) as {kind:string;project_id:string}[];
    if(effects.some(e=>e.project_id!==item.projectId)) throw new ValidationError("Business results and source application disagree");
    const newEvidence=effects.some(e=>e.kind==="EVIDENCE");
    if((item.outcome==="RECORDED")!==newEvidence) throw new ValidationError("RECORDED requires newly captured evidence; otherwise use EXISTING");
  }
  settle(runId:string,reason?:string,expired=false) {
    return this.db.transaction(()=>this.derive(runId,reason,expired))();
  }
  private derive(runId:string,reason?:string,expired=false) {
    if(!this.managed(runId)) return;
    const run=this.scans.get(runId);
    if(run.status!=="RUNNING") return run;
    if(!expired) this.touch(runId);
    const {workspaceId}=this.context();
    const ledger=this.db.prepare("SELECT scope_json FROM mail_scan_ledgers WHERE run_id=?").get(runId) as {scope_json:string};
    const scope=JSON.parse(ledger.scope_json) as Scope;
    const mailboxes=scope.map(m=>{
      const streams=this.db.prepare("SELECT lane,covered_through,target_at FROM mail_scan_streams WHERE workspace_id=? AND mailbox=?")
        .all(workspaceId,m.mailbox) as {lane:string;covered_through:string;target_at:string|null}[];
      const complete=!expired && streams.some(s=>s.lane==="BACKFILL" && s.covered_through===s.target_at)
        && streams.some(s=>s.lane==="RECENT" && s.covered_through>=m.cutoff);
      return {mailbox:m.mailbox as "mailbox-1"|"mailbox-2",status:complete?"COMPLETE" as const:"PARTIAL" as const,
        searchedFrom:m.searchedFrom,coveredThrough:complete?m.cutoff:null,
        failureReason:complete?"":reason??"Source listing, body reads or required processing remain incomplete"};
    });
    if(!reason && mailboxes.some(m=>m.status!=="COMPLETE")) return run;
    const effects=this.db.prepare(`SELECT e.kind,e.record_id FROM mail_scan_effects e JOIN mail_scan_actions a ON a.id=e.action_id
      WHERE a.run_id=? AND a.status='SUCCEEDED' ORDER BY e.kind,e.record_id`).all(runId) as {kind:string;record_id:string}[];
    const ids=(kind:string)=>effects.filter(e=>e.kind===kind).map(e=>e.record_id);
    return this.scans.finishFromLedger({runId,userConfirmed:true,authorityReference:"Backend-derived from authorized run and source ledger",
      mailboxes,newApplicationIds:ids("APPLICATION"),evidenceIds:ids("EVIDENCE"),admittedTransitionIds:ids("TRANSITION"),newTaskIds:ids("TASK")}).run;
  }
}
