import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createEmptyTestWorkspace, testPrincipal } from "../helpers/test-workspace.js";
import { seedCandidateScreening } from "../helpers/candidate-screening-fixture.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { openDatabase } from "../../src/persistence/database.js";
import { createWorkspaceMcpServer } from "../../src/mcp/create-server.js";
import { verifyCandidateScreeningMigration } from "../../scripts/verify-candidate-screening-migration.js";
import { candidateListView, candidateView } from "../../src/web/views.js";

const cleanup: Array<() => void> = [];
afterEach(() => { for (const close of cleanup.splice(0).reverse()) close(); });
function fixture(fileBacked = false) {
  const w = createEmptyTestWorkspace({ fileBacked }); cleanup.push(w.cleanup);
  return { ...w, ...seedCandidateScreening(w.service), screening: w.service.candidateScreeningService };
}
const changes = (w: ReturnType<typeof fixture>) => w.database.prepare("SELECT total_changes() n").get();

it("persists immutable history, provenance and computed results across reopen without business side effects", () => {
  const w = fixture(true), input = w.request();
  const before = w.database.prepare("SELECT * FROM job_candidates").all();
  const saved = w.screening.record(input);
  expect(w.screening.record(input)).toEqual({ ...saved, replayed: true });
  expect(w.database.prepare("SELECT * FROM job_candidates").all()).toEqual(before);
  for (const table of ["projects", "tasks", "resources", "state_transitions", "candidate_decisions", "candidate_links", "candidate_match_assessments"]) {
    expect(w.database.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
  }
  expect(() => w.database.exec("UPDATE candidate_screenings SET reason='changed'")).toThrow(/immutable/);
  expect(() => w.database.exec("DELETE FROM candidate_screenings")).toThrow(/immutable/);
  w.database.close();
  const reopened = openDatabase(w.databasePath); cleanup.push(() => reopened.close());
  const service = new WorkspaceService(reopened, testPrincipal);
  const read = service.candidateScreeningService.get(w.candidate.id, { version: 1 });
  expect(read.summary).toMatchObject({ status: "CURRENT", decision: "FILTER", hidden: true });
  expect(read.record).toMatchObject({ profileSourceId: w.profile.id, input: { jd: expect.stringContaining("Minimum eight") },
    inputs: { sources: [expect.objectContaining({ content: w.profileContent })] }, result: { matchGrade: null } });
});

it("filters before counts and pagination, with identical shared Web/MCP summaries", () => {
  const w = fixture(); w.screening.record(w.request());
  w.addCandidate("Visible one"); w.addCandidate("Visible two");
  const page = w.service.candidateAssessmentService.listCandidates({ pageSize: 1 });
  expect(page.totalCount).toBe(2); expect(page.nextCursor).toBeTruthy();
  const next = w.service.candidateAssessmentService.listCandidates({ pageSize: 1, cursor: page.nextCursor });
  expect(next.items[0]?.id).not.toBe(page.items[0]?.id);
  expect(next.totalCount).toBe(2);
  const hidden = w.service.jobSearchQueryService.listCandidates({ screening: "FILTERED" });
  expect(hidden.totalCount).toBe(1);
  expect(hidden.items[0]?.screening).toEqual(w.screening.get(w.candidate.id).summary);
  expect(w.service.candidateAssessmentService.listCandidates({ screening: "ALL" }).totalCount).toBe(3);
  expect(() => w.service.candidateAssessmentService.listCandidates({ pageSize: 1, screening: "ALL", cursor: page.nextCursor })).toThrow(/page is no longer valid/);
  w.screening.setOverride(w.override());
  expect(() => w.service.candidateAssessmentService.listCandidates({ pageSize: 1, cursor: page.nextCursor })).toThrow(/page is no longer valid/);
});

it("keeps explicit recovery across new screenings until the user withdraws it", () => {
  const w = fixture(); w.screening.record(w.request());
  const command = w.override(), saved = w.screening.setOverride(command);
  expect(w.screening.setOverride(command)).toEqual({ ...saved, replayed: true });
  w.screening.record(w.request());
  expect(w.screening.get(w.candidate.id).summary).toMatchObject({ hidden: false, overrideMode: "KEEP", recordVersion: 2 });
  w.screening.setOverride(w.override("AUTOMATIC"));
  expect(w.screening.get(w.candidate.id).summary.hidden).toBe(true);
  expect(w.screening.get(w.candidate.id).overrides.items).toHaveLength(2);
  expect(() => w.database.exec("DELETE FROM candidate_screening_overrides")).toThrow(/immutable/);
  expect(() => w.database.exec("UPDATE candidate_screening_overrides SET mode='KEEP'")).toThrow(/immutable/);
});

it("preserves saved interest and never changes a separate dismissed decision", () => {
  const w = fixture();
  for (const action of ["SAVE", "DISMISS"] as const) {
    const candidate = w.service.jobSearchQueryService.getCandidate(w.candidate.id);
    w.service.candidateService.decideCandidate({ candidateId: candidate.id, action, expectedRecordVersion: candidate.recordVersion,
      authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Synthetic decision" }, idempotencyKey: randomUUID() });
    w.screening.record(w.request());
    if (action === "SAVE") expect(w.screening.get(candidate.id).summary.hidden).toBe(false);
    else { w.screening.setOverride(w.override()); expect(w.service.jobSearchQueryService.getCandidate(candidate.id).decision).toBe("DISMISSED"); }
  }
});

it.each(["jd", "profile", "directory", "candidate", "rule"] as const)("reappears after %s changes and preserves old inputs", kind => {
  const w = fixture(); w.screening.record(w.request());
  if (kind === "jd") w.service.jobLibraryService.saveDescription(w.candidate.id, "Updated JD", w.candidate.sourceUrl!);
  if (kind === "profile") w.service.jobLibraryService.saveSource({ sourceKey: "synthetic:screening-profile", title: "Updated preference",
    sourceUrl: "https://example.test/profile", content: w.profileContent + " Updated.", reviewStatus: "CONFIRMED", expectedVersion: 1 });
  if (kind === "directory") w.service.jobLibraryService.saveSource({ sourceKey: "synthetic:new", title: "New source", sourceUrl: null,
    content: "New attributable source", reviewStatus: "SOURCE", expectedVersion: 0 });
  if (kind === "candidate") w.database.prepare("UPDATE job_candidates SET role='Other role' WHERE id=?").run(w.candidate.id);
  if (kind === "rule") {
    // Simulate a database produced by an older executable rule version.
    w.database.exec("DROP TRIGGER candidate_screenings_no_update");
    w.database.exec("UPDATE candidate_screenings SET result_json=json_set(result_json,'$.ruleVersion','job-screening-v0')");
  }
  const read = w.screening.get(w.candidate.id, { version: 1 });
  expect(read.summary).toMatchObject({ hidden: false, status: "STALE" });
  expect(w.service.candidateAssessmentService.listCandidates().totalCount).toBe(1);
  expect(read.record?.input.jd).toContain("Minimum eight");
});

it("does not persist forged citations, unconfirmed profiles, unsupported quotes or caller-selected results", () => {
  const w = fixture(), request = w.request();
  const before = changes(w);
  const forged = structuredClone(request); forged.input.tenureExclusions[0]!.evidence.statement = "Invented preference";
  expect(() => w.screening.record(forged)).toThrow(/confirmed source/);
  const jd = structuredClone(request); jd.input.requirements[0]!.jdQuote = "Invented JD";
  expect(() => w.screening.record(jd)).toThrow(/unsupported JD/);
  expect(() => w.screening.record({ ...request, decision: "FILTER" })).toThrow(/Invalid/);
  expect(() => w.screening.record({ ...request, profileSourceId: randomUUID() })).toThrow(/Profile/);
  expect(changes(w)).toEqual(before);
  w.service.jobLibraryService.saveSource({ sourceKey: "synthetic:screening-profile", title: "Unverified source", sourceUrl: null,
    content: w.profileContent, reviewStatus: "SOURCE", expectedVersion: 1 });
  expect(() => w.screening.record(w.request())).toThrow(/confirmed source/);
});

it("rejects foreign/forged identities, web screening, and unconfirmed overrides with zero writes", () => {
  const w = fixture(); w.screening.record(w.request());
  const other = new WorkspaceService(w.database, { issuer: "other", subject: "other", workspaceName: "Other" }); other.ensureDevelopmentIdentity();
  const web = new WorkspaceService(w.database, { ...w.identity, channel: "WEB", requestId: "test-web" });
  const forged = new WorkspaceService(w.database, { ...w.identity, principalId: randomUUID(), channel: "MCP", requestId: "forged" });
  const before = changes(w);
  expect(() => other.candidateScreeningService.get(w.candidate.id)).toThrow(/not found/);
  expect(() => other.candidateScreeningService.record(w.request())).toThrow(/not found/);
  expect(() => other.candidateScreeningService.setOverride(w.override())).toThrow(/not found/);
  expect(() => forged.candidateScreeningService.record(w.request())).toThrow(/mapped/);
  expect(() => web.candidateScreeningService.record(w.request())).toThrow(/authority/);
  expect(() => w.screening.record({ ...w.request(), userConfirmed: false })).toThrow(/authority/);
  expect(() => w.screening.setOverride({ ...w.override(), userConfirmed: false })).toThrow(/authority/);
  expect(changes(w)).toEqual(before);
});

it("rejects version and idempotency conflicts without writes, replaying historical intent safely", () => {
  const w = fixture(), request = w.request(), race = w.request();
  w.screening.record(request); const before = changes(w);
  expect(() => w.screening.record(race)).toThrow(/version changed/);
  expect(() => w.screening.record({ ...request, reason: "Changed" })).toThrow(/idempotency/);
  expect(changes(w)).toEqual(before);
  const command = w.override(), overrideRace = w.override(); w.screening.setOverride(command);
  expect(() => w.screening.setOverride(overrideRace)).toThrow(/version changed/);
  expect(() => w.screening.setOverride({ ...command, reason: "Changed" })).toThrow(/idempotency/);
  const sourceRace = w.request(); w.service.jobLibraryService.saveDescription(w.candidate.id, "Updated JD", w.candidate.sourceUrl!);
  expect(() => w.screening.record(sourceRace)).toThrow(/inputs changed/);
  expect(w.screening.record(request)).toMatchObject({ replayed: true, recordVersion: 1 });
});

it("pages immutable screening and override histories independently", () => {
  const w = fixture();
  for (let i = 0; i < 12; i++) { w.screening.record(w.request()); w.screening.setOverride(w.override(i % 2 ? "KEEP" : "AUTOMATIC")); }
  const read = w.screening.get(w.candidate.id);
  expect(read.history.items).toHaveLength(10); expect(read.history.nextBeforeVersion).toBe(3);
  expect(read.overrides.items).toHaveLength(10); expect(read.overrides.nextBeforeVersion).toBe(3);
  const older = w.screening.get(w.candidate.id, { version: 1, beforeVersion: 3, overrideBeforeVersion: 3 });
  expect(older.record?.recordVersion).toBe(1); expect(older.history.items).toHaveLength(2); expect(older.overrides.items).toHaveLength(2);
  expect(() => w.screening.get(w.candidate.id, { version: 999 })).toThrow(/not found/);
});

it("renders hidden/recovery/history/stale UI and escapes evidence", () => {
  const w = fixture(), input = w.request(); input.reason = '<script>alert("screening")</script>';
  w.screening.record(input);
  expect(candidateListView(w.service, {}, "Australia/Sydney")).not.toContain(w.candidate.title);
  const hidden = candidateListView(w.service, { screening: "FILTERED" }, "Australia/Sydney");
  expect(hidden).toContain(w.candidate.title); expect(hidden).toContain('name="screening"'); expect(hidden).toContain("&lt;script&gt;");
  const detail = candidateView(w.service, w.candidate.id, "Australia/Sydney", new Date().toISOString());
  expect(detail).toContain("保留此职位"); expect(detail).toContain(w.profileContent); expect(detail).not.toContain('<script>alert("screening")');
  w.screening.setOverride(w.override());
  expect(candidateView(w.service, w.candidate.id, "Australia/Sydney", new Date().toISOString())).toContain("取消手动保留");
  w.service.jobLibraryService.saveDescription(w.candidate.id, "Updated JD", w.candidate.sourceUrl!);
  expect(candidateListView(w.service, {}, "Australia/Sydney")).toContain("待重新筛选");
});

it("exposes real MCP schemas and saves/reads/overrides across independent clients", async () => {
  const w = fixture();
  async function client() {
    const server = createWorkspaceMcpServer(w.service), c = new Client({ name: "screening-test", version: "1" });
    const [a,b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await c.connect(a);
    return { c, close: async () => { await c.close(); await server.close(); } };
  }
  const first = await client();
  try {
    const listed = await first.c.listTools();
    expect(listed.tools.find(t => t.name === "workspace_list_job_candidates")?.inputSchema.properties).toHaveProperty("screening");
    const saved = await first.c.callTool({ name: "workspace_record_candidate_screening", arguments: w.request() });
    expect(saved.structuredContent).toMatchObject({ result: { recordVersion: 1, replayed: false } });
  } finally { await first.close(); }
  const second = await client();
  try {
    const read = await second.c.callTool({ name: "workspace_get_candidate_screening", arguments: { candidateId: w.candidate.id, version: 1 } });
    expect(read.isError).not.toBe(true); expect(JSON.stringify(read)).toContain("USER_TENURE_PREFERENCE");
    expect((await second.c.callTool({ name: "workspace_override_candidate_screening", arguments: w.override() })).structuredContent).toMatchObject({ result: { recordVersion: 1 } });
    expect(w.screening.get(w.candidate.id).summary.hidden).toBe(false);
  } finally { await second.close(); }
});

it("migrates 019 to 020 additively, preserves prior data and supports repeated startup", () => {
  const w = fixture(), beforeDir = join(w.directory, "019"); mkdirSync(beforeDir);
  for (const file of readdirSync("db/migrations").filter(f => f.endsWith(".sql") && f < "020_")) copyFileSync(join("db/migrations", file), join(beforeDir, file));
  const beforePath = join(w.directory,"before.db"), afterPath = join(w.directory,"after.db");
  const old = openDatabase(beforePath, beforeDir);
  const service = new WorkspaceService(old, testPrincipal); service.ensureDevelopmentIdentity();
  service.candidateService.recordCandidate({ provider: "seek", postingId: "old", company: "Retained", title: "Retained", role: "Retained",
    sourceUrl: "https://example.test/old", authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Synthetic old data" }, idempotencyKey: randomUUID() });
  old.close(); copyFileSync(beforePath, afterPath);
  openDatabase(afterPath).close(); openDatabase(afterPath).close();
  expect(verifyCandidateScreeningMigration(beforePath, afterPath)).toMatchObject({ status: "PASS", addedTables: ["candidate_screening_overrides", "candidate_screenings"] });
});
