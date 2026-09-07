// Run on stdin via docker exec -i paw-paw-1 node --input-type=module.
// This script only calls read tools and prints schemas/hashes, not real records.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const client = new Client({name:'paw-p6-cloud-smoke',version:'1.0.0'});
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function call(name, args={}) {
  const response = await client.callTool({name,arguments:args});
  assert(!response.isError, `${name} failed`);
  return response.structuredContent.result;
}
try {
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3000/mcp')));
  const {tools} = await client.listTools();
  assert([13,21].includes(tools.length));
  const ping = await call('workspace_ping');
  assert.equal(ping.workspaceId,'d3c0a312-9c12-4b73-a598-eebf1b1de974');
  assert.equal(ping.database,'available');
  const hashes = {};
  for(const [label,name,args] of [
    ['today','workspace_get_today',{}],
    ['active','workspace_list_job_applications',{}],
    ['all','workspace_list_job_applications',{includeClosed:true}],
  ]) hashes[label] = digest(await call(name,args));
  const retained = await call('workspace_get_task',{taskId:'976b64d1-a758-486a-a8aa-c0322e684ede'});
  assert.equal(retained.task.status,'DONE');
  assert.equal(retained.task.recordVersion,2);
  const s2 = {};
  if(tools.length===21) {
    for(const name of ['workspace_list_job_candidates','workspace_list_recommendation_runs']) {
      s2[name] = await call(name);
    }
    const missing = await client.callTool({name:'workspace_get_job_candidate',arguments:{candidateId:'00000000-0000-4000-8000-000000000000'}});
    assert(missing.isError);
    assert.equal(JSON.parse(missing.content[0].text).error.code,'NOT_FOUND');
    s2.missingCandidate = 'NOT_FOUND';
  }
  console.log(JSON.stringify({toolCount:tools.length,workspaceId:ping.workspaceId,
    schemas:Object.fromEntries(tools.map(t=>[t.name,digest({input:t.inputSchema,output:t.outputSchema})])),
    hashes,retainedTask:retained.task,s2}));
} finally { await client.close(); }
