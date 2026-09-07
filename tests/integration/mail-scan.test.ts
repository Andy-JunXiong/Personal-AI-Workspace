import { afterEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestWorkspace } from "../helpers/test-workspace.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { verifiedRequestContext } from "../../src/application/request-context.js";
import { openDatabase } from "../../src/persistence/database.js";
import { mailScanPanel } from "../../src/web/views.js";
import { mkdtempSync, mkdirSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(f => f()); });
const origin = { triggerType: "MANUAL", executionReference: "Synthetic local verification" };
const auth = { userConfirmed: true as const, authorityReference: "Explicit synthetic test policy" };
function setup(fileBacked = false) {
  const w = createTestWorkspace({ fileBacked, clock: () => new Date("2026-09-07T09:00:00Z") });
  cleanups.push(w.cleanup); return w;
}
function finish(runId: string) {
  return { ...auth, runId, newApplicationIds: [], evidenceIds: [], admittedTransitionIds: [], newTaskIds: [],
    mailboxes: ["mailbox-1", "mailbox-2"].map(mailbox => ({ mailbox, status: "COMPLETE",
      searchedFrom: "2026-09-01T00:00:00Z", coveredThrough: "2026-09-07T08:00:00Z", failureReason: "" })) };
}
it("persists partial coverage across database reopen and replays finalization without writes", () => {
  const w = setup(true), runId = randomUUID();
  w.service.mailScanService.start({ ...origin, ...auth, runId });
  const receipt = finish(runId);
  receipt.mailboxes[1] = { mailbox: "mailbox-2", status: "FAILED", searchedFrom: null as unknown as string,
    coveredThrough: null as unknown as string, failureReason: "Gmail unavailable" };
  expect(w.service.mailScanService.finish(receipt).run.status).toBe("PARTIAL");
  const before = w.database.prepare("SELECT total_changes() n").get();
  expect(w.service.mailScanService.finish(receipt).replayed).toBe(true);
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
  w.database.close();
  const reopened = openDatabase(w.databasePath); cleanups.push(() => reopened.close());
  const service = new WorkspaceService(reopened, verifiedRequestContext(reopened,w.identity,"MCP",randomUUID()));
  expect(service.mailScanService.overview().checkpoints).toEqual([{ mailbox: "mailbox-1", coveredThrough: "2026-09-07T08:00:00.000Z", runId }]);
  expect(service.mailScanService.get(runId).mailboxes[1]?.failureReason).toBe("Gmail unavailable");
});
it("rejects missing mailboxes, false success and coverage gaps atomically, and never regresses checkpoints", () => {
  const w=setup(), first=randomUUID(); w.service.mailScanService.start({ ...origin,...auth,runId:first});
  w.service.mailScanService.finish(finish(first));
  const runId=randomUUID(); w.service.mailScanService.start({ ...origin,...auth,runId});
  const bad=finish(runId); bad.mailboxes[0]!.searchedFrom="2026-09-07T08:30:00Z"; bad.mailboxes[0]!.coveredThrough="2026-09-07T09:00:00Z";
  expect(()=>w.service.mailScanService.finish(bad)).toThrow(/gap/);
  expect(w.service.mailScanService.get(runId).status).toBe("RUNNING");
  expect(()=>w.service.mailScanService.finish({...finish(runId),mailboxes:[finish(runId).mailboxes[0],finish(runId).mailboxes[0]]})).toThrow();
  const failed=finish(runId); failed.mailboxes[0]!.failureReason="Write failed";
  expect(()=>w.service.mailScanService.finish(failed)).toThrow();
  const old=finish(runId); old.mailboxes.forEach(m=>m.coveredThrough="2026-09-06T00:00:00Z");
  w.service.mailScanService.finish(old);
  expect(w.service.mailScanService.overview().checkpoints.every(c=>c.coveredThrough==="2026-09-07T08:00:00.000Z")).toBe(true);
  expect(()=>w.service.mailScanService.finish({...old,authorityReference:"changed"})).toThrow(/cannot be changed/);
});
it("requires MCP authority and isolates receipt reads and writes by workspace", () => {
  const w=setup(), runId=randomUUID();
  expect(()=>w.service.mailScanService.start({ ...origin,runId})).toThrow();
  w.service.mailScanService.start({ ...origin,...auth,runId});
  const web=new WorkspaceService(w.database,verifiedRequestContext(w.database,w.identity,"WEB",randomUUID()));
  expect(()=>web.mailScanService.start({ ...origin,...auth,runId:randomUUID()})).toThrow(/GPT/);
  expect(()=>web.mailScanService.finish(finish(runId))).toThrow(/GPT/);
  const other=new WorkspaceService(w.database,{issuer:"test-suite",subject:"other",workspaceName:"Other"}); other.ensureDevelopmentIdentity();
  expect(other.mailScanService.overview().runs).toHaveLength(0);
  expect(()=>other.mailScanService.get(runId)).toThrow(/not found/);
  expect(()=>other.mailScanService.finish(finish(runId))).toThrow(/not found/);
});
it("rejects invented or old write IDs; counts valid persisted application writes", () => {
  const w=setup(), runId=randomUUID(); w.service.mailScanService.start({ ...origin,...auth,runId});
  expect(()=>w.service.mailScanService.finish({...finish(runId),newApplicationIds:[randomUUID()]})).toThrow(/owned records/);
  w.database.prepare("UPDATE projects SET created_at='2026-09-01T00:00:00Z' WHERE id=?").run(w.projectId);
  expect(()=>w.service.mailScanService.finish({...finish(runId),newApplicationIds:[w.projectId]})).toThrow(/owned records/);
  w.database.prepare("UPDATE projects SET created_at='2026-09-07T09:00:00Z' WHERE id=?").run(w.projectId);
  expect(w.service.mailScanService.finish({...finish(runId),newApplicationIds:[w.projectId]}).run.counts?.applications).toBe(1);
});
it("renders empty, unfinished and failed receipts truthfully without writes or unsafe HTML", () => {
  const w=setup(); expect(mailScanPanel(w.service,"Australia/Sydney")).toContain("尚无每日扫描回执");
  const runId=randomUUID(); w.service.mailScanService.start({ ...origin,...auth,runId});
  expect(mailScanPanel(w.service,"Australia/Sydney")).toContain("未收到完成回执");
  const receipt=finish(runId); receipt.mailboxes.forEach(m=>{m.status="FAILED";m.coveredThrough=null as unknown as string;m.failureReason="<script>bad()</script>";});
  w.service.mailScanService.finish(receipt);
  const before=w.database.prepare("SELECT total_changes() n").get();
  const html=mailScanPanel(w.service,"Australia/Sydney");
  expect(html).toContain("检查失败");expect(html).toContain("&lt;script&gt;");expect(html).not.toContain("<script>bad()");
  expect(html).not.toContain("<button");expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
});

it("upgrades an existing S2 database without changing its rows, and permits repeat and old-version startup", () => {
  const root=mkdtempSync(join(tmpdir(),"paw-scan-migration-")); cleanups.push(()=>rmSync(root,{recursive:true,force:true}));
  const migrations=join(root,"old");mkdirSync(migrations);
  for(const file of readdirSync(resolve("db/migrations")).filter(f=>/^00[1-8]_/.test(f))) copyFileSync(resolve("db/migrations",file),join(migrations,file));
  const path=join(root,"data.db"); const old=openDatabase(path,migrations);
  const service=new WorkspaceService(old,{issuer:"test",subject:"user",workspaceName:"Existing"});service.ensureDevelopmentIdentity();
  service.createJobApplication({company:"Existing company",role:"Engineer",authority:{type:"EXPLICIT_USER_DEV",confirmed:true,reference:"test"},idempotencyKey:"old"});
  const tables=old.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {name:string}[];
  const snapshots=tables.map(t=>({name:t.name,rows:old.prepare(`SELECT * FROM "${t.name}" ORDER BY rowid`).all()}));old.close();
  const upgraded=openDatabase(path);
  for(const t of snapshots.filter(t=>t.name!=="schema_migrations")) expect(upgraded.prepare(`SELECT * FROM "${t.name}" ORDER BY rowid`).all()).toEqual(t.rows);
  const history=snapshots.find(t=>t.name==="schema_migrations")!;
  expect(upgraded.prepare("SELECT * FROM schema_migrations WHERE version< '009' ORDER BY rowid").all()).toEqual(history.rows);
  expect(upgraded.prepare("SELECT count(*) n FROM mail_scan_runs").get()).toEqual({n:0});upgraded.close();
  openDatabase(path).close();openDatabase(path,migrations).close();
});
