import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { WorkspaceService } from "../src/application/workspace-service.js";
import type { ProjectRecord } from "../src/domain/types.js";
import { createWorkspaceHttpApp } from "../src/mcp/http-app.js";
import { openDatabase, type WorkspaceDatabase } from "../src/persistence/database.js";

type JsonRecord = Record<string, unknown>;

interface TraceEvent {
  tool: string;
  arguments: JsonRecord;
  result: "SUCCESS" | "ERROR";
  errorCode?: string;
}

interface Fingerprint {
  hash: string;
  tables: number;
  rows: number;
}

interface ScenarioResult {
  scenario: string;
  protocolCase: string;
  result: "PASS";
  trace: TraceEvent[];
  fingerprint: {
    before: Fingerprint;
    after: Fingerprint;
    equal: boolean;
  };
  evidence: JsonRecord;
}

interface RawToolResult {
  isError: boolean;
  result?: JsonRecord;
  errorCode?: string;
}

interface Fixture {
  database: WorkspaceDatabase;
  databasePath: string;
  service: WorkspaceService;
  client: Client;
  server: Server;
  trace: TraceEvent[];
  call(tool: string, args?: JsonRecord): Promise<JsonRecord>;
  rawCall(tool: string, args?: JsonRecord): Promise<RawToolResult>;
  cleanup(): Promise<void>;
}

const fixedClock = () => new Date("2026-09-08T00:00:00.000Z");
const fingerprintScript = resolve(
  "deploy/cloud/database-logical-fingerprint.mjs",
);
const authority = {
  type: "EXPLICIT_USER_DEV" as const,
  confirmed: true as const,
  reference: "Synthetic Skills acceptance authority; isolated fixture only",
};

function logicalFingerprint(databasePath: string): Fingerprint {
  const run = spawnSync(process.execPath, [fingerprintScript, databasePath], {
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  const [hash, tables, rows] = run.stdout.trim().split("\t");
  assert.match(hash ?? "", /^[0-9a-f]{64}$/u);
  return {
    hash: hash as string,
    tables: Number(tables),
    rows: Number(rows),
  };
}

function tableCounts(database: WorkspaceDatabase): Record<string, number> {
  const tables = [
    "projects",
    "resources",
    "state_transitions",
    "transition_evidence",
    "tasks",
    "idempotency_records",
  ];
  return Object.fromEntries(
    tables.map((table) => {
      const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
        count: number;
      };
      return [table, row.count];
    }),
  );
}

function countDelta(
  before: Record<string, number>,
  after: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    Object.keys(before).map((table) => [
      table,
      (after[table] ?? 0) - (before[table] ?? 0),
    ]),
  );
}

function errorCode(response: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = response.content as Array<{ type: string; text?: string }>;
  const text = content.find((item) => item.type === "text");
  if (!text?.text) return "UNKNOWN";
  try {
    const parsed = JSON.parse(text.text) as { error?: { code?: string } };
    return parsed.error?.code ?? "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

async function createFixture(label: string): Promise<Fixture> {
  const directory = mkdtempSync(join(tmpdir(), `paw-skills-${label}-`));
  const databasePath = join(directory, "workspace.db");
  const database = openDatabase(databasePath, resolve("db/migrations"));
  const service = new WorkspaceService(
    database,
    {
      issuer: "synthetic-skills-acceptance",
      subject: label,
      workspaceName: `Synthetic Skills ${label}`,
    },
    { timeZone: "Australia/Sydney", clock: fixedClock },
  );
  service.ensureDevelopmentIdentity();

  const server = createWorkspaceHttpApp(service).listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  const address = server.address();
  assert(address && typeof address !== "string", "Missing synthetic MCP port");

  const client = new Client({
    name: "workspace-skills-synthetic-acceptance",
    version: "1.0.0",
  });
  await client.connect(
    new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${address.port}/mcp`),
    ),
  );
  const trace: TraceEvent[] = [];

  const rawCall = async (
    tool: string,
    args: JsonRecord = {},
  ): Promise<RawToolResult> => {
    const response = await client.callTool({ name: tool, arguments: args });
    if (response.isError) {
      const code = errorCode(response);
      trace.push({ tool, arguments: args, result: "ERROR", errorCode: code });
      return { isError: true, errorCode: code };
    }
    const structured = response.structuredContent as
      | { result?: JsonRecord }
      | undefined;
    assert(structured?.result, `${tool} returned no structured result`);
    trace.push({ tool, arguments: args, result: "SUCCESS" });
    return { isError: false, result: structured.result };
  };

  const call = async (
    tool: string,
    args: JsonRecord = {},
  ): Promise<JsonRecord> => {
    const response = await rawCall(tool, args);
    assert.equal(response.isError, false, `${tool}: ${response.errorCode}`);
    return response.result as JsonRecord;
  };

  return {
    database,
    databasePath,
    service,
    client,
    server,
    trace,
    call,
    rawCall,
    async cleanup() {
      await client.close();
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
      database.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

async function withFixture(
  label: string,
  run: (fixture: Fixture) => Promise<ScenarioResult>,
): Promise<ScenarioResult> {
  const fixture = await createFixture(label);
  try {
    return await run(fixture);
  } finally {
    await fixture.cleanup();
  }
}

function createApplication(
  fixture: Fixture,
  label: string,
  options: { allowDistinctDuplicate?: true; postingReference?: string } = {},
): ProjectRecord {
  const created = fixture.service.createJobApplication({
    company: `Synthetic ${label} Co`,
    role: "Synthetic Engineer",
    postingReference: options.postingReference ?? null,
    allowDistinctDuplicate: options.allowDistinctDuplicate,
    authority,
    idempotencyKey: `fixture-${label}-${options.postingReference ?? "base"}`,
  });
  assert.equal(created.creationStatus, "CREATED");
  return created.project;
}

function assertTrace(fixture: Fixture, expected: string[]): void {
  assert.deepEqual(
    fixture.trace.map((event) => event.tool),
    expected,
  );
}

async function runS1Normal(): Promise<ScenarioResult> {
  return withFixture("s1-normal", async (fixture) => {
    const project = createApplication(fixture, "S1 Normal");
    fixture.service.taskService.createTask({
      projectId: project.id,
      title: "Synthetic high-priority review",
      taskKind: "OTHER",
      priority: "HIGH",
      dueAt: null,
      authority,
      idempotencyKey: "fixture-s1-high-task",
    });
    const before = logicalFingerprint(fixture.databasePath);
    const today = await fixture.call("workspace_get_today");
    const after = logicalFingerprint(fixture.databasePath);

    assert.deepEqual(Object.keys(today).sort(), [
      "applicationsWithoutOpenTask",
      "attention",
      "date",
      "recentLifecycleChanges",
      "timeZone",
      "upcoming",
    ]);
    assert.equal((today.attention as unknown[]).length, 1);
    assert.deepEqual(after, before);
    assertTrace(fixture, ["workspace_get_today"]);

    return {
      scenario: "S1_NORMAL_READ_ONLY",
      protocolCase: "S1 normal Today",
      result: "PASS",
      trace: fixture.trace,
      fingerprint: { before, after, equal: true },
      evidence: {
        attentionItems: 1,
        mutationCalls: 0,
        unnecessaryReads: 0,
        contractFieldsPresent: true,
      },
    };
  });
}

async function runS2ReadOnly(): Promise<ScenarioResult> {
  return withFixture("s2-read-only", async (fixture) => {
    createApplication(fixture, "S2 Read Only");
    const before = logicalFingerprint(fixture.databasePath);
    const found = await fixture.call("workspace_find_job_application", {
      company: "Synthetic S2 Read Only Co",
      role: "Synthetic Engineer",
    });
    assert.equal(found.matchStatus, "EXACT");
    const match = (found.matches as JsonRecord[])[0];
    assert(match?.projectId);
    const details = await fixture.call("workspace_get_project", {
      projectId: match.projectId,
    });
    const after = logicalFingerprint(fixture.databasePath);

    assert.equal((details.project as JsonRecord).lifecycleState, "APPLIED");
    assert.deepEqual(after, before);
    assertTrace(fixture, [
      "workspace_find_job_application",
      "workspace_get_project",
    ]);

    return {
      scenario: "S2_T1_ACTIVE_READ_ONLY",
      protocolCase: "S2 T1",
      result: "PASS",
      trace: fixture.trace,
      fingerprint: { before, after, equal: true },
      evidence: {
        exactIdentity: true,
        lifecycleRead: true,
        mutationCalls: 0,
      },
    };
  });
}

async function runS2AmbiguousStop(): Promise<ScenarioResult> {
  return withFixture("s2-ambiguous", async (fixture) => {
    createApplication(fixture, "S2 Ambiguous", {
      postingReference: "https://synthetic.invalid/ambiguous/one",
    });
    createApplication(fixture, "S2 Ambiguous", {
      postingReference: "https://synthetic.invalid/ambiguous/two",
      allowDistinctDuplicate: true,
    });
    const before = logicalFingerprint(fixture.databasePath);
    const found = await fixture.call("workspace_find_job_application", {
      company: "Synthetic S2 Ambiguous Co",
      role: "Synthetic Engineer",
    });
    const after = logicalFingerprint(fixture.databasePath);

    assert.equal(found.matchStatus, "AMBIGUOUS");
    assert.equal((found.matches as unknown[]).length, 2);
    assert.deepEqual(after, before);
    assertTrace(fixture, ["workspace_find_job_application"]);

    return {
      scenario: "S2_T2_AMBIGUOUS_STOP",
      protocolCase: "S2 T2",
      result: "PASS",
      trace: fixture.trace,
      fingerprint: { before, after, equal: true },
      evidence: {
        matches: 2,
        guessedProjectRead: false,
        mutationCalls: 0,
      },
    };
  });
}

async function runS2AuthorizedTransition(): Promise<ScenarioResult> {
  return withFixture("s2-authorized", async (fixture) => {
    createApplication(fixture, "S2 Authorized");
    const before = logicalFingerprint(fixture.databasePath);
    const countsBefore = tableCounts(fixture.database);
    const found = await fixture.call("workspace_find_job_application", {
      company: "Synthetic S2 Authorized Co",
      role: "Synthetic Engineer",
    });
    const projectId = ((found.matches as JsonRecord[])[0]?.projectId) as string;
    const initial = await fixture.call("workspace_get_project", { projectId });
    const initialProject = initial.project as JsonRecord;
    const proposal = await fixture.call("workspace_propose_transition", {
      projectId,
      expectedLifecycleVersion: initialProject.lifecycleVersion,
      toState: "INTERVIEWING",
      triggerType: "USER_ASSERTION",
      evidenceResourceIds: [],
      rationale: "Synthetic explicit lifecycle acceptance",
      idempotencyKey: "s2-authorized-proposal",
    });
    const afterProposal = await fixture.call("workspace_get_project", { projectId });
    assert.equal((afterProposal.project as JsonRecord).lifecycleState, "APPLIED");
    assert.equal((afterProposal.project as JsonRecord).lifecycleVersion, 1);
    assert(
      (afterProposal.transitions as JsonRecord[]).some(
        (transition) => transition.status === "PROPOSED",
      ),
    );
    const transitionId = (proposal.transition as JsonRecord).id as string;
    await fixture.call("workspace_admit_transition", {
      transitionId,
      expectedLifecycleVersion: initialProject.lifecycleVersion,
      userConfirmed: true,
      authorityReference: "Synthetic user explicitly requested INTERVIEWING",
      idempotencyKey: "s2-authorized-admission",
    });
    const final = await fixture.call("workspace_get_project", { projectId });
    const after = logicalFingerprint(fixture.databasePath);
    const delta = countDelta(countsBefore, tableCounts(fixture.database));

    assert.deepEqual(final.project, {
      ...(final.project as JsonRecord),
      status: "ACTIVE",
      lifecycleState: "INTERVIEWING",
      lifecycleVersion: 2,
    });
    assert.equal((final.openTasks as JsonRecord[]).length, 1);
    assert.equal((final.openTasks as JsonRecord[])[0]?.taskKind, "PREPARE_FOR_INTERVIEW");
    assert.deepEqual(delta, {
      projects: 0,
      resources: 0,
      state_transitions: 1,
      transition_evidence: 0,
      tasks: 1,
      idempotency_records: 2,
    });
    assert.notDeepEqual(after, before);
    assertTrace(fixture, [
      "workspace_find_job_application",
      "workspace_get_project",
      "workspace_propose_transition",
      "workspace_get_project",
      "workspace_admit_transition",
      "workspace_get_project",
    ]);

    return {
      scenario: "S2_T5_AUTHORIZED_TRANSITION",
      protocolCase: "S2 T5",
      result: "PASS",
      trace: fixture.trace,
      fingerprint: { before, after, equal: false },
      evidence: {
        proposalReadbackUnchanged: true,
        finalLifecycle: "INTERVIEWING",
        finalLifecycleVersion: 2,
        derivedTaskKind: "PREPARE_FOR_INTERVIEW",
        tableRowDelta: delta,
      },
    };
  });
}

async function runS2ProposalOnly(): Promise<ScenarioResult> {
  return withFixture("s2-proposal-only", async (fixture) => {
    createApplication(fixture, "S2 Proposal Only");
    const before = logicalFingerprint(fixture.databasePath);
    const countsBefore = tableCounts(fixture.database);
    const found = await fixture.call("workspace_find_job_application", {
      company: "Synthetic S2 Proposal Only Co",
      role: "Synthetic Engineer",
    });
    const projectId = ((found.matches as JsonRecord[])[0]?.projectId) as string;
    const initial = await fixture.call("workspace_get_project", { projectId });
    await fixture.call("workspace_propose_transition", {
      projectId,
      expectedLifecycleVersion: (initial.project as JsonRecord).lifecycleVersion,
      toState: "RECRUITER_CONTACT",
      triggerType: "USER_ASSERTION",
      evidenceResourceIds: [],
      rationale: "Synthetic proposal only; do not admit",
      idempotencyKey: "s2-proposal-only",
    });
    const final = await fixture.call("workspace_get_project", { projectId });
    const after = logicalFingerprint(fixture.databasePath);
    const delta = countDelta(countsBefore, tableCounts(fixture.database));

    assert.equal((final.project as JsonRecord).lifecycleState, "APPLIED");
    assert.equal((final.project as JsonRecord).lifecycleVersion, 1);
    assert.equal((final.openTasks as unknown[]).length, 0);
    assert.deepEqual(delta, {
      projects: 0,
      resources: 0,
      state_transitions: 1,
      transition_evidence: 0,
      tasks: 0,
      idempotency_records: 1,
    });
    assert.notDeepEqual(after, before);
    assertTrace(fixture, [
      "workspace_find_job_application",
      "workspace_get_project",
      "workspace_propose_transition",
      "workspace_get_project",
    ]);

    return {
      scenario: "S2_T6_PROPOSAL_ONLY",
      protocolCase: "S2 T6",
      result: "PASS",
      trace: fixture.trace,
      fingerprint: { before, after, equal: false },
      evidence: {
        admissionCalls: 0,
        lifecycleUnchanged: true,
        tableRowDelta: delta,
      },
    };
  });
}

async function runS2ObservationOnly(): Promise<ScenarioResult> {
  return withFixture("s2-observation", async (fixture) => {
    createApplication(fixture, "S2 Observation");
    const before = logicalFingerprint(fixture.databasePath);
    const countsBefore = tableCounts(fixture.database);
    const found = await fixture.call("workspace_find_job_application", {
      company: "Synthetic S2 Observation Co",
      role: "Synthetic Engineer",
    });
    const projectId = ((found.matches as JsonRecord[])[0]?.projectId) as string;
    const initial = await fixture.call("workspace_get_project", { projectId });
    await fixture.call("workspace_record_observation", {
      projectId,
      resourceType: "NOTE",
      provider: "synthetic-skills-acceptance",
      externalId: "s2-observation-1",
      title: "Synthetic observation",
      observedFacts: {
        synthetic: true,
        summary: "Synthetic evidence only; no external source accessed",
      },
      observedAt: fixedClock().toISOString(),
      idempotencyKey: "s2-observation-only",
    });
    const final = await fixture.call("workspace_get_project", { projectId });
    const after = logicalFingerprint(fixture.databasePath);
    const delta = countDelta(countsBefore, tableCounts(fixture.database));

    assert.equal(
      (final.project as JsonRecord).lifecycleState,
      (initial.project as JsonRecord).lifecycleState,
    );
    assert.equal(
      (final.project as JsonRecord).lifecycleVersion,
      (initial.project as JsonRecord).lifecycleVersion,
    );
    assert.equal((final.resources as unknown[]).length, 1);
    assert.deepEqual(delta, {
      projects: 0,
      resources: 1,
      state_transitions: 0,
      transition_evidence: 0,
      tasks: 0,
      idempotency_records: 1,
    });
    assert.notDeepEqual(after, before);
    assertTrace(fixture, [
      "workspace_find_job_application",
      "workspace_get_project",
      "workspace_record_observation",
      "workspace_get_project",
    ]);

    return {
      scenario: "S2_T8_OBSERVATION_ONLY",
      protocolCase: "S2 T8",
      result: "PASS",
      trace: fixture.trace,
      fingerprint: { before, after, equal: false },
      evidence: {
        lifecycleUnchanged: true,
        resourceReadback: true,
        tableRowDelta: delta,
      },
    };
  });
}

async function runS2InvalidTransition(): Promise<ScenarioResult> {
  return withFixture("s2-invalid", async (fixture) => {
    createApplication(fixture, "S2 Invalid");
    const before = logicalFingerprint(fixture.databasePath);
    const countsBefore = tableCounts(fixture.database);
    const found = await fixture.call("workspace_find_job_application", {
      company: "Synthetic S2 Invalid Co",
      role: "Synthetic Engineer",
    });
    const projectId = ((found.matches as JsonRecord[])[0]?.projectId) as string;
    const initial = await fixture.call("workspace_get_project", { projectId });
    const rejected = await fixture.call("workspace_propose_transition", {
      projectId,
      expectedLifecycleVersion: (initial.project as JsonRecord).lifecycleVersion,
      toState: "OFFER",
      triggerType: "USER_ASSERTION",
      evidenceResourceIds: [],
      rationale: "Synthetic invalid transition",
      idempotencyKey: "s2-invalid-transition",
    });
    const final = await fixture.call("workspace_get_project", { projectId });
    const after = logicalFingerprint(fixture.databasePath);
    const delta = countDelta(countsBefore, tableCounts(fixture.database));

    assert.equal((rejected.transition as JsonRecord).status, "REJECTED");
    assert.equal((final.project as JsonRecord).lifecycleState, "APPLIED");
    assert.equal((final.project as JsonRecord).lifecycleVersion, 1);
    assert.equal((final.openTasks as unknown[]).length, 0);
    assert.deepEqual(delta, {
      projects: 0,
      resources: 0,
      state_transitions: 1,
      transition_evidence: 0,
      tasks: 0,
      idempotency_records: 1,
    });
    assert.notDeepEqual(after, before);
    assertTrace(fixture, [
      "workspace_find_job_application",
      "workspace_get_project",
      "workspace_propose_transition",
      "workspace_get_project",
    ]);

    return {
      scenario: "S2_T9_INVALID_TRANSITION",
      protocolCase: "S2 T9 invalid transition",
      result: "PASS",
      trace: fixture.trace,
      fingerprint: { before, after, equal: false },
      evidence: {
        proposalStatus: "REJECTED",
        lifecycleUnchanged: true,
        admissionCalls: 0,
        tableRowDelta: delta,
      },
    };
  });
}

async function runS2StaleAdmission(): Promise<ScenarioResult> {
  return withFixture("s2-stale", async (fixture) => {
    const project = createApplication(fixture, "S2 Stale");
    const found = await fixture.call("workspace_find_job_application", {
      company: "Synthetic S2 Stale Co",
      role: "Synthetic Engineer",
    });
    const projectId = ((found.matches as JsonRecord[])[0]?.projectId) as string;
    const initial = await fixture.call("workspace_get_project", { projectId });
    const agentProposal = await fixture.call("workspace_propose_transition", {
      projectId,
      expectedLifecycleVersion: 1,
      toState: "INTERVIEWING",
      triggerType: "USER_ASSERTION",
      evidenceResourceIds: [],
      rationale: "Synthetic proposal that will become stale",
      idempotencyKey: "s2-stale-agent-proposal",
    });
    await fixture.call("workspace_get_project", { projectId });

    // Operator-side concurrency injection. This is deliberately outside the
    // agent-visible trace and represents another actor advancing Workspace state.
    const concurrent = fixture.service.proposeTransition({
      projectId: project.id,
      expectedLifecycleVersion: 1,
      toState: "RECRUITER_CONTACT",
      triggerType: "USER_ASSERTION",
      evidenceResourceIds: [],
      rationale: "Synthetic concurrent operator transition",
      idempotencyKey: "s2-stale-concurrent-proposal",
    });
    fixture.service.admitTransition({
      transitionId: concurrent.transition.id,
      expectedLifecycleVersion: 1,
      authority,
      idempotencyKey: "s2-stale-concurrent-admission",
    });

    const before = logicalFingerprint(fixture.databasePath);
    const stale = await fixture.rawCall("workspace_admit_transition", {
      transitionId: (agentProposal.transition as JsonRecord).id,
      expectedLifecycleVersion: (initial.project as JsonRecord).lifecycleVersion,
      userConfirmed: true,
      authorityReference: "Synthetic user approval limited to stale proposal",
      idempotencyKey: "s2-stale-agent-admission",
    });
    const final = await fixture.call("workspace_get_project", { projectId });
    const after = logicalFingerprint(fixture.databasePath);

    assert.equal(stale.isError, true);
    assert.equal(stale.errorCode, "CONCURRENCY_CONFLICT");
    assert.deepEqual(after, before);
    assert.equal((final.project as JsonRecord).lifecycleState, "RECRUITER_CONTACT");
    assert.equal((final.project as JsonRecord).lifecycleVersion, 2);
    assertTrace(fixture, [
      "workspace_find_job_application",
      "workspace_get_project",
      "workspace_propose_transition",
      "workspace_get_project",
      "workspace_admit_transition",
      "workspace_get_project",
    ]);

    return {
      scenario: "S2_T9_STALE_VERSION",
      protocolCase: "S2 T9 stale lifecycle version",
      result: "PASS",
      trace: fixture.trace,
      fingerprint: { before, after, equal: true },
      evidence: {
        failedCallError: "CONCURRENCY_CONFLICT",
        failedCallDurableDelta: "none",
        retainedNewKeyRetry: false,
        finalReadbackMatchesConcurrentState: true,
      },
    };
  });
}

const scenarios = await Promise.all([
  runS1Normal(),
  runS2ReadOnly(),
  runS2AmbiguousStop(),
  runS2AuthorizedTransition(),
  runS2ProposalOnly(),
  runS2ObservationOnly(),
  runS2InvalidTransition(),
  runS2StaleAdmission(),
]);

console.log(
  JSON.stringify(
    {
      schemaVersion: "paw-workspace-skills-synthetic-acceptance-v1",
      generatedAt: new Date().toISOString(),
      fixedClock: fixedClock().toISOString(),
      isolation: {
        workspacePerScenario: true,
        fileDatabasePerScenario: true,
        loopbackMcpOnly: true,
        externalSourcesAvailable: false,
        productionStateUsed: false,
      },
      scope: {
        proves: [
          "Workspace MCP trace recipes",
          "logical before/after fingerprints",
          "bounded table-row deltas",
          "exact readback behavior",
          "selected fail-closed contract behavior",
        ],
        doesNotProve: [
          "Skill discovery",
          "model routing",
          "model authority decisions",
          "fresh-context platform acceptance",
          "baseline prompt improvement",
        ],
      },
      summary: {
        result: "PASS",
        scenarios: scenarios.length,
        passed: scenarios.length,
        failed: 0,
      },
      scenarios,
    },
    null,
    2,
  ),
);
