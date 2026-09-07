// One-time operator cleanup authorized by the user's 2026-09-07 request.
// Run against a backup copy first. Full backup is the archive of test evidence.
import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

assert.equal(process.env.PAW_CLEANUP_AUTHORITY, 'user-request-20260907');
assert(process.env.PAW_CLEANUP_DB);
const apply = process.argv.includes('--apply');
const db = new Database(process.env.PAW_CLEANUP_DB, {fileMustExist:true});
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
const workspace = 'd3c0a312-9c12-4b73-a598-eebf1b1de974';
const quote = value => '"' + value.replaceAll('"','""') + '"';
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
const read = table => db.prepare(`SELECT rowid AS cleanup_rowid, * FROM ${quote(table)} ORDER BY rowid`).all();
try {
 db.exec('BEGIN IMMEDIATE');
 const before = Object.fromEntries(tables.map(t=>[t,read(t)]));
 const removed = Object.fromEntries(tables.map(t=>[t,new Set()]));
 const select = (table,predicate) => { for(const r of before[table]) if(predicate(r)) removed[table].add(r.cleanup_rowid); };
 const ids = table => new Set(before[table].filter(r=>removed[table].has(r.cleanup_rowid)).map(r=>r.id));
 const labels = new Set(['A01','A02','A03','A04-History','A05-High','A05-Gap','A06','A08','A09','A10']);
 select('projects',r=>{
  if(r.workspace_id!==workspace) return false;
  const m=JSON.parse(r.metadata_json);
  if(r.id==='8568a3c3-768a-46b6-acf2-ac85e5108710') {
   assert.equal(m.company,'PAW Synthetic Acceptance');
   assert.equal(m.postingReference,'https://example.invalid/paw/s1-05b-20260906');
   return true;
  }
  for(const label of labels) if(m.company===`SYNTHETIC TEST - P6 ${label}`) {
   assert.equal(m.postingReference,`https://synthetic.p6.test/${label}`);
   assert.equal(m.role,'Synthetic Engineer'); assert.equal(m.location,'Synthetic'); return true;
  }
  const match=/^SYNTHETIC TEST - P6-A04 Company (\d{3})$/.exec(m.company??'');
  if(!match) return false;
  assert(Number(match[1])<106);
  assert.equal(m.postingReference,`https://synthetic.p6-a04.test/posting/${match[1]}`);
  assert.equal(m.role,'Synthetic Engineer'); assert.equal(m.location,'Synthetic'); return true;
 });
 const projects=ids('projects'); assert.equal(projects.size,117);
 assert.equal(before.projects.filter(r=>r.workspace_id===workspace).length,140);
 for(const table of ['tasks','resources','state_transitions']) select(table,r=>projects.has(r.project_id));
 const tasks=ids('tasks'), resources=ids('resources'), transitions=ids('state_transitions');
 select('task_command_audit',r=>tasks.has(r.task_id));
 select('transition_evidence',r=>transitions.has(r.transition_id)&&resources.has(r.resource_id));
 select('job_candidates',r=>r.workspace_id===workspace&&r.provider==='synthetic-p6'&&r.company.startsWith('SYNTHETIC TEST - P6'));
 const candidates=ids('job_candidates'); assert.equal(candidates.size,5);
 for(const r of before.job_candidates.filter(r=>candidates.has(r.id))) assert(!r.linked_project_id||projects.has(r.linked_project_id));
 select('candidate_decisions',r=>candidates.has(r.candidate_id));
 select('candidate_links',r=>candidates.has(r.candidate_id)&&projects.has(r.project_id));
 select('recommendation_runs',r=>r.workspace_id===workspace&&r.provider==='synthetic-p6'&&r.run_reference.startsWith('SYNTHETIC TEST - P6'));
 const runs=ids('recommendation_runs'); assert.equal(runs.size,4);
 select('recommendation_run_items',r=>runs.has(r.run_id)&&candidates.has(r.candidate_id));
 const targetIds=new Set([...projects,...tasks,...resources,...transitions,...candidates,...runs]);
 const containsTarget=value=>typeof value==='string'?targetIds.has(value):Array.isArray(value)?value.some(containsTarget):value&&typeof value==='object'?Object.values(value).some(containsTarget):false;
 const retainedProjects=new Set(before.projects.filter(r=>!projects.has(r.id)).map(r=>r.id));
 select('idempotency_records',r=>{
  if(r.workspace_id!==workspace||!containsTarget(JSON.parse(r.response_json))) return false;
  for(const id of retainedProjects) assert(!r.response_json.includes(id),'Mixed real/synthetic response; stop for review');
  return true;
 });
 const retained=Object.fromEntries(tables.map(t=>[t,before[t].filter(r=>!removed[t].has(r.cleanup_rowid))]));
 const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const retainedHash=digest(retained);
 for(const table of ['idempotency_records','recommendation_run_items','recommendation_runs','candidate_links','candidate_decisions','job_candidates','task_command_audit','tasks','transition_evidence','state_transitions','resources','projects']) {
  const statement=db.prepare(`DELETE FROM ${quote(table)} WHERE rowid=?`);
  for(const rowid of removed[table]) assert.equal(statement.run(rowid).changes,1);
 }
 const after=Object.fromEntries(tables.map(t=>[t,read(t)]));
 assert.equal(digest(after),retainedHash,'Untargeted rows changed');
 assert.deepEqual(db.pragma('foreign_key_check'),[]);
 assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
 const report={mode:apply?'APPLIED':'DRY_RUN_ROLLED_BACK',removed:Object.fromEntries(tables.filter(t=>removed[t].size).map(t=>[t,removed[t].size])),remainingApplications:after.projects.filter(r=>r.workspace_id===workspace).length,remainingTasks:after.tasks.length,retainedHash,allUntargetedRowsUnchanged:true,integrity:'ok'};
 db.exec(apply?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify(report));
} catch(error) {if(db.inTransaction) db.exec('ROLLBACK');throw error;} finally {db.close();}
