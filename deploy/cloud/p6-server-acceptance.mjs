// Scoped P6 MCP acceptance. Run with the fixture receipt and read-only DB mounts.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import assert from 'node:assert/strict';
assert.equal(process.env.PAW_P6_AUTHORITY,'approved-steps-1-4-20260907');
const fixtures=JSON.parse(fs.readFileSync(process.env.PAW_P6_FIXTURES_PATH,'utf8'));
const database=new Database(process.env.PAW_P6_DB_PATH,{readonly:true,fileMustExist:true});
const baseline=new Database(process.env.PAW_P6_BASELINE_PATH,{readonly:true,fileMustExist:true});
const client=new Client({name:'paw-p6-acceptance',version:'1.0.0'});
const auth=label=>({userConfirmed:true,authorityReference:`P6 ${label}; user approved steps 1-4 on 2026-09-07`,idempotencyKey:`p6-20260907-check-${label}`});
const count=table=>database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
const quote=name=>`"${name.replaceAll('"','""')}"`;
async function call(name,args={}) {
  const response=await client.callTool({name,arguments:args});
  if(response.isError) throw new Error(`${name}: ${response.content[0].text}`);
  return response.structuredContent.result;
}
function report(scenario,result,evidence){console.log(JSON.stringify({scenario,result,evidence}));}
try {
  const endpoint=new URL(process.env.PAW_P6_ENDPOINT??'http://127.0.0.1:3000/mcp');
  assert.equal(endpoint.hostname,'127.0.0.1'); assert.equal(endpoint.protocol,'http:');
  await client.connect(new StreamableHTTPClientTransport(endpoint));
  assert.equal((await call('workspace_ping')).workspaceId,
    process.env.PAW_P6_WORKSPACE_ID??'d3c0a312-9c12-4b73-a598-eebf1b1de974');
  for(const app of Object.values(fixtures.applications)) assert(app.title.startsWith('SYNTHETIC TEST - P6'));
  for(const candidate of Object.values(fixtures.candidates)) assert.equal(candidate.provider,'synthetic-p6');

  const a02=await call('workspace_get_project',{projectId:fixtures.applications.A02.id});
  assert.equal(a02.project.lifecycleState,'APPLIED');
  const proposal=database.prepare('SELECT status FROM state_transitions WHERE id=?').get(fixtures.proposal.transition.id);
  assert.equal(proposal.status,'PROPOSED');
  report('A02','PARTIAL',{lifecycle:'APPLIED',proposal:'PROPOSED',remaining:'Web observation/proposal display'});

  const today=await call('workspace_get_today');
  const high=today.attention.filter(t=>t.taskId===fixtures.tasks['A05-High'].id);
  const blocked=today.attention.filter(t=>t.taskId===fixtures.tasks['A05-Blocked'].id);
  assert.equal(high.length,1); assert.equal(blocked.length,1);
  assert(high[0].reasons.includes('HIGH_PRIORITY'));
  assert(blocked[0].reasons.includes('OVERDUE')&&blocked[0].reasons.includes('BLOCKED'));
  assert(today.applicationsWithoutOpenTask.some(p=>p.projectId===fixtures.applications['A05-Gap'].id));
  report('A05','PARTIAL',{high:high[0].reasons,blocked:blocked[0].reasons,countedOnce:true,remaining:'Web comparison'});

  const projectsBefore=count('projects'), transitionsBefore=count('state_transitions'), candidatesBefore=count('job_candidates');
  for(const [label,action] of [['A07-Save','SAVE'],['A07-Dismiss','DISMISS']]) {
    const candidate=fixtures.candidates[label];
    await call('workspace_decide_candidate',{candidateId:candidate.id,action,expectedRecordVersion:candidate.recordVersion,...auth(label)});
  }
  const items=['A07-Save','A07-Dismiss'].map(label=>{
    const c=fixtures.candidates[label];
    return {provider:c.provider,postingId:c.postingId,sourceUrl:c.sourceUrl,title:c.title,company:c.company,
      role:c.role,location:c.location,fitReason:c.fitReason,fitUncertainty:c.fitUncertainty,sourceAvailability:c.sourceAvailability};
  });
  const run=await call('workspace_record_recommendation_run',{provider:'synthetic-p6',
    runAt:'2026-09-07T03:00:00.000Z',runReference:'SYNTHETIC TEST - P6 A07 repeat recommendations',
    coverageStatus:'COMPLETE',deliveryStatus:'UNKNOWN',coverageNote:'Synthetic persistence acceptance, no real source search',
    items,...auth('A07-repeat-run')});
  for(const [label,decision] of [['A07-Save','SAVED'],['A07-Dismiss','DISMISSED']]) {
    const candidate=await call('workspace_get_job_candidate',{candidateId:fixtures.candidates[label].id});
    assert.equal(candidate.decision,decision);
    assert.equal(candidate.linkedProjectId,null);
  }
  assert.equal(count('projects'),projectsBefore); assert.equal(count('state_transitions'),transitionsBefore);
  assert.equal(count('job_candidates'),candidatesBefore);
  report('A07','PASS',{decisions:['SAVED','DISMISSED'],runId:run.run.id,noNewApplications:true,noLifecycleChanges:true,noNewCandidates:true});

  const candidate=fixtures.candidates.A08, app=fixtures.applications.A08;
  const beforeDuplicate=database.serialize();
  const duplicate=await call('workspace_create_job_application',{company:candidate.company,role:candidate.role,...auth('A08-duplicate')});
  assert.equal(duplicate.creationStatus,'POSSIBLE_DUPLICATE');
  assert.deepEqual(database.serialize(),beforeDuplicate);
  const intent={candidateId:candidate.id,projectId:app.id,...auth('A08-link')};
  await call('workspace_link_job_candidate',intent);
  const beforeReplay=database.serialize();
  const replay=await call('workspace_link_job_candidate',intent);
  assert.equal(replay.replayed,true); assert.deepEqual(database.serialize(),beforeReplay);
  assert.equal((await call('workspace_get_job_candidate',{candidateId:candidate.id})).linkedProjectId,app.id);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM candidate_links WHERE candidate_id=?').get(candidate.id).n,1);
  report('A08','PASS',{duplicate:'POSSIBLE_DUPLICATE',selectedSyntheticApplication:app.id,links:1,replayNoWrite:true});

  for(const [label,coverage] of [['A11-Complete','COMPLETE'],['A11-Failed','FAILED'],['A11-Unknown','COMPLETE']]) {
    const run=await call('workspace_get_recommendation_run',{runId:fixtures.runs[label].id});
    assert.equal(run.coverageStatus,coverage); assert.equal(run.deliveryStatus,'UNKNOWN'); assert.equal(run.itemCount,0);
  }
  report('A11','PASS',{coverage:['COMPLETE','FAILED','COMPLETE'],delivery:['UNKNOWN','UNKNOWN','UNKNOWN'],externalSourceSearched:false});

  // Every pre-fixture row must remain identical, including retained synthetic S1 evidence.
  let preserved=0;
  for(const {name} of baseline.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
    const columns=baseline.prepare(`PRAGMA table_info(${quote(name)})`).all();
    let keys=columns.filter(c=>c.pk).map(c=>c.name);
    if(!keys.length) keys=columns.map(c=>c.name);
    const lookup=database.prepare(`SELECT * FROM ${quote(name)} WHERE ${keys.map(k=>`${quote(k)} IS ?`).join(' AND ')}`);
    for(const row of baseline.prepare(`SELECT * FROM ${quote(name)}`).all()) {
      assert.deepEqual(lookup.get(...keys.map(k=>row[k])),row,`Pre-existing row changed in ${name}`); preserved++;
    }
  }
  assert.equal(database.pragma('integrity_check',{simple:true}),'ok');
  assert.deepEqual(database.pragma('foreign_key_check'),[]);
  report('data-preservation','PASS',{preservedRows:preserved,integrity:'ok',projects:count('projects'),tasks:count('tasks'),candidates:count('job_candidates')});
} finally {await client.close(); database.close(); baseline.close();}
