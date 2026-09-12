// Authorized P6 fixtures only. Invoke on stdin inside the deployed container.
// Requires PAW_P6_AUTHORITY=approved-steps-1-4-20260907 and the existing Workspace.
// Fixed inputs/keys permit recovery by replay without creating duplicate fixtures.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import assert from 'node:assert/strict';
assert.equal(process.env.PAW_P6_AUTHORITY,'approved-steps-1-4-20260907');
const client = new Client({name:'paw-p6-fixtures',version:'1.0.0'});
const prefix = 'SYNTHETIC TEST - P6';
const fixtureTime = '2026-09-07T03:00:00.000Z';
const authorize = label => ({userConfirmed:true,authorityReference:`P6 ${label}; user approved steps 1-4 on 2026-09-07`,idempotencyKey:`p6-20260907-${label}`});
const receipt = {applications:{},tasks:{},candidates:{},runs:{},observations:[],proposal:null};
async function call(name, args) {
  const response = await client.callTool({name,arguments:args});
  if(response.isError) throw new Error(`${name}: ${response.content[0].text}`);
  return response.structuredContent.result;
}
try {
  const endpoint = new URL(process.env.PAW_P6_ENDPOINT ?? 'http://127.0.0.1:3000/mcp');
  assert.equal(endpoint.hostname,'127.0.0.1');
  assert.equal(endpoint.protocol,'http:');
  await client.connect(new StreamableHTTPClientTransport(endpoint));
  assert.equal((await call('workspace_ping',{})).workspaceId,
    process.env.PAW_P6_WORKSPACE_ID ?? 'd3c0a312-9c12-4b73-a598-eebf1b1de974');
  assert.equal((await client.listTools()).tools.length,35);
  for(const label of ['A01','A02','A03','A04-History','A05-High','A05-Gap','A06','A08','A09','A10']) {
    const result = await call('workspace_create_job_application',{
      company:`${prefix} ${label}`,role:'Synthetic Engineer',location:'Synthetic',
      postingReference:`https://synthetic.p6.test/${label}`, ...authorize(`App-${label}`),
    });
    assert.equal(result.creationStatus,'CREATED');
    receipt.applications[label] = result.project;
  }
  for(const label of ['A03','A06','A09','A10','A05-High','A05-Blocked']) {
    const result = await call('workspace_create_task',{
      projectId:receipt.applications[label==='A05-Blocked'?'A05-High':label].id,
      title:`${prefix} Task-${label}`,taskKind:'OTHER',
      priority:label.startsWith('A05')?'HIGH':'LOW',
      dueAt:label==='A05-Blocked'?'2026-09-06T00:00:00.000Z':null,
      ...authorize(`Task-${label}`),
    });
    receipt.tasks[label] = result.task;
    if(label==='A05-Blocked') {
      receipt.tasks[label] = (await call('workspace_update_task',{
        taskId:result.task.id,expectedRecordVersion:result.task.recordVersion,status:'BLOCKED',
        ...authorize('Task-A05-Blocked-status'),
      })).task;
    }
  }
  for(const label of ['A02',...Array.from({length:11},(_,i)=>`A04-History-${i+1}`)]) {
    const app = receipt.applications[label==='A02'?'A02':'A04-History'];
    const observation = await call('workspace_record_observation',{
      projectId:app.id,resourceType:'NOTE',provider:'synthetic-p6',externalId:label,
      title:`${prefix} ${label}`,observedFacts:{synthetic:true,scenario:label,summary:'Synthetic acceptance evidence only'},
      observedAt:fixtureTime,idempotencyKey:`p6-20260907-observation-${label}`,
    });
    receipt.observations.push(observation.resource);
    if(label==='A02') receipt.proposal = await call('workspace_propose_transition',{
      projectId:app.id,expectedLifecycleVersion:app.lifecycleVersion,toState:'RECRUITER_CONTACT',
      triggerType:'EXTERNAL_EVIDENCE',evidenceResourceIds:[observation.resource.id],
      rationale:'SYNTHETIC TEST - P6 A02 proposal only; do not admit',
      idempotencyKey:'p6-20260907-proposal-A02',
    });
  }
  for(const label of ['A07-Save','A07-Dismiss','A08','A10-Save','A10-Dismiss']) {
    const result = await call('workspace_record_candidate',{
      provider:'synthetic-p6',postingId:label,sourceUrl:`https://synthetic.p6.test/${label}`,
      title:`${prefix} Candidate-${label}`,company:`${prefix} ${label}`,role:'Synthetic Engineer',
      location:'Synthetic',fitReason:'Synthetic fixture, not a real recommendation',fitUncertainty:'UNKNOWN',
      sourceAvailability:'UNKNOWN',...authorize(`Candidate-${label}`),
    });
    receipt.candidates[label] = result.candidate;
  }
  for(const [label,coverageStatus] of [['A11-Complete','COMPLETE'],['A11-Failed','FAILED'],['A11-Unknown','COMPLETE']]) {
    const result = await call('workspace_record_recommendation_run',{
      provider:'synthetic-p6',runAt:fixtureTime,runReference:`${prefix} ${label}`,
      coverageStatus,deliveryStatus:'UNKNOWN',coverageNote:'Explicit synthetic scenario; no external source was searched or message sent',
      items:[],...authorize(`Run-${label}`),
    });
    receipt.runs[label] = result.run;
  }
  console.log(JSON.stringify(receipt));
} finally { await client.close(); }
