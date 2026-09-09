import type { WorkspaceDatabase } from "../persistence/database.js";
import { jobMailQuery, type JobMailCriteria } from "../gmail/job-mail-search.js";
import { ValidationError } from "../domain/errors.js";

const DAY=86_400_000;
export type JobMailPolicy = { mode:"JOB_METADATA"; version:1; coverage:"MATCHING_JOB_MAIL_ONLY";
  mailboxes:{mailbox:string;searchedFrom:string;cutoff:string;excludedBefore:string;criteria:JobMailCriteria;query:string}[] };
export function readJobMailPolicy(db:WorkspaceDatabase,runId:string):JobMailPolicy|null {
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='job_mail_search_runs'").get()) return null;
  const row=db.prepare("SELECT policy_json FROM job_mail_search_runs WHERE run_id=?").get(runId) as {policy_json:string}|undefined;
  return row?JSON.parse(row.policy_json) as JobMailPolicy:null;
}
export function prepareJobMailPolicy(db:WorkspaceDatabase,workspaceId:string,runId:string,cutoff:string):JobMailPolicy {
  const projects=db.prepare("SELECT metadata_json FROM projects WHERE workspace_id=? AND project_type='job_application' AND status='ACTIVE' AND lifecycle_state IN ('APPLIED','RECRUITER_CONTACT','INTERVIEWING','OFFER')").all(workspaceId) as {metadata_json:string}[];
  const companies=[...new Set(projects.map(p=>(JSON.parse(p.metadata_json) as {company?:string}).company).filter((s):s is string=>!!s))];
  const floor=new Date(Date.parse(cutoff)-3*DAY).toISOString(),normal=new Date(Date.parse(cutoff)-DAY).toISOString();
  const mailboxes=["mailbox-1","mailbox-2"].map(mailbox=>{
    const previous=db.prepare("SELECT covered_through,starts_at FROM mail_scan_streams WHERE workspace_id=? AND mailbox=? AND lane='RECENT'").get(workspaceId,mailbox) as {covered_through:string;starts_at:string}|undefined;
    const searchedFrom=previous? [floor,[normal,previous.covered_through].sort()[0]!].sort()[1]! : normal;
    const senders=(db.prepare(`SELECT DISTINCT m.sender_email FROM job_mail_metadata m JOIN projects p ON p.id=m.project_id
      WHERE m.workspace_id=? AND m.mailbox=? AND p.workspace_id=? AND p.project_type='job_application'
      AND p.status='ACTIVE' AND p.lifecycle_state IN ('APPLIED','RECRUITER_CONTACT','INTERVIEWING','OFFER') AND m.sender_email IS NOT NULL`)
      .all(workspaceId,mailbox,workspaceId) as {sender_email:string}[]).map(r=>r.sender_email);
    const criteria={companies,senders};
    return {mailbox,searchedFrom,cutoff,excludedBefore:searchedFrom,criteria,query:jobMailQuery(criteria)};
  });
  const policy:JobMailPolicy={mode:"JOB_METADATA",version:1,coverage:"MATCHING_JOB_MAIL_ONLY",mailboxes};
  db.prepare("INSERT INTO job_mail_search_runs VALUES(?,?,?)").run(runId,workspaceId,JSON.stringify(policy));
  // Supersede old query windows; retain all source, ack, receipt and body-progress rows.
  db.prepare("UPDATE mail_scan_batches SET status='EXPIRED' WHERE workspace_id=? AND status='ACTIVE'").run(workspaceId);
  for(const m of mailboxes) for(const lane of ["RECENT","BACKFILL"]) {
    db.prepare(`INSERT INTO mail_scan_streams VALUES(?,?,?,?,?,?,?) ON CONFLICT(workspace_id,mailbox,lane)
      DO UPDATE SET starts_at=excluded.starts_at,covered_through=excluded.covered_through,target_at=excluded.target_at,excluded_before=excluded.excluded_before`)
      .run(workspaceId,m.mailbox,lane,m.searchedFrom,m.searchedFrom,lane==="BACKFILL"?m.searchedFrom:null,m.excludedBefore);
  }
  return policy;
}
export function jobMailScope(db:WorkspaceDatabase,runId:string,mailbox:string) {
  const policy=readJobMailPolicy(db,runId);
  if(!policy) return null;
  const scope=policy.mailboxes.find(m=>m.mailbox===mailbox);
  if(!scope) throw new ValidationError("Mailbox is not in this search policy");
  return scope;
}
