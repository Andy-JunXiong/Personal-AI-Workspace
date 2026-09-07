import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { IdentityContext } from "../domain/types.js";
import type { GmailMcpReader } from "../gmail/mcp-reader.js";
import { AuthorizationError, ValidationError, NotFoundError } from "../domain/errors.js";

const authority = { userConfirmed: z.literal(true), authorityReference: z.string().trim().min(1).max(1000), runId: z.string().uuid() };
export const nextMailBatchSchema = z.object({ ...authority, mailbox: z.enum(["mailbox-1", "mailbox-2"]), lane: z.enum(["RECENT", "BACKFILL"]), limit: z.number().int().min(1).max(5).default(3), restartListing:z.boolean().default(false) }).strict();
export const ackMailBatchSchema = z.object({ ...authority, batchId: z.string().uuid(), items: z.array(z.object({
  messageId: z.string().regex(/^[a-f0-9]{1,128}$/u), outcome: z.enum(["IRRELEVANT", "EXISTING", "RECORDED"]),
}).strict()).min(1).max(5) }).strict();
type Batch = { id: string; workspace_id: string; mailbox: "mailbox-1" | "mailbox-2"; lane: string; searched_from: string; covered_through: string; page_token: string | null; listing_done: number; revision: number; status: string };
type Stream = { mailbox: string; lane: string; starts_at: string; covered_through: string; target_at: string | null; excluded_before:string|null };
type Item = { message_id: string; read_run_id: string | null; body_complete: number; outside_range: number; last_error: string | null };
type MailSource = Pick<GmailMcpReader, "list" | "read">;
const DAY = 86400000;

export class MailBatchService {
  constructor(private db: WorkspaceDatabase, private context: () => IdentityContext & {channel: "WEB" | "MCP"}, private clock = () => new Date()) {}

  private authorized(runId: string) {
    const identity = this.context();
    if (identity.channel !== "MCP") throw new AuthorizationError("Mail processing is performed through GPT tools");
    const run = this.db.prepare("SELECT started_at,status FROM mail_scan_runs WHERE id=? AND workspace_id=?").get(runId, identity.workspaceId) as {started_at:string;status:string}|undefined;
    if (!run || run.status !== "RUNNING") throw new ValidationError("An owned RUNNING scan receipt is required");
    return { identity, cutoff: run.started_at };
  }

  private initialize(workspaceId: string, cutoff: string) {
    if (this.db.prepare("SELECT 1 FROM mail_scan_streams WHERE workspace_id=?").get(workspaceId)) return;
    // Jun narrowed the policy to one week; old 30-day trials are historical
    // receipts, never an instruction to reintroduce that backlog.
    const baseline = new Date(Date.parse(cutoff) - 7 * DAY).toISOString();
    const recent = new Date(Date.parse(cutoff) - 2 * DAY).toISOString();
    for (const mailbox of ["mailbox-1", "mailbox-2"]) {
      this.db.prepare("INSERT INTO mail_scan_streams VALUES(?,?,?,?,?,?,NULL)").run(workspaceId,mailbox,"RECENT",recent,recent,null);
      this.db.prepare("INSERT INTO mail_scan_streams VALUES(?,?,?,?,?,?,NULL)").run(workspaceId,mailbox,"BACKFILL",baseline,baseline,recent);
    }
  }

  private batch(id: string, workspaceId: string) {
    const row = this.db.prepare("SELECT * FROM mail_scan_batches WHERE id=? AND workspace_id=?").get(id,workspaceId) as Batch|undefined;
    if (!row) throw new NotFoundError("Mail batch not found");
    return row;
  }

  private pending(batch: Batch) {
    return this.db.prepare(`SELECT i.* FROM mail_scan_batch_items i WHERE i.batch_id=? AND i.outside_range=0
      AND NOT EXISTS(SELECT 1 FROM mail_scan_processed p WHERE p.workspace_id=? AND p.mailbox=? AND p.message_id=i.message_id)
      ORDER BY CASE WHEN i.last_error IS NULL THEN 0 ELSE 1 END,i.rowid`).all(batch.id,batch.workspace_id,batch.mailbox) as Item[];
  }

  private advance(batch: Batch) {
    if (batch.status !== "ACTIVE" || !batch.listing_done || this.pending(batch).length) return;
    this.db.prepare("UPDATE mail_scan_batches SET status='COMPLETE' WHERE id=?").run(batch.id);
    this.db.prepare(`UPDATE mail_scan_streams SET covered_through=max(covered_through,?) WHERE workspace_id=? AND mailbox=? AND lane=?`)
      .run(batch.covered_through,batch.workspace_id,batch.mailbox,batch.lane);
  }

  progress() {
    const {workspaceId} = this.context();
    const streams = this.db.prepare("SELECT * FROM mail_scan_streams WHERE workspace_id=? ORDER BY mailbox,lane").all(workspaceId) as Stream[];
    return { streams: streams.map(s => {
      const active = this.db.prepare("SELECT * FROM mail_scan_batches WHERE workspace_id=? AND mailbox=? AND lane=? AND status='ACTIVE'").get(workspaceId,s.mailbox,s.lane) as Batch|undefined;
      const remaining = active ? this.pending(active) : [];
      return { mailbox:s.mailbox,lane:s.lane,startedFrom:s.starts_at,coveredThrough:s.covered_through,targetAt:s.target_at,
        backfillComplete:s.lane === "BACKFILL" && s.covered_through === s.target_at,excludedBefore:s.excluded_before,
        activeBatchId:active?.id ?? null,listingComplete:active ? !!active.listing_done : null,
        pendingMessages:remaining.length,blockedMessages:remaining.filter(i=>i.last_error).length };
    }) };
  }

  async next(input: unknown, reader: MailSource) {
    const parsed=nextMailBatchSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid mail batch request");
    const p=parsed.data, {identity,cutoff}=this.authorized(p.runId);
    let batch=this.db.transaction(() => {
      this.initialize(identity.workspaceId,cutoff);
      const floor=new Date(Date.parse(cutoff)-7*DAY).toISOString();
      // Expire old query windows, retaining their rows and the explicit excluded
      // boundary. Exclusion is not successful processing. Start a clipped window
      // and reuse the acknowledged IDs so the allowed remainder is not lost.
      const streams=this.db.prepare("SELECT * FROM mail_scan_streams WHERE workspace_id=? AND mailbox=?").all(identity.workspaceId,p.mailbox) as Stream[];
      for(const stream of streams) {
        const expires=this.db.prepare("SELECT 1 FROM mail_scan_batches WHERE workspace_id=? AND mailbox=? AND lane=? AND status='ACTIVE' AND searched_from<?").get(identity.workspaceId,p.mailbox,stream.lane,floor);
        if(expires) this.db.prepare("UPDATE mail_scan_batches SET status='EXPIRED' WHERE workspace_id=? AND mailbox=? AND lane=? AND status='ACTIVE' AND searched_from<?").run(identity.workspaceId,p.mailbox,stream.lane,floor);
        if(stream.covered_through<floor) {
          this.db.prepare("UPDATE mail_scan_streams SET starts_at=?,covered_through=?,target_at=CASE WHEN target_at IS NULL THEN NULL ELSE max(target_at,?) END,excluded_before=? WHERE workspace_id=? AND mailbox=? AND lane=?")
            .run(floor,floor,floor,floor,identity.workspaceId,p.mailbox,stream.lane);
        }
      }
      const active=this.db.prepare("SELECT * FROM mail_scan_batches WHERE workspace_id=? AND mailbox=? AND lane=? AND status='ACTIVE'").get(identity.workspaceId,p.mailbox,p.lane) as Batch|undefined;
      if (active) {
        if (active.covered_through > cutoff) throw new ValidationError("A newer run owns this interval; use a new receipt");
        if(p.restartListing) {
          this.db.prepare("UPDATE mail_scan_batches SET page_token=NULL,listing_done=0,revision=revision+1 WHERE id=?").run(active.id);
          return this.batch(active.id,identity.workspaceId);
        }
        return active;
      }
      const stream=this.db.prepare("SELECT * FROM mail_scan_streams WHERE workspace_id=? AND mailbox=? AND lane=?").get(identity.workspaceId,p.mailbox,p.lane) as Stream;
      const target=stream.target_at ?? cutoff;
      if (stream.covered_through >= target) return null;
      const end=new Date(Math.min(Date.parse(stream.covered_through)+DAY,Date.parse(target))).toISOString();
      // A 24h overlap at daily cadence covers yesterday and today, rather than
      // automatically adding another two days to every daily scan.
      const start=p.lane === "RECENT" ? new Date(Math.max(Date.parse(floor),Date.parse(stream.starts_at),Date.parse(stream.covered_through)-DAY)).toISOString() : stream.covered_through;
      const id=randomUUID();
      this.db.prepare("INSERT INTO mail_scan_batches(id,workspace_id,mailbox,lane,searched_from,covered_through,status) VALUES(?,?,?,?,?,?,'ACTIVE')").run(id,identity.workspaceId,p.mailbox,p.lane,start,end);
      return this.batch(id,identity.workspaceId);
    })();
    if (!batch) return { batch:null,messages:[],progress:this.progress(),note:"This lane is caught up to this run's cutoff; other lanes may be incomplete." };

    if (!this.pending(batch).some(item=>!item.last_error) && !batch.listing_done) {
      const snapshot=batch;
      const listed=await reader.list(identity,{mailbox:p.mailbox,searchedFrom:batch.searched_from,coveredThrough:batch.covered_through,...(batch.page_token ? {pageToken:batch.page_token}: {})});
      if (listed.nextPageToken && listed.nextPageToken === snapshot.page_token) throw new ValidationError("Repeated Gmail page token; progress retained");
      batch=this.db.transaction(() => {
        this.authorized(p.runId);
        const current=this.batch(snapshot.id,identity.workspaceId);
        if (current.revision !== snapshot.revision) return current;
        for(const message of listed.messages) this.db.prepare("INSERT OR IGNORE INTO mail_scan_batch_items(batch_id,message_id) VALUES(?,?)").run(current.id,message.id);
        this.db.prepare("UPDATE mail_scan_batches SET page_token=?,listing_done=?,revision=revision+1 WHERE id=?").run(listed.nextPageToken,listed.listingComplete?1:0,current.id);
        return this.batch(current.id,identity.workspaceId);
      })();
    }

    const messages=[];
    for(const item of this.pending(batch).slice(0,p.limit)) {
      try {
        const message=await reader.read(identity,{mailbox:p.mailbox,messageId:item.message_id});
        const outside=message.receivedAt < batch.searched_from || message.receivedAt >= batch.covered_through;
        const failure=message.bodyComplete ? null : "Message body is incomplete; source processing remains pending";
        this.db.transaction(()=>{
          this.authorized(p.runId);
          this.db.prepare("UPDATE mail_scan_batch_items SET read_run_id=?,body_complete=?,outside_range=?,last_error=? WHERE batch_id=? AND message_id=?")
            .run(p.runId,message.bodyComplete?1:0,outside?1:0,outside?null:failure,batch.id,item.message_id);
        })();
        if (!outside) messages.push({ ...message,processable:message.bodyComplete });
      } catch {
        this.authorized(p.runId);
        this.db.prepare("UPDATE mail_scan_batch_items SET body_complete=0,last_error=? WHERE batch_id=? AND message_id=?").run("Message read failed; retry later",batch.id,item.message_id);
        messages.push({ id:item.message_id,processable:false,error:"Message read failed; retry later" });
      }
    }
    this.db.transaction(()=>this.advance(this.batch(batch.id,identity.workspaceId)))();
    const current=this.batch(batch.id,identity.workspaceId);
    return { batch:{id:current.id,mailbox:p.mailbox,lane:p.lane,searchedFrom:current.searched_from,coveredThrough:current.covered_through,status:current.status,listingComplete:!!current.listing_done},
      messages,progress:this.progress(),note:"Process returned evidence and verify required writes, then acknowledge only completed messages. Pending IDs and pagination survive interruption. No business records are written by this tool." };
  }

  ack(input: unknown) {
    const parsed=ackMailBatchSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid mail processing acknowledgement");
    const p=parsed.data,{identity}=this.authorized(p.runId);
    if(new Set(p.items.map(i=>i.messageId)).size!==p.items.length) throw new ValidationError("Duplicate message acknowledgement");
    return this.db.transaction(()=>{
      const batch=this.batch(p.batchId,identity.workspaceId);
      if(batch.status==="EXPIRED") throw new ValidationError("This batch is outside the one-week policy window; request the current batch");
      for(const item of p.items) {
        const old=this.db.prepare("SELECT outcome FROM mail_scan_processed WHERE workspace_id=? AND mailbox=? AND message_id=?").get(identity.workspaceId,batch.mailbox,item.messageId) as {outcome:string}|undefined;
        const source=this.db.prepare("SELECT * FROM mail_scan_batch_items WHERE batch_id=? AND message_id=?").get(batch.id,item.messageId) as Item|undefined;
        if(!source) throw new ValidationError("Message was not listed in this batch");
        if(old) {if(old.outcome!==item.outcome) throw new ValidationError("Processed outcome is immutable"); continue;}
        if(source.read_run_id!==p.runId || !source.body_complete || source.outside_range) throw new ValidationError("Read complete source in this run before acknowledging");
        if(item.outcome!=="IRRELEVANT") {
          const evidence=this.db.prepare(`SELECT 1 FROM resources r JOIN projects p ON p.id=r.project_id WHERE p.workspace_id=? AND r.provider='gmail' AND r.resource_type='EMAIL' AND r.external_id=?`).get(identity.workspaceId,`${batch.mailbox}:${item.messageId}`);
          if(!evidence) throw new ValidationError("Relevant messages require persisted account-qualified Gmail evidence before acknowledgement");
        }
        this.db.prepare("INSERT INTO mail_scan_processed VALUES(?,?,?,?,?,?)").run(identity.workspaceId,batch.mailbox,item.messageId,item.outcome,p.runId,this.clock().toISOString());
      }
      this.advance(batch);
      return {batchId:batch.id,status:this.batch(batch.id,identity.workspaceId).status,progress:this.progress()};
    })();
  }
}
