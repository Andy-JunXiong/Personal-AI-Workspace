import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createEmptyTestWorkspace, testPrincipal } from "../helpers/test-workspace.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { createWorkspaceMcpServer } from "../../src/mcp/create-server.js";
import { openDatabase } from "../../src/persistence/database.js";
import { canonicalHash } from "../../src/domain/canonical-json.js";

const cleanup: Array<() => void> = [];
afterEach(() => { for (const close of cleanup.splice(0).reverse()) close(); });
function fixture(fileBacked = false) {
  const w = createEmptyTestWorkspace({ fileBacked }); cleanup.push(w.cleanup); return w;
}
const content = "Commercial SWE tenure is UNKNOWN. I exclude required commercial software engineering tenure of at least eight years as a preference, not evidence of inability.";
const request = () => ({ content, expectedProfileVersion: 0, userConfirmed: true,
  authorityReference: "Synthetic user confirmed these exact facts and preferences", idempotencyKey: randomUUID() });
function candidate(w: ReturnType<typeof fixture>, years: number, saveJd = true) {
  const c = w.service.candidateService.recordCandidate({ provider: "seek", postingId: randomUUID(), company: "Synthetic",
    title: "Synthetic developer", role: "Synthetic developer", sourceUrl: "https://example.test/job/" + randomUUID(),
    authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Synthetic job" }, idempotencyKey: randomUUID() }).candidate;
  if (saveJd) w.service.jobLibraryService.saveDescription(c.id, `Required: ${years} years of commercial software development.`, c.sourceUrl!);
  return c;
}
async function client(service: WorkspaceService) {
  const server = createWorkspaceMcpServer(service), c = new Client({ name: "profile-e2e", version: "1" });
  const [a,b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await c.connect(a);
  return { c, close: async () => { await c.close(); await server.close(); } };
}

it("completes MCP JD ingestion and confirmation to UNKNOWN screening and FILTER to KEEP without seeded JDs or confirmed sources", async () => {
  const w = fixture(), five = candidate(w, 5, false), eight = candidate(w, 8, false);
  w.service.candidateService.decideCandidate({ candidateId: five.id, action: "DISMISS", expectedRecordVersion: 1,
    authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Synthetic existing dismissal" }, idempotencyKey: randomUUID() });
  expect(w.service.jobLibraryService.sources()).toHaveLength(0);
  const first = await client(w.service);
  let profileId = "";
  try {
    for (const [c, years] of [[five, 5], [eight, 8]] as const) {
      const before = w.service.candidateAssessmentService.getCandidate(c.id, { includeAssessmentContext: true });
      expect(before.matchAssessment.status).toBe("MISSING_JD");
      expect(before.assessmentContext!.inputManifest.jdHash).toBeNull();
      const savedJd = await first.c.callTool({ name: "workspace_record_candidate_job_description", arguments: {
        candidateId: c.id, expectedCandidateVersion: before.recordVersion, expectedJdHash: null,
        text: `Required: ${years} years of commercial software development.`, sourceUrl: c.sourceUrl!,
        fullTextProvided: true, provenanceReference: "Complete synthetic posting", userConfirmed: true,
        authorityReference: "Synthetic user requested JD ingestion and screening", idempotencyKey: randomUUID(),
      } });
      expect(savedJd.isError, JSON.stringify(savedJd)).not.toBe(true);
      const jdReceipt = (savedJd.structuredContent as { result: { jdHash: string } }).result;
      const after = w.service.candidateAssessmentService.getCandidate(c.id, { includeAssessmentContext: true });
      expect(after.assessmentContext!.inputManifest.jdHash).toBe(jdReceipt.jdHash);
      expect(after.recordVersion).toBe(before.recordVersion);
    }
    const result = await first.c.callTool({ name: "workspace_record_screening_profile", arguments: request() });
    expect(result.isError).not.toBe(true);
    const receipt = (result.structuredContent as { result: { sourceId: string; hash: string } }).result;
    profileId = receipt.sourceId;
    const read = w.service.candidateAssessmentService.getCandidate(five.id, { includeAssessmentContext: true, sourceIds: [profileId] });
    expect(read.assessmentContext!.sourceDirectory.items).toContainEqual(expect.objectContaining({ id: profileId,
      sourceKey: "screening:confirmed-profile", recordVersion: 1, reviewStatus: "CONFIRMED" }));
    expect(read.assessmentContext!.inputManifest.sources).toContainEqual({ id: profileId, recordVersion: 1, hash: receipt.hash });
  } finally { await first.close(); }
  const second = await client(w.service);
  try {
    for (const [c, years, decision] of [[five, 5, "USER_CONFIRMATION_REQUIRED"], [eight, 8, "FILTER"]] as const) {
      const contextResult = await second.c.callTool({ name: "workspace_get_job_candidate", arguments: { candidateId: c.id, includeAssessmentContext: true, sourceIds: [profileId] } });
      expect(contextResult.isError).not.toBe(true);
      const read = (contextResult.structuredContent as { result: ReturnType<typeof w.service.candidateAssessmentService.getCandidate> }).result;
      const saved = await second.c.callTool({ name: "workspace_record_candidate_screening", arguments: {
        candidateId: c.id, expectedCandidateVersion: read.recordVersion, expectedScreeningVersion: 0,
        profileSourceId: profileId, inputManifest: read.assessmentContext!.inputManifest,
        input: { profileVersion: 1, fullJdReviewed: true, experience: [], tenureExclusions: [{ category: "SOFTWARE_ENGINEERING", minimumYears: 8,
          evidence: { statement: content, reference: profileId } }], requirements: [{ id: "tenure", jdQuote: `Required: ${years} years of commercial software development.`,
          importance: "REQUIRED", interpretation: "Explicit commercial development requirement", alternatives: [{ kind: "EXPERIENCE", category: "SOFTWARE_ENGINEERING", minimumYears: years }] }] },
        reason: "Synthetic evidence-based screening", provenanceReference: "Synthetic test", userConfirmed: true,
        authorityReference: "Synthetic confirmed screening request", idempotencyKey: randomUUID(),
      } });
      expect(saved.isError, JSON.stringify(saved)).not.toBe(true);
      const result = await second.c.callTool({ name: "workspace_get_candidate_screening", arguments: { candidateId: c.id } });
      expect(result.structuredContent).toMatchObject({ result: { summary: { recordVersion: 1, decision } } });
    }
    const keep = await second.c.callTool({ name: "workspace_override_candidate_screening", arguments: { candidateId: eight.id,
      expectedCandidateVersion: 1, expectedScreeningVersion: 1, expectedOverrideVersion: 0, mode: "KEEP", reason: "Synthetic explicit keep",
      userConfirmed: true, authorityReference: "Synthetic keep request", idempotencyKey: randomUUID() } });
    expect(keep.isError).not.toBe(true);
    expect(w.service.candidateScreeningService.get(eight.id).summary).toMatchObject({ hidden: false, overrideMode: "KEEP" });
    expect(w.service.candidateAssessmentService.listCandidates().items.map(c => c.id)).toContain(eight.id);
    expect(w.service.jobSearchQueryService.getCandidate(five.id)).toMatchObject({ decision: "DISMISSED", recordVersion: 2 });
    for (const table of ["projects", "tasks", "candidate_links", "candidate_match_assessments"]) {
      expect(w.database.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
    }
    w.service.screeningProfileService.record({ ...request(), expectedProfileVersion: 1, content: content + " Updated confirmed preference." });
    expect(w.service.candidateScreeningService.get(eight.id).summary).toMatchObject({ status: "STALE", hidden: false, overrideMode: "KEEP" });
    expect(w.service.candidateScreeningService.get(five.id, { version: 1 }).record?.inputs).toMatchObject({
      sources: [expect.objectContaining({ content, record_version: 1 })],
    });
  } finally { await second.close(); }
});

it("persists source, confirmation attribution and historical retry receipt across update and reopen", () => {
  const w = fixture(true), req = request(), first = w.service.screeningProfileService.record(req);
  expect(first).toMatchObject({ recordVersion: 1, reviewStatus: "CONFIRMED", hash: canonicalHash(first.source),
    confirmation: { principalId: w.identity.principalId, authorityReference: req.authorityReference, channel: "MCP" } });
  const updated = w.service.screeningProfileService.record({ ...request(), expectedProfileVersion: 1, content: content + " Revised preference." });
  expect(updated).toMatchObject({ sourceId: first.sourceId, recordVersion: 2 });
  w.database.close(); const db = openDatabase(w.databasePath); cleanup.push(() => db.close());
  const service = new WorkspaceService(db, testPrincipal);
  expect(service.screeningProfileService.record(req)).toEqual({ ...first, replayed: true });
  expect(service.jobLibraryService.sources()[0]?.record_version).toBe(2);
  expect(service.jobLibraryService.sources()[0]?.content).toBe(updated.source.content);
});

it("rejects stale versions, changed retry payload, arbitrary source confirmation and unauthorised identities without writes", () => {
  const w = fixture(), req = request(); w.service.screeningProfileService.record(req);
  const web = new WorkspaceService(w.database, { ...w.identity, channel: "WEB", requestId: "web" });
  const forged = new WorkspaceService(w.database, { ...w.identity, principalId: randomUUID(), channel: "MCP", requestId: "forged" });
  const before = w.database.prepare("SELECT total_changes() n").get();
  expect(() => w.service.screeningProfileService.record(request())).toThrow(/version changed/);
  expect(() => w.service.screeningProfileService.record({ ...req, content: "Changed" })).toThrow(/idempotency conflict/);
  expect(() => w.service.screeningProfileService.record({ ...request(), sourceId: randomUUID() })).toThrow(/Invalid/);
  expect(() => w.service.screeningProfileService.record({ ...request(), userConfirmed: false })).toThrow(/confirmation/);
  expect(() => web.screeningProfileService.record(request())).toThrow(/confirmation/);
  expect(() => forged.screeningProfileService.record(request())).toThrow(/mapped/);
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
});

it("isolates dedicated profiles by workspace and leaves unrelated confirmed facts untouched", () => {
  const w = fixture();
  w.service.jobLibraryService.saveSource({ sourceKey: "correction", title: "Existing fact", content: "Synthetic employment date correction",
    sourceUrl: null, reviewStatus: "CONFIRMED", expectedVersion: 0 });
  const before = w.service.jobLibraryService.sources()[0];
  const first = w.service.screeningProfileService.record(request());
  const other = new WorkspaceService(w.database, { issuer: "other", subject: "other", workspaceName: "Other" }); other.ensureDevelopmentIdentity();
  const second = other.screeningProfileService.record(request());
  expect(second.sourceId).not.toBe(first.sourceId);
  expect(other.jobLibraryService.sources()).toHaveLength(1);
  expect(w.service.jobLibraryService.sources().find(s => s.source_key === "correction")).toEqual(before);
});

it("refreshes manifests and includes the new confirmed profile without explicit source selection", () => {
  const w = fixture(), c = candidate(w, 5);
  const before = w.service.candidateAssessmentService.getCandidate(c.id, { includeAssessmentContext: true }).assessmentContext!.inputManifest;
  const saved = w.service.screeningProfileService.record(request());
  const after = w.service.candidateAssessmentService.getCandidate(c.id, { includeAssessmentContext: true }).assessmentContext!;
  expect(after.inputManifest.libraryHash).not.toBe(before.libraryHash);
  expect(after.sources).toContainEqual(saved.source);
  expect(after.inputManifest.selectedSourceIds).toContain(saved.sourceId);
});

it("rolls back a profile write if its durable confirmation receipt cannot be stored", () => {
  const w = fixture();
  w.database.exec("CREATE TRIGGER reject_profile_receipt BEFORE INSERT ON idempotency_records WHEN NEW.operation='workspace_record_screening_profile' BEGIN SELECT RAISE(ABORT,'receipt unavailable'); END");
  expect(() => w.service.screeningProfileService.record(request())).toThrow(/receipt unavailable/);
  expect(w.service.jobLibraryService.sources()).toHaveLength(0);
});
