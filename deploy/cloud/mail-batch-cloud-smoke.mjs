// Execute against the running container with docker exec -i ... node --input-type=module.
// Read-only release probe: no mail bodies, scan creation or business writes.
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Supply expected identities explicitly; do not publish account addresses in code.
const expected = Object.fromEntries(['PAW_SMOKE_WORKSPACE_ID', 'PAW_SMOKE_MAILBOX_1_EMAIL',
  'PAW_SMOKE_MAILBOX_2_EMAIL', 'PAW_SMOKE_HISTORICAL_RUN_ID'].map(name => {
  const value = process.env[name]?.trim();
  assert(value, `Missing ${name}`);
  return [name, value];
}));
const client = new Client({ name: 'paw-mail-batch-release', version: '1.0.0' });
async function call(name, args = {}) {
  const response = await client.callTool({ name, arguments: args });
  assert(!response.isError, `${name} failed`);
  assert(response.structuredContent?.result, `${name} returned no result`);
  return response.structuredContent.result;
}
try {
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3000/mcp')));
  const { tools } = await client.listTools();
  assert.equal(tools.length, 40);
  for (const name of ['workspace_next_mail_batch', 'workspace_ack_mail_batch',
    'workspace_start_mail_scan', 'workspace_finish_mail_scan', 'workspace_get_mail_scans']) {
    assert(tools.some(tool => tool.name === name), `Missing ${name}`);
  }
  const ping = await call('workspace_ping');
  assert.equal(ping.workspaceId, expected.PAW_SMOKE_WORKSPACE_ID);
  assert.equal(ping.database, 'available');
  const accounts = await call('workspace_get_mail_accounts');
  assert.equal(accounts.mailboxes.length, 2);
  for (const [mailbox, email] of [['mailbox-1', expected.PAW_SMOKE_MAILBOX_1_EMAIL],
    ['mailbox-2', expected.PAW_SMOKE_MAILBOX_2_EMAIL]]) {
    assert(accounts.mailboxes.some(account => account.mailbox === mailbox &&
      account.email === email && account.status === 'AVAILABLE'), `${mailbox} unavailable or mismatched`);
  }
  const scans = await call('workspace_get_mail_scans');
  assert(Array.isArray(scans.processing?.streams));
  const historical = await call('workspace_get_mail_scans', {
    runId: expected.PAW_SMOKE_HISTORICAL_RUN_ID,
  });
  assert.equal(historical.run.status, 'PARTIAL');
  assert.equal(historical.run.triggerType, 'MANUAL');
  console.log(JSON.stringify({ status: 'PASS', toolCount: tools.length,
    database: ping.database, mailboxes: accounts.mailboxes.map(({ mailbox, status }) => ({ mailbox, status })),
    historicalReceipt: 'MANUAL/PARTIAL', unfinishedCount: scans.unfinishedCount,
    processingStreams: scans.processing.streams.length,
    scanExecuted: false }));
} finally {
  await client.close();
}
