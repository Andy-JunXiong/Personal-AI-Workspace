import { z } from "zod";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { IdentityContext } from "../domain/types.js";
import { canonicalHash } from "../domain/canonical-json.js";
import { AuthorizationError, IdempotencyConflictError, NotFoundError, ValidationError } from "../domain/errors.js";

const authority = { userConfirmed: z.literal(true), authorityReference: z.string().trim().min(1).max(1000) };
export const startMailScanSchema = z.object({ runId: z.string().uuid(), ...authority,
  triggerType: z.enum(["SCHEDULED", "MANUAL", "UNKNOWN"]), executionReference: z.string().trim().max(2000),
}).strict();
const timestamp = z.iso.datetime({ offset: true }).transform(s => new Date(s).toISOString());
const mailboxSchema = z.object({ mailbox: z.enum(["mailbox-1", "mailbox-2"]),
  status: z.enum(["COMPLETE", "PARTIAL", "FAILED"]),
  searchedFrom: timestamp.nullable(), coveredThrough: timestamp.nullable(),
  failureReason: z.string().trim().max(500),
}).strict();
const ids = z.array(z.string().uuid()).max(500).refine(a => new Set(a).size === a.length, "Duplicate IDs");
export const finishMailScanSchema = z.object({ runId: z.string().uuid(), ...authority,
  mailboxes: z.array(mailboxSchema).length(2),
  newApplicationIds: ids, evidenceIds: ids, admittedTransitionIds: ids, newTaskIds: ids,
}).strict();
type Result = z.infer<typeof finishMailScanSchema>;
interface Row { id: string; trigger_type: string; execution_reference: string; started_at: string; finished_at: string | null; status: string; result_json: string | null; result_hash: string | null }

export class MailScanService {
  constructor(private db: WorkspaceDatabase,
    private context: () => IdentityContext & { channel: "WEB" | "MCP" },
    private clock: () => Date = () => new Date()) {}

  private writeContext() {
    const c = this.context();
    if (c.channel !== "MCP") throw new AuthorizationError("Scan receipts are written through GPT tools");
    return c;
  }
  start(input: unknown) {
    const p = startMailScanSchema.safeParse(input);
    if (!p.success) throw new ValidationError("Invalid scan start");
    const { workspaceId } = this.writeContext();
    return this.db.transaction(() => {
      const old = this.db.prepare("SELECT workspace_id,trigger_type,execution_reference FROM mail_scan_runs WHERE id=?").get(p.data.runId) as {workspace_id:string;trigger_type:string;execution_reference:string}|undefined;
      if (old && old.workspace_id !== workspaceId) throw new NotFoundError("Run not found");
      if (old && (old.trigger_type !== p.data.triggerType || old.execution_reference !== p.data.executionReference)) throw new IdempotencyConflictError("Run origin cannot be changed");
      if (!old) this.db.prepare("INSERT INTO mail_scan_runs(id,workspace_id,authority_reference,trigger_type,execution_reference,started_at,status) VALUES(?,?,?,?,?,?,'RUNNING')")
        .run(p.data.runId, workspaceId, p.data.authorityReference, p.data.triggerType, p.data.executionReference, this.clock().toISOString());
      return { run: this.get(p.data.runId), checkpoints: this.overview().checkpoints, replayed: Boolean(old) };
    })();
  }
  finish(input: unknown) {
    const parsed = finishMailScanSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid scan receipt");
    const p = parsed.data;
    const { workspaceId } = this.writeContext();
    const hash = canonicalHash(p);
    return this.db.transaction(() => {
      const row = this.db.prepare("SELECT * FROM mail_scan_runs WHERE id=? AND workspace_id=?").get(p.runId, workspaceId) as Row|undefined;
      if (!row) throw new NotFoundError("Run not found");
      if (row.result_hash) {
        if (row.result_hash !== hash) throw new IdempotencyConflictError("A completed receipt cannot be changed");
        return { run: this.get(p.runId), replayed: true };
      }
      if (new Set(p.mailboxes.map(m => m.mailbox)).size !== 2) throw new ValidationError("Both distinct mailboxes are required");
      const now = this.clock().toISOString();
      for (const m of p.mailboxes) {
        if (m.status === "COMPLETE") {
          if (!m.searchedFrom || !m.coveredThrough || m.failureReason || m.searchedFrom > m.coveredThrough || m.coveredThrough > row.started_at) {
            throw new ValidationError("Complete coverage needs a valid searched range and no unresolved failure");
          }
          const cp = this.db.prepare("SELECT covered_through FROM mail_scan_checkpoints WHERE workspace_id=? AND mailbox=?").get(workspaceId,m.mailbox) as {covered_through:string}|undefined;
          const streams = this.db.prepare("SELECT lane,starts_at,covered_through,target_at FROM mail_scan_streams WHERE workspace_id=? AND mailbox=?").all(workspaceId,m.mailbox) as {lane:string;starts_at:string;covered_through:string;target_at:string|null}[];
          const boundedRestart=streams.find(s=>s.lane==="BACKFILL" && s.starts_at===m.searchedFrom && s.starts_at>=new Date(Date.parse(row.started_at)-7*86400000).toISOString());
          if (cp && m.searchedFrom > cp.covered_through && !boundedRestart) throw new ValidationError("Coverage gap: resume from the saved mailbox checkpoint");
          if (streams.length) {
            const history=streams.find(s=>s.lane==="BACKFILL"),recent=streams.find(s=>s.lane==="RECENT");
            if (!history || !recent || history.covered_through!==history.target_at || recent.covered_through<m.coveredThrough
              || m.searchedFrom<history.starts_at) throw new ValidationError("Batch source coverage is incomplete; retain PARTIAL until historical and recent ranges are processed");
          }
        } else if (!m.failureReason || m.coveredThrough !== null) {
          throw new ValidationError("Incomplete mailboxes require a reason and cannot advance coverage");
        }
      }
      // Counts are derived from real, owned rows, never arbitrary model totals.
      const groups = [
        [p.newApplicationIds, "SELECT p.created_at AS at FROM projects p WHERE p.id=? AND p.workspace_id=? AND p.project_type='job_application'"],
        [p.evidenceIds, "SELECT r.created_at AS at FROM resources r JOIN projects p ON p.id=r.project_id WHERE r.id=? AND p.workspace_id=? AND p.project_type='job_application' AND r.provider='gmail' AND r.resource_type='EMAIL'"],
        [p.admittedTransitionIds, "SELECT t.admitted_at AS at FROM state_transitions t JOIN projects p ON p.id=t.project_id WHERE t.id=? AND p.workspace_id=? AND t.status='ADMITTED' AND t.from_state<>'NONE' AND p.project_type='job_application'"],
        [p.newTaskIds, "SELECT t.created_at AS at FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=? AND p.workspace_id=? AND p.project_type='job_application'"],
      ] as const;
      for (const [values, sql] of groups) for (const id of values) {
        const found = this.db.prepare(sql).get(id, workspaceId) as {at:string}|undefined;
        if (!found || Date.parse(found.at) < Date.parse(row.started_at) || Date.parse(found.at) > Date.parse(now)) {
          throw new ValidationError("Receipt references must be owned records written during this run");
        }
      }
      const complete = p.mailboxes.filter(m => m.status === "COMPLETE").length;
      const status = complete === 2 ? "COMPLETE" : p.mailboxes.every(m => m.status === "FAILED") ? "FAILED" : "PARTIAL";
      this.db.prepare("UPDATE mail_scan_runs SET finished_at=?,status=?,result_json=?,result_hash=? WHERE id=? AND workspace_id=?")
        .run(now,status,JSON.stringify(p),hash,p.runId,workspaceId);
      for (const m of p.mailboxes.filter(m => m.status === "COMPLETE")) this.db.prepare(`INSERT INTO mail_scan_checkpoints(workspace_id,mailbox,covered_through,run_id) VALUES(?,?,?,?)
        ON CONFLICT(workspace_id,mailbox) DO UPDATE SET covered_through=excluded.covered_through,run_id=excluded.run_id
        WHERE excluded.covered_through > mail_scan_checkpoints.covered_through`).run(workspaceId,m.mailbox,m.coveredThrough,p.runId);
      return { run: this.get(p.runId), replayed: false };
    })();
  }
  private map(row: Row) {
    const result = row.result_json ? JSON.parse(row.result_json) as Result : null;
    return { id: row.id, startedAt: row.started_at, finishedAt: row.finished_at, status: row.status,
      triggerType: row.trigger_type, executionReference: row.execution_reference,
      mailboxes: result?.mailboxes ?? [],
      records: result ? { newApplicationIds: result.newApplicationIds, evidenceIds: result.evidenceIds,
        admittedTransitionIds: result.admittedTransitionIds, newTaskIds: result.newTaskIds } : null,
      counts: result ? { applications: result.newApplicationIds.length, evidence: result.evidenceIds.length,
        transitions: result.admittedTransitionIds.length, tasks: result.newTaskIds.length } : null };
  }
  get(runId: string) {
    if (!z.string().uuid().safeParse(runId).success) throw new ValidationError("Invalid run ID");
    const row = this.db.prepare("SELECT * FROM mail_scan_runs WHERE id=? AND workspace_id=?").get(runId,this.context().workspaceId) as Row|undefined;
    if (!row) throw new NotFoundError("Run not found");
    return this.map(row);
  }
  overview() {
    const {workspaceId} = this.context();
    const rows = this.db.prepare("SELECT * FROM mail_scan_runs WHERE workspace_id=? ORDER BY started_at DESC,rowid DESC LIMIT 10").all(workspaceId) as Row[];
    const checkpoints = this.db.prepare("SELECT mailbox,covered_through AS coveredThrough,run_id AS runId FROM mail_scan_checkpoints WHERE workspace_id=? ORDER BY mailbox").all(workspaceId) as {mailbox:string;coveredThrough:string;runId:string}[];
    const unfinished = this.db.prepare("SELECT count(*) AS n FROM mail_scan_runs WHERE workspace_id=? AND status='RUNNING'").get(workspaceId) as {n:number};
    return { runs: rows.map(r => this.map(r)), checkpoints, unfinishedCount: unfinished.n, limit: 10 };
  }
}
