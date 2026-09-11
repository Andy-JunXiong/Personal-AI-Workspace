import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createEmptyTestWorkspace, testPrincipal } from "../helpers/test-workspace.js";
import { resumeFixture } from "../helpers/resume-fixture.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { createWorkspaceMcpServer } from "../../src/mcp/create-server.js";
import { openDatabase } from "../../src/persistence/database.js";
import { verifyCandidateAssessmentsMigration } from "../../scripts/verify-candidate-assessments-migration.js";
import type { CandidateAssessmentReport } from "../../src/domain/candidate-match-assessment.js";

const cleanup: Array<() => void> = [];
afterEach(() => { for (const close of cleanup.splice(0).reverse()) close(); });
const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic user request" };
function fixture(options: { materials?: boolean; fileBacked?: boolean } = {}) {
  const w = createEmptyTestWorkspace({ fileBacked: options.fileBacked }); cleanup.push(w.cleanup);
  const candidate = w.service.candidateService.recordCandidate({ provider: "seek", postingId: "123",
    sourceUrl: "https://www.seek.com.au/job/123", company: "Example", title: "Engineer", role: "Engineer",
    authority, idempotencyKey: randomUUID() }).candidate;
  if (options.materials !== false) {
    w.service.resumeService.initialize(Buffer.from("PKsynthetic"), resumeFixture(), "https://drive.google.com/file/d/example/view");
    w.service.jobLibraryService.saveDescription(candidate.id, "Build tested software. Python experience preferred.", candidate.sourceUrl!);
  }
  const source = w.service.jobLibraryService.saveSource({ sourceKey: "example:case", title: "Case.docx", sourceUrl: "https://example.test/case",
    content: "Built Python APIs with tests.", reviewStatus: "SOURCE", expectedVersion: 0 });
  const assessments = w.service.candidateAssessmentService;
  const request = () => {
    const read = assessments.getCandidate(candidate.id, { includeAssessmentContext: true, sourceIds: [source.id] });
    const report: CandidateAssessmentReport = {
      rubricVersion: "candidate-match-grades-v1", grade: "A", reason: "Relevant tested software experience",
      completeness: { fullJdReviewed: true, missingMaterials: [], limitations: ["Synthetic assessment, not a hiring prediction"] },
      requirements: [{ id: "software", requirement: "Build tested software", jdQuote: "Build tested software",
        importance: "REQUIRED", assessment: "MATCH", evidence: [{ kind: "BASE_RESUME", sourceId: null, quote: "Builds tested software." }],
        inference: "Relevant baseline experience" },
      { id: "python", requirement: "Python", jdQuote: "Python experience", importance: "PREFERRED", assessment: "PARTIAL",
        evidence: [{ kind: "LIBRARY_SOURCE", sourceId: source.id, quote: "Built Python APIs" }], inference: "Depth needs confirmation" }],
      strengths: [{ requirementId: "software", explanation: "Evidence of software delivery" }], gaps: [],
      questions: [{ requirementId: "python", explanation: "Confirm scope and scale" }],
      provenance: { assessor: "CHATGPT", reference: "Synthetic test conversation", generatedAt: "2026-09-11T00:00:00Z", model: null },
    };
    return { candidateId: candidate.id, expectedCandidateVersion: read.recordVersion,
      expectedAssessmentVersion: read.matchAssessment.recordVersion, inputManifest: read.assessmentContext!.inputManifest,
      report, supersedesAssessmentId: read.matchAssessment.id, correction: null as { kind: "USER_STATEMENT"; statement: string; reference: string } | null,
      userConfirmed: true, authorityReference: "User asked to assess and save", idempotencyKey: randomUUID() };
  };
  return { ...w, candidate, source, assessments, request };
}
function changes(w: ReturnType<typeof fixture>) { return w.database.prepare("SELECT total_changes() n").get(); }

it("persists exact evidence and immutable history across reopen, without candidate/application/task writes", () => {
  const w = fixture({ fileBacked: true }), input = w.request();
  const before = w.database.prepare("SELECT * FROM job_candidates").all();
  const result = w.assessments.record(input);
  expect(w.assessments.record(input)).toEqual({ ...result, replayed: true });
  expect(w.database.prepare("SELECT * FROM job_candidates").all()).toEqual(before);
  for (const table of ["projects", "tasks", "state_transitions", "resources", "candidate_decisions", "candidate_links"]) {
    expect(w.database.prepare(`SELECT COUNT(*) n FROM ${table}`).get()).toEqual({ n: 0 });
  }
  expect(() => w.database.prepare("UPDATE candidate_match_assessments SET report_json='{}'").run()).toThrow(/immutable/);
  expect(() => w.database.prepare("DELETE FROM candidate_match_assessments").run()).toThrow(/immutable/);
  w.database.close();
  const reopened = openDatabase(w.databasePath); cleanup.push(() => reopened.close());
  const service = new WorkspaceService(reopened, testPrincipal);
  const count = reopened.prepare("SELECT total_changes() n").get();
  const read = service.candidateAssessmentService.getCandidate(w.candidate.id, { assessmentVersion: 1 });
  expect(read.matchAssessment).toMatchObject({ grade: "A", status: "CURRENT", recordVersion: 1 });
  expect(read.assessment?.inputs.sources[0]?.content).toBe("Built Python APIs with tests.");
  expect(read.assessment?.report).toEqual(input.report);
  expect(read.assessment?.createdBy).toBe(w.identity.principalId);
  expect(read.assessmentContext).toBeNull();
  expect(service.candidateAssessmentService.listCandidates().items[0]?.matchAssessment).toEqual(read.matchAssessment);
  expect(reopened.prepare("SELECT total_changes() n").get()).toEqual(count);
});

it("rejects unconfirmed/web/foreign/forged identities and extra payload fields without writes", () => {
  const w = fixture(), input = w.request();
  const other = new WorkspaceService(w.database, { issuer: "other", subject: "other", workspaceName: "Other" });
  other.ensureDevelopmentIdentity();
  const web = new WorkspaceService(w.database, { ...w.identity, channel: "WEB", requestId: "verified-test" });
  const forged = new WorkspaceService(w.database, { ...w.identity, principalId: randomUUID(), channel: "MCP", requestId: "forged-test" });
  const before = changes(w);
  expect(() => w.assessments.record({ ...input, userConfirmed: false })).toThrow(/authority/);
  expect(() => web.candidateAssessmentService.record(input)).toThrow(/authority/);
  expect(() => forged.candidateAssessmentService.record(input)).toThrow(/mapped/);
  expect(() => other.candidateAssessmentService.getCandidate(w.candidate.id)).toThrow(/not found/);
  expect(() => other.candidateAssessmentService.record(input)).toThrow(/not found/);
  expect(() => w.assessments.record({ ...input, workspaceId: w.identity.workspaceId })).toThrow(/Invalid/);
  expect(changes(w)).toEqual(before);
});

it("rejects idempotency conflicts and concurrent candidate, assessment and input versions with zero writes", () => {
  const w = fixture(), first = w.request(), race = w.request();
  w.assessments.record(first);
  let before = changes(w);
  expect(() => w.assessments.record({ ...first, report: { ...first.report, grade: "B" } })).toThrow(/idempotency/);
  expect(() => w.assessments.record(race)).toThrow(/version changed/);
  expect(changes(w)).toEqual(before);
  const sourceRace = w.request();
  w.service.jobLibraryService.saveDescription(w.candidate.id, "Different full JD", w.candidate.sourceUrl!);
  before = changes(w);
  expect(() => w.assessments.record(sourceRace)).toThrow(/source versions changed/);
  expect(changes(w)).toEqual(before);
  expect(w.assessments.record(first)).toMatchObject({ replayed: true, recordVersion: 1 });
  expect(w.assessments.getCandidate(w.candidate.id).matchAssessment).toMatchObject({ status: "STALE", grade: null, previousGrade: "A", staleReasons: ["JD_CHANGED"] });
});

it.each(["jd", "base", "source", "directory", "identity"] as const)("marks %s changes stale while retaining the original inputs", kind => {
  const w = fixture(); w.assessments.record(w.request());
  if (kind === "jd") w.service.jobLibraryService.saveDescription(w.candidate.id, "Updated JD", w.candidate.sourceUrl!);
  if (kind === "base") w.service.resumeService.save({ expectedVersion: 1, content: { ...resumeFixture(), summary: "Changed experience" } });
  if (kind === "source") w.service.jobLibraryService.saveSource({ sourceKey: "example:case", title: "Case.docx", sourceUrl: "https://example.test/case", content: "Corrected experience", reviewStatus: "EXCLUDED", expectedVersion: 1 });
  if (kind === "directory") w.service.jobLibraryService.saveSource({ sourceKey: "correction", title: "Confirmed correction", sourceUrl: null, content: "Corrected employment date", reviewStatus: "CONFIRMED", expectedVersion: 0 });
  if (kind === "identity") w.database.prepare("UPDATE job_candidates SET role='Different role' WHERE id=?").run(w.candidate.id);
  const read = w.assessments.getCandidate(w.candidate.id, { assessmentVersion: 1 });
  expect(read.matchAssessment.status).toBe("STALE");
  expect(read.assessment?.inputs.jd?.text).toContain("Build tested software");
  expect(read.assessment?.inputs.baseResume?.recordVersion).toBe(1);
  expect(read.assessment?.inputs.sources[0]?.review_status).toBe("SOURCE");
});

it("candidate decisions do not invalidate evidence but block an outstanding stale command", () => {
  const w = fixture(); w.assessments.record(w.request()); const race = w.request();
  w.service.candidateService.decideCandidate({ candidateId: w.candidate.id, action: "SAVE", expectedRecordVersion: w.candidate.recordVersion, authority, idempotencyKey: randomUUID() });
  expect(w.assessments.getCandidate(w.candidate.id).matchAssessment.status).toBe("CURRENT");
  expect(() => w.assessments.record(race)).toThrow(/version changed/);
});

it("keeps missing inputs ungraded and does not certify JD completeness by text length", () => {
  const w = fixture({ materials: false }), input = w.request();
  expect(w.assessments.getCandidate(w.candidate.id).matchAssessment.status).toBe("MISSING_JD");
  expect(() => w.assessments.record(input)).toThrow(/grade requires/);
  input.report.grade = null; input.report.requirements = []; input.report.strengths = []; input.report.questions = [];
  input.report.completeness.fullJdReviewed = false;
  w.assessments.record(input);
  expect(w.assessments.getCandidate(w.candidate.id, { assessmentVersion: 1 }).assessment?.report.completeness.missingMaterials).toEqual(["JOB_DESCRIPTION", "BASE_RESUME"]);
  const complete = fixture(), request = complete.request();
  request.report.completeness.fullJdReviewed = false;
  expect(() => complete.assessments.record(request)).toThrow(/grade requires/);
  request.report.completeness.missingMaterials = [];
  request.inputManifest = complete.assessments.getCandidate(complete.candidate.id, {
    includeAssessmentContext: true, sourceIds: [complete.source.id, randomUUID()],
  }).assessmentContext!.inputManifest;
  expect(() => complete.assessments.record(request)).toThrow(/grade requires/);
  request.report.completeness.fullJdReviewed = true;
  request.report.completeness.missingMaterials = ["Employment scope needs source material"];
  expect(() => complete.assessments.record(request)).toThrow(/grade requires/);
});

it("rejects forged quotes, source IDs, duplicate requirements and orphan conclusions", () => {
  const w = fixture(), input = w.request(), before = changes(w);
  const altered = (change: (report: CandidateAssessmentReport) => void) => {
    const report = structuredClone(input.report); change(report);
    expect(() => w.assessments.record({ ...input, report })).toThrow();
  };
  altered(r => { r.requirements[0]!.jdQuote = "Invented requirement"; });
  altered(r => { r.requirements[0]!.evidence[0]!.quote = "summary"; });
  altered(r => { r.requirements[1]!.evidence[0]!.sourceId = randomUUID(); });
  altered(r => { r.requirements.push(r.requirements[0]!); });
  altered(r => { r.requirements[1]!.assessment = "UNKNOWN"; });
  altered(r => { r.strengths[0]!.requirementId = "missing"; });
  expect(changes(w)).toEqual(before);
});

it("includes confirmed corrections, marks unavailable selected sources and bounds context/directory/history", () => {
  const w = fixture();
  const correction = w.service.jobLibraryService.saveSource({ sourceKey: "correction", title: "User correction", sourceUrl: null, content: "Corrected date", reviewStatus: "CONFIRMED", expectedVersion: 0 });
  for (let i = 0; i < 52; i++) w.service.jobLibraryService.saveSource({ sourceKey: `case:${i}`, title: `Case ${i}.docx`, sourceUrl: null, content: `Distinct source ${i}`, reviewStatus: "SOURCE", expectedVersion: 0 });
  const context = w.assessments.getCandidate(w.candidate.id, { includeAssessmentContext: true }).assessmentContext!;
  expect(context.sources.map(s => s.id)).toEqual([correction.id]);
  expect(context.sourceDirectory).toMatchObject({ total: 54, nextOffset: 50 });
  expect(w.assessments.getCandidate(w.candidate.id, { includeAssessmentContext: true, sourceOffset: 50 }).assessmentContext?.sourceDirectory.items).toHaveLength(4);
  expect(w.assessments.getCandidate(w.candidate.id, { includeAssessmentContext: true, sourceIds: [randomUUID()] }).assessmentContext?.missingMaterials[0]).toMatch(/SOURCE_UNAVAILABLE/);
  expect(() => w.assessments.getCandidate(w.candidate.id, { sourceIds: [w.source.id] })).toThrow(/requires/);
  for (let i = 0; i < 12; i++) {
    const input = w.request();
    if (i === 1) input.correction = { kind: "USER_STATEMENT", statement: "Please retain the corrected date", reference: "Synthetic user statement" };
    w.assessments.record(input);
  }
  const read = w.assessments.getCandidate(w.candidate.id);
  expect(read.assessmentHistory).toMatchObject({ total: 12, nextBeforeVersion: 3 });
  expect(read.assessmentHistory.items).toHaveLength(10);
  expect(w.assessments.getCandidate(w.candidate.id, { historyBeforeVersion: 3 }).assessmentHistory.items.map(a => a.recordVersion)).toEqual([2, 1]);
  expect(w.assessments.getCandidate(w.candidate.id, { assessmentVersion: 2 }).assessment?.correction?.statement).toContain("corrected date");
  expect(() => w.assessments.getCandidate(w.candidate.id, { assessmentVersion: 13 })).toThrow(/not found/);
  const largeIds: string[] = [];
  for (let i = 0; i < 13; i++) largeIds.push(w.service.jobLibraryService.saveSource({ sourceKey: `large:${i}`, title: `Large ${i}.docx`, sourceUrl: null, content: `${i}${"X".repeat(49000)}`, reviewStatus: "SOURCE", expectedVersion: 0 }).id);
  expect(() => w.assessments.getCandidate(w.candidate.id, { includeAssessmentContext: true, sourceIds: largeIds })).toThrow(/exceeds limits/);
});

it("migrates retained data additively and allows repeat/current and previous-code startup", () => {
  const w = fixture(), old = join(w.directory, "migrations018"); mkdirSync(old);
  for (const file of readdirSync("db/migrations").filter(f => f.endsWith(".sql") && f < "019_")) copyFileSync(join("db/migrations", file), join(old, file));
  const before = join(w.directory, "before.db"), after = join(w.directory, "after.db");
  const baseline = openDatabase(before, old);
  const service = new WorkspaceService(baseline, testPrincipal); service.ensureDevelopmentIdentity();
  service.candidateService.recordCandidate({ provider: "seek", postingId: "retained", company: "Retained", role: "Engineer", title: "Engineer", authority, idempotencyKey: randomUUID() });
  baseline.close(); copyFileSync(before, after);
  openDatabase(after).close(); openDatabase(after).close(); openDatabase(after, old).close();
  expect(verifyCandidateAssessmentsMigration(before, after)).toMatchObject({ status: "PASS", addedTables: ["candidate_match_assessments"] });
});

it("discovers the MCP schema and supports context/save/replay/version read through a fresh client", async () => {
  const w = fixture(), server = createWorkspaceMcpServer(w.service);
  const client = new Client({ name: "assessment-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport); await client.connect(clientTransport);
    const tools = await client.listTools();
    expect(tools.tools.find(t => t.name === "workspace_record_candidate_match_assessment")?.annotations).toMatchObject({ readOnlyHint: false, idempotentHint: true });
    const read = await client.callTool({ name: "workspace_get_job_candidate", arguments: { candidateId: w.candidate.id, includeAssessmentContext: true, sourceIds: [w.source.id] } });
    expect(read.structuredContent).toMatchObject({ result: { assessmentContext: { contractVersion: "candidate-assessment-context-v1" } } });
    const input = w.request();
    expect((await client.callTool({ name: "workspace_record_candidate_match_assessment", arguments: { ...input, userConfirmed: false } })).isError).toBe(true);
    expect((await client.callTool({ name: "workspace_record_candidate_match_assessment", arguments: input })).structuredContent).toMatchObject({ result: { recordVersion: 1, replayed: false } });
    expect((await client.callTool({ name: "workspace_record_candidate_match_assessment", arguments: input })).structuredContent).toMatchObject({ result: { recordVersion: 1, replayed: true } });
  } finally { await client.close(); await server.close(); }
  const reopenedServer = createWorkspaceMcpServer(new WorkspaceService(w.database, testPrincipal));
  const second = new Client({ name: "assessment-next-conversation", version: "1" });
  const [c, s] = InMemoryTransport.createLinkedPair();
  try {
    await reopenedServer.connect(s); await second.connect(c);
    expect((await second.callTool({ name: "workspace_get_job_candidate", arguments: { candidateId: w.candidate.id, assessmentVersion: 1 } })).structuredContent)
      .toMatchObject({ result: { matchAssessment: { status: "CURRENT", grade: "A" }, assessment: { recordVersion: 1 } } });
    expect((await second.callTool({ name: "workspace_list_job_candidates", arguments: {} })).structuredContent)
      .toMatchObject({ result: { items: [{ matchAssessment: { grade: "A" } }] } });
  } finally { await second.close(); await reopenedServer.close(); }
});
