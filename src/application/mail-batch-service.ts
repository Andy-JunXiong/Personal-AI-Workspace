import type { MailScanLedger } from "./mail-scan-ledger.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { IdentityContext } from "../domain/types.js";
import type { GmailMcpReader } from "../gmail/mcp-reader.js";
import { AuthorizationError, ValidationError, NotFoundError } from "../domain/errors.js";
import { gmailSourceId } from "../gmail/source-identity.js";
import { jobMailScope, type JobMailPolicy } from "./job-mail-policy.js";
import { matchesJobMail } from "../gmail/job-mail-search.js";

const authority = { userConfirmed: z.literal(true), authorityReference: z.string().trim().min(1).max(1000), runId: z.string().uuid() };
const bodyContinuationSchema = z.object({ batchId: z.string().uuid(), messageId: z.string().regex(/^[a-f0-9]{1,128}$/u),
  bodyVersion: z.string().regex(/^[a-f0-9]{64}$/u), offset: z.number().int().min(1).max(1_000_000) }).strict();
export const nextMailBatchSchema = z.object({ ...authority, mailbox: z.enum(["mailbox-1", "mailbox-2"]), lane: z.enum(["RECENT", "BACKFILL"]), limit: z.number().int().min(1).max(5).default(3), restartListing:z.boolean().default(false), bodyContinuation: bodyContinuationSchema.optional() }).strict();
export const ackMailBatchSchema = z.object({ ...authority, batchId: z.string().uuid(), items: z.array(z.object({
  messageId: z.string().regex(/^[a-f0-9]{1,128}$/u), outcome: z.enum(["IRRELEVANT", "EXISTING", "RECORDED"]),
  projectId:z.string().uuid().optional(),verified:z.literal(true).optional(),requiredActionKeys:z.array(z.string().trim().min(1).max(200)).max(50).optional(),
}).strict()).min(1).max(5) }).strict();
type Batch = { id: string; workspace_id: string; mailbox: "mailbox-1" | "mailbox-2"; lane: string; searched_from: string; covered_through: string; page_token: string | null; listing_done: number; revision: number; status: string };
type Stream = { mailbox: string; lane: string; starts_at: string; covered_through: string; target_at: string | null; excluded_before:string|null };
type Item = { message_id: string; read_run_id: string | null; body_complete: number; outside_range: number; last_error: string | null };
type BodyProgress = { run_id: string; body_version: string; next_offset: number; total_characters: number };
type MailSource = Pick<GmailMcpReader, "list" | "read" | "accountKey"> & Partial<Pick<GmailMcpReader,"metadata">>;
const DAY = 86400000;

export class MailBatchService {
  ledger?: MailScanLedger;
  constructor(private db: WorkspaceDatabase, private context: () => IdentityContext & {channel: "WEB" | "MCP"}, private clock = () => new Date()) {}

  private authorized(runId: string) {
    this.ledger?.guard(runId);
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

  private bindAccount(identity: IdentityContext, mailbox: "mailbox-1" | "mailbox-2", reader: Pick<MailSource, "accountKey">) {
    const key = reader.accountKey(identity, mailbox);
    const binding = this.db.prepare("SELECT account_key FROM mail_source_bindings WHERE workspace_id=? AND mailbox=?")
      .get(identity.workspaceId, mailbox) as {account_key:string}|undefined;
    if (binding && binding.account_key !== key)
      throw new ValidationError("Mailbox account changed; reconcile its prior coverage before resuming");
    if (!binding) {
      // Historical slot-only processing cannot safely be assigned to whichever
      // account happens to occupy the slot at upgrade time.
      const legacy = this.db.prepare(`SELECT 1 FROM mail_scan_batches WHERE workspace_id=? AND mailbox=?
        UNION ALL SELECT 1 FROM mail_scan_processed WHERE workspace_id=? AND mailbox=?
        UNION ALL SELECT 1 FROM mail_scan_checkpoints WHERE workspace_id=? AND mailbox=? LIMIT 1`)
        .get(identity.workspaceId,mailbox,identity.workspaceId,mailbox,identity.workspaceId,mailbox);
      if (legacy) throw new ValidationError("Historical mailbox coverage needs account reconciliation before resuming");
      this.db.prepare("INSERT INTO mail_source_bindings VALUES(?,?,?)").run(identity.workspaceId, mailbox, key);
    }
    return key;
  }

  prepareManagedScope(cutoff:string,reader:Pick<MailSource,"accountKey">,policy:JobMailPolicy|null=null) {
    const identity=this.context();
    const floor=new Date(Date.parse(cutoff)-7*DAY).toISOString();
    // Bind both slots before any external acquisition. Outer start transaction is atomic.
    const keys=(["mailbox-1","mailbox-2"] as const).map(mailbox=>({mailbox,accountKey:this.bindAccount(identity,mailbox,reader)}));
    if(policy) return keys.map(m=>({...m,searchedFrom:policy.mailboxes.find(s=>s.mailbox===m.mailbox)!.searchedFrom,cutoff}));
    this.initialize(identity.workspaceId,cutoff);
    return keys.map(m=>{
      const history=this.db.prepare("SELECT starts_at FROM mail_scan_streams WHERE workspace_id=? AND mailbox=? AND lane='BACKFILL'").get(identity.workspaceId,m.mailbox) as {starts_at:string};
      return {...m,searchedFrom:history.starts_at<floor?floor:history.starts_at,cutoff};
    });
  }

  private batch(id: string, workspaceId: string) {
    const row = this.db.prepare("SELECT * FROM mail_scan_batches WHERE id=? AND workspace_id=?").get(id,workspaceId) as Batch|undefined;
    if (!row) throw new NotFoundError("Mail batch not found");
    return row;
  }

  private pending(batch: Batch) {
    const screening=this.db.prepare("SELECT 1 FROM sqlite_master WHERE name='job_mail_screening'").get()
      ? "AND NOT EXISTS(SELECT 1 FROM job_mail_screening j WHERE j.batch_id=i.batch_id AND j.message_id=i.message_id AND j.matched=0)" : "";
    return this.db.prepare(`SELECT i.* FROM mail_scan_batch_items i WHERE i.batch_id=? AND i.outside_range=0
      AND NOT EXISTS(SELECT 1 FROM mail_scan_processed p WHERE p.workspace_id=? AND p.mailbox=? AND p.message_id=i.message_id)
      ${screening}
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
    const search=jobMailScope(this.db,p.runId,p.mailbox);
    if(search && !reader.metadata) throw new ValidationError("Job search requires metadata screening support");
    this.ledger?.touch(p.runId);
    if (p.bodyContinuation) return this.continueBody(p, reader);
    let batch=this.db.transaction(() => {
      this.authorized(p.runId);
      this.bindAccount(identity,p.mailbox,reader);
      if(search) {
        if(p.lane==="BACKFILL") return null;
        const active=this.db.prepare("SELECT * FROM mail_scan_batches WHERE workspace_id=? AND mailbox=? AND lane='RECENT' AND status='ACTIVE'")
          .get(identity.workspaceId,p.mailbox) as Batch|undefined;
        if(active) {
          if(active.searched_from!==search.searchedFrom || active.covered_through!==cutoff) throw new ValidationError("Batch belongs to another search scope");
          if(p.restartListing) this.db.prepare("UPDATE mail_scan_batches SET page_token=NULL,listing_done=0,revision=revision+1 WHERE id=?").run(active.id);
          return this.batch(active.id,identity.workspaceId);
        }
        const stream=this.db.prepare("SELECT covered_through FROM mail_scan_streams WHERE workspace_id=? AND mailbox=? AND lane='RECENT'")
          .get(identity.workspaceId,p.mailbox) as {covered_through:string};
        if(stream.covered_through>=cutoff) return null;
        const id=randomUUID();
        this.db.prepare("INSERT INTO mail_scan_batches(id,workspace_id,mailbox,lane,searched_from,covered_through,status) VALUES(?,?,?,'RECENT',?,?,'ACTIVE')")
          .run(id,identity.workspaceId,p.mailbox,search.searchedFrom,cutoff);
        return this.batch(id,identity.workspaceId);
      }
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
    if(batch) this.ledger?.claim(p.runId,batch.id);
    if (!batch) { this.ledger?.settle(p.runId); return { batch:null,messages:[],progress:this.progress(),note:"This lane is caught up to this run's cutoff; other lanes may be incomplete." }; }

    if (!this.pending(batch).some(item=>!item.last_error) && !batch.listing_done) {
      const snapshot=batch;
      const listed=await reader.list(identity,{mailbox:p.mailbox,searchedFrom:batch.searched_from,coveredThrough:batch.covered_through,...(batch.page_token ? {pageToken:batch.page_token}: {})},search?.criteria);
      this.bindAccount(identity,p.mailbox,reader);
      if (listed.nextPageToken && listed.nextPageToken === snapshot.page_token) throw new ValidationError("Repeated Gmail page token; progress retained");
      batch=this.db.transaction(() => {
        this.authorized(p.runId);
        const current=this.batch(snapshot.id,identity.workspaceId);
        if(current.status!=="ACTIVE") throw new ValidationError("Batch no longer active; discard late response");
        if (current.revision !== snapshot.revision) return current;
        for(const message of listed.messages) this.db.prepare("INSERT OR IGNORE INTO mail_scan_batch_items(batch_id,message_id) VALUES(?,?)").run(current.id,message.id);
        this.db.prepare("UPDATE mail_scan_batches SET page_token=?,listing_done=?,revision=revision+1 WHERE id=?").run(listed.nextPageToken,listed.listingComplete?1:0,current.id);
        return this.batch(current.id,identity.workspaceId);
      })();
    }

    const messages=[];
    for(const item of this.pending(batch).slice(0,p.limit)) {
      let metadata: Awaited<ReturnType<GmailMcpReader["metadata"]>>|undefined;
      try {
        if(search) {
          const meta=await reader.metadata!(identity,{mailbox:p.mailbox,messageId:item.message_id});
          metadata=meta;
          const key=this.bindAccount(identity,p.mailbox,reader);
          if(meta.externalId!==gmailSourceId(key,item.message_id)) throw new ValidationError("Unexpected metadata account");
          const outside=meta.receivedAt<search.searchedFrom || meta.receivedAt>=cutoff;
          const reason=outside?null:matchesJobMail(meta.subject,meta.senderEmail,search.criteria);
          this.db.transaction(()=>{
            this.authorized(p.runId);
            if(this.batch(batch.id,identity.workspaceId).status!=="ACTIVE") throw new ValidationError("Batch no longer active");
            this.db.prepare(`INSERT INTO job_mail_metadata VALUES(?,?,?,?,?,?,?,NULL) ON CONFLICT(workspace_id,mailbox,message_id)
              DO UPDATE SET thread_id=excluded.thread_id,subject=excluded.subject,sender_email=excluded.sender_email,received_at=excluded.received_at`)
              .run(identity.workspaceId,p.mailbox,meta.id,meta.threadId,meta.subject,meta.senderEmail,meta.receivedAt);
            this.db.prepare("INSERT OR REPLACE INTO job_mail_screening VALUES(?,?,?,?,?)")
              .run(batch.id,item.message_id,p.runId,reason?1:0,outside?"OUTSIDE_TIME_SCOPE":reason??"OUTSIDE_JOB_FILTER");
            if(!reason) this.db.prepare("UPDATE mail_scan_batch_items SET body_complete=0,last_error=NULL,outside_range=? WHERE batch_id=? AND message_id=?")
              .run(outside?1:0,batch.id,item.message_id);
          })();
          if(!reason) continue;
        }
        const message=await reader.read(identity,{mailbox:p.mailbox,messageId:item.message_id});
        const accountKey=this.bindAccount(identity,p.mailbox,reader);
        if(message.externalId!==gmailSourceId(accountKey,item.message_id)) throw new ValidationError("Unexpected message account identity");
        const outside=message.receivedAt < batch.searched_from || message.receivedAt >= batch.covered_through;
        const reasons=message.bodyDiagnostics?.issues.join(", ");
        const failure=message.bodyComplete ? null : `Message body is incomplete${reasons ? ` (${reasons})` : ""}; source processing remains pending`;
        this.db.transaction(()=>{
          this.authorized(p.runId);
          if(this.batch(batch.id,identity.workspaceId).status!=="ACTIVE") throw new ValidationError("Batch no longer active");
          this.db.prepare("UPDATE mail_scan_batch_items SET read_run_id=?,body_complete=?,outside_range=?,last_error=? WHERE batch_id=? AND message_id=?")
            .run(p.runId,message.bodyComplete?1:0,outside?1:0,outside?null:failure,batch.id,item.message_id);
          this.db.prepare("DELETE FROM mail_body_read_progress WHERE batch_id=? AND message_id=?").run(batch.id,item.message_id);
          if (!outside && message.bodyPage?.sourceComplete && message.bodyPage.nextOffset !== null) {
            this.db.prepare("INSERT INTO mail_body_read_progress VALUES(?,?,?,?,?,?)")
              .run(batch.id,item.message_id,p.runId,message.bodyPage.version,message.bodyPage.end,message.bodyPage.totalCharacters);
          }
          this.db.prepare(`INSERT INTO mail_batch_source_ids VALUES(?,?,?)
            ON CONFLICT(batch_id,message_id) DO UPDATE SET external_id=excluded.external_id`)
            .run(batch.id,item.message_id,message.externalId);
        })();
        if (!outside) messages.push({ ...message,...(metadata?{metadata}:{}),processable:message.bodyComplete,
          ...(message.bodyPage?.sourceComplete && message.bodyPage.nextOffset !== null ? {
            bodyContinuation: { batchId:batch.id,messageId:item.message_id,bodyVersion:message.bodyPage.version,offset:message.bodyPage.nextOffset },
            bodyReadProgress: { readThrough:message.bodyPage.end,totalCharacters:message.bodyPage.totalCharacters,complete:false },
          } : {}) });
      } catch {
        this.authorized(p.runId);
        this.db.prepare("UPDATE mail_scan_batch_items SET body_complete=0,last_error=? WHERE batch_id=? AND message_id=?").run("Message read failed; retry later",batch.id,item.message_id);
        this.db.prepare("DELETE FROM mail_body_read_progress WHERE batch_id=? AND message_id=?").run(batch.id,item.message_id);
        messages.push({ id:item.message_id,processable:false,error:"Message read failed; retry later" });
      }
    }
    this.db.transaction(()=>{this.authorized(p.runId);this.advance(this.batch(batch.id,identity.workspaceId));this.ledger?.settle(p.runId);})();
    const current=this.batch(batch.id,identity.workspaceId);
    return { batch:{id:current.id,mailbox:p.mailbox,lane:p.lane,searchedFrom:current.searched_from,coveredThrough:current.covered_through,status:current.status,listingComplete:!!current.listing_done},
      messages,progress:this.progress(),note:"Process returned evidence and verify required writes, then acknowledge only completed messages. Pending IDs and pagination survive interruption. No business records are written by this tool." };
  }

  /** Continue a listed source, never a new arbitrary message or an old run's read. */
  private async continueBody(p: z.infer<typeof nextMailBatchSchema>, reader: MailSource) {
    const c=p.bodyContinuation!, {identity,cutoff}=this.authorized(p.runId);
    if(p.restartListing) throw new ValidationError("Body continuation cannot restart listing");
    const batch=this.batch(c.batchId,identity.workspaceId);
    const floor=jobMailScope(this.db,p.runId,p.mailbox)?.searchedFrom ?? new Date(Date.parse(cutoff)-7*DAY).toISOString();
    if(batch.status!=="ACTIVE" || batch.mailbox!==p.mailbox || batch.lane!==p.lane || batch.searched_from<floor || batch.covered_through>cutoff)
      throw new ValidationError("Body continuation requires the current owned in-scope batch");
    this.bindAccount(identity,p.mailbox,reader);
    const validate=() => {
      this.authorized(p.runId);
      const source=this.pending(this.batch(batch.id,identity.workspaceId)).find(i=>i.message_id===c.messageId);
      const saved=this.db.prepare("SELECT * FROM mail_body_read_progress WHERE batch_id=? AND message_id=?").get(batch.id,c.messageId) as BodyProgress|undefined;
      if(this.batch(batch.id,identity.workspaceId).status!=="ACTIVE" || !source || source.read_run_id!==p.runId || !saved || saved.run_id!==p.runId ||
        saved.body_version!==c.bodyVersion || c.offset>saved.next_offset || c.offset>=saved.total_characters)
        throw new ValidationError("Read this source from its first part in this run; do not skip parts or change versions");
      return saved;
    };
    validate();
    this.ledger?.claim(p.runId,batch.id);
    try {
      const message=await reader.read(identity,{mailbox:p.mailbox,messageId:c.messageId,bodyOffset:c.offset,bodyVersion:c.bodyVersion});
      const page=message.bodyPage;
      if(message.externalId!==gmailSourceId(this.bindAccount(identity,p.mailbox,reader),c.messageId) ||
        message.receivedAt<batch.searched_from || message.receivedAt>=batch.covered_through || !page || !page.sourceComplete ||
        page.version!==c.bodyVersion || page.offset!==c.offset || page.end<=c.offset)
        throw new ValidationError("Source changed or is incomplete; restart source reading");
      const readThrough=this.db.transaction(()=>{
        const saved=validate();
        if(saved.total_characters!==page.totalCharacters) throw new ValidationError("Source length changed");
        const through=Math.max(saved.next_offset,page.end);
        this.db.prepare("UPDATE mail_body_read_progress SET next_offset=? WHERE batch_id=? AND message_id=?").run(through,batch.id,c.messageId);
        this.db.prepare("UPDATE mail_scan_batch_items SET body_complete=?,last_error=? WHERE batch_id=? AND message_id=?")
          .run(through===page.totalCharacters?1:0,through===page.totalCharacters?null:"Message body has unread parts; source processing remains pending",batch.id,c.messageId);
        return through;
      })();
      const complete=readThrough===page.totalCharacters;
      return { batch:{id:batch.id,mailbox:batch.mailbox,lane:batch.lane,searchedFrom:batch.searched_from,coveredThrough:batch.covered_through,status:batch.status,listingComplete:!!batch.listing_done},
        messages:[{...message,bodyComplete:complete,processable:complete,
          bodyDiagnostics:message.bodyDiagnostics && {...message.bodyDiagnostics,issues:complete?message.bodyDiagnostics.issues.filter(i=>i!=="BODY_TOO_LONG"):message.bodyDiagnostics.issues},
          bodyReadProgress:{readThrough,totalCharacters:page.totalCharacters,complete},
          bodyContinuation:complete?null:{...c,offset:readThrough},
          note:"This response contains one body part. Complete means all contiguous parts of this same source version were read in this run. Review all parts before classification or ack; unread images and semantic uncertainty still prevent confirmation."}],
        progress:this.progress() };
    } catch {
      this.db.transaction(()=>{
        this.authorized(p.runId);
        this.db.prepare("UPDATE mail_scan_batch_items SET body_complete=0,last_error=? WHERE batch_id=? AND message_id=? AND read_run_id=?")
          .run("Body continuation failed or source changed; restart source reading",batch.id,c.messageId,p.runId);
        this.db.prepare("DELETE FROM mail_body_read_progress WHERE batch_id=? AND message_id=? AND run_id=?").run(batch.id,c.messageId,p.runId);
      })();
      throw new ValidationError("Body continuation failed or source changed; restart with a normal next batch read");
    }
  }

  ack(input: unknown, reader: Pick<MailSource, "accountKey">) {
    const parsed=ackMailBatchSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid mail processing acknowledgement");
    const p=parsed.data;
    if(new Set(p.items.map(i=>i.messageId)).size!==p.items.length) throw new ValidationError("Duplicate message acknowledgement");
    if(this.ledger?.replayAck(p.runId,p.batchId,p.items)) return {batchId:p.batchId,status:this.batch(p.batchId,this.context().workspaceId).status,progress:this.progress(),replayed:true};
    const {identity}=this.authorized(p.runId);
    return this.db.transaction(()=>{
      const batch=this.batch(p.batchId,identity.workspaceId);
      this.bindAccount(identity,batch.mailbox,reader);
      if(batch.status==="EXPIRED") throw new ValidationError("This batch is outside the one-week policy window; request the current batch");
      for(const item of p.items) {
        const old=this.db.prepare("SELECT outcome FROM mail_scan_processed WHERE workspace_id=? AND mailbox=? AND message_id=?").get(identity.workspaceId,batch.mailbox,item.messageId) as {outcome:string}|undefined;
        const source=this.db.prepare("SELECT * FROM mail_scan_batch_items WHERE batch_id=? AND message_id=?").get(batch.id,item.messageId) as Item|undefined;
        this.ledger?.verifyAck(p.runId,batch.id,item);
        if(!source) throw new ValidationError("Message was not listed in this batch");
        if(old) {if(old.outcome!==item.outcome) throw new ValidationError("Processed outcome is immutable"); continue;}
        if(source.read_run_id!==p.runId || !source.body_complete || source.outside_range) throw new ValidationError("Read complete source in this run before acknowledging");
        if(item.outcome!=="IRRELEVANT") {
          const sourceId=this.db.prepare("SELECT external_id FROM mail_batch_source_ids WHERE batch_id=? AND message_id=?").get(batch.id,item.messageId) as {external_id:string}|undefined;
          const evidence=sourceId && this.db.prepare(`SELECT 1 FROM resources r JOIN projects p ON p.id=r.project_id WHERE p.workspace_id=? AND r.provider='gmail' AND r.resource_type='EMAIL' AND r.external_id=?`).get(identity.workspaceId,sourceId.external_id);
          if(!evidence) throw new ValidationError("Relevant messages require persisted account-qualified Gmail evidence before acknowledgement");
        }
        this.db.prepare("INSERT INTO mail_scan_processed VALUES(?,?,?,?,?,?)").run(identity.workspaceId,batch.mailbox,item.messageId,item.outcome,p.runId,this.clock().toISOString());
        if(item.projectId && jobMailScope(this.db,p.runId,batch.mailbox)) this.db.prepare("UPDATE job_mail_metadata SET project_id=? WHERE workspace_id=? AND mailbox=? AND message_id=?")
          .run(item.projectId,identity.workspaceId,batch.mailbox,item.messageId);
        this.ledger?.saveAck(p.runId,batch.id,item);
      }
      this.advance(batch);
      this.ledger?.settle(p.runId);
      return {batchId:batch.id,status:this.batch(batch.id,identity.workspaceId).status,progress:this.progress()};
    })();
  }
}
