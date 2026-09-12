import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { createEmptyTestWorkspace, testPrincipal } from "../helpers/test-workspace.js";
import { seedCandidateScreening } from "../helpers/candidate-screening-fixture.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { openDatabase } from "../../src/persistence/database.js";
import { canonicalHash } from "../../src/domain/canonical-json.js";

const cleanup: Array<() => void> = [];
afterEach(() => { for (const close of cleanup.splice(0).reverse()) close(); });
function fixture(fileBacked = false) {
  const w = createEmptyTestWorkspace({ fileBacked }); cleanup.push(w.cleanup);
  const c = w.service.candidateService.recordCandidate({ provider: "seek", postingId: randomUUID(), company: "Synthetic",
    title: "Synthetic developer", role: "Synthetic developer", sourceUrl: "https://example.test/job/" + randomUUID(),
    authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Synthetic job" }, idempotencyKey: randomUUID() }).candidate;
  const request = () => ({ candidateId: c.id, expectedCandidateVersion: 1, expectedJdHash: null as string | null,
    text: "Required: 10+ years of commercial software development experience.", sourceUrl: c.sourceUrl!,
    fullTextProvided: true, provenanceReference: "Synthetic complete posting read", userConfirmed: true,
    authorityReference: "Synthetic user requested JD saving", idempotencyKey: randomUUID() });
  return { ...w, c, request, record: w.service.candidateJobDescriptionService.record.bind(w.service.candidateJobDescriptionService) };
}

it("persists attributable JD receipts across replacement and reopen without changing candidate state", () => {
  const w = fixture(true), req = w.request();
  w.service.candidateService.decideCandidate({ candidateId: w.c.id, action: "DISMISS", expectedRecordVersion: 1,
    authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Synthetic dismissal" }, idempotencyKey: randomUUID() });
  req.expectedCandidateVersion = 2;
  const before = w.database.prepare("SELECT * FROM job_candidates").all();
  const first = w.record(req);
  expect(first).toMatchObject({ candidateVersion: 2, jdHash: canonicalHash(first.jd),
    attribution: { principalId: w.identity.principalId, channel: "MCP", provenanceReference: req.provenanceReference,
      authorityReference: req.authorityReference, fullTextProvided: true } });
  const second = w.record({ ...w.request(), expectedCandidateVersion: 2, expectedJdHash: first.jdHash, text: "Updated complete synthetic JD." });
  expect(second.jdHash).not.toBe(first.jdHash);
  w.database.close(); const db = openDatabase(w.databasePath); cleanup.push(() => db.close());
  const service = new WorkspaceService(db, testPrincipal);
  expect(service.candidateJobDescriptionService.record(req)).toEqual({ ...first, replayed: true });
  const read = service.candidateAssessmentService.getCandidate(w.c.id, { includeAssessmentContext: true });
  expect(read).toMatchObject({ recordVersion: 2, decision: "DISMISSED", assessmentContext: {
    jd: second.jd, inputManifest: { jdHash: second.jdHash } } });
  expect(db.prepare("SELECT * FROM job_candidates").all()).toEqual(before);
  for (const table of ["projects", "tasks", "candidate_links", "candidate_match_assessments", "candidate_screenings", "candidate_screening_overrides", "job_library_sources"]) {
    expect(db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
  }
});

it("rejects stale candidate/JD inputs, conflicting retries, invalid URLs and incomplete or unauthorised writes", () => {
  const w = fixture(), req = w.request(), saved = w.record(req);
  const web = new WorkspaceService(w.database, { ...w.identity, channel: "WEB", requestId: "web" });
  const forged = new WorkspaceService(w.database, { ...w.identity, principalId: randomUUID(), channel: "MCP", requestId: "forged" });
  const before = w.database.prepare("SELECT total_changes() n").get();
  expect(() => w.record(w.request())).toThrow(/changed/);
  expect(() => w.record({ ...w.request(), expectedJdHash: saved.jdHash, expectedCandidateVersion: 2 })).toThrow(/changed/);
  expect(() => w.record({ ...req, text: "Different payload" })).toThrow(/idempotency conflict/);
  for (const patch of [{ userConfirmed: false }, { fullTextProvided: false }]) {
    expect(() => w.record({ ...w.request(), ...patch })).toThrow(/authority/);
  }
  for (const patch of [{ sourceUrl: "file:///private/file" }, { text: " " }, { text: "x".repeat(50001) }, { decision: "SAVED" }]) {
    expect(() => w.record({ ...w.request(), ...patch })).toThrow(/Invalid/);
  }
  expect(() => web.candidateJobDescriptionService.record(req)).toThrow(/authority/);
  expect(() => forged.candidateJobDescriptionService.record(req)).toThrow(/mapped/);
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
});

it("isolates candidate ownership and receipts across workspaces", () => {
  const w = fixture(), req = w.request(); w.record(req);
  const other = new WorkspaceService(w.database, { issuer: "other", subject: "other", workspaceName: "Other" });
  other.ensureDevelopmentIdentity();
  const before = w.database.prepare("SELECT total_changes() n").get();
  expect(() => other.candidateJobDescriptionService.record(req)).toThrow();
  expect(() => w.record({ ...w.request(), candidateId: randomUUID() })).toThrow();
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
});

it("detects prior library-writer changes, including URL-only updates, using the current manifest hash", () => {
  const w = fixture(), first = w.record(w.request());
  w.service.jobLibraryService.saveDescription(w.c.id, first.jd.text, "https://example.test/revised-source");
  expect(() => w.record({ ...w.request(), expectedJdHash: first.jdHash })).toThrow(/changed/);
  const context = w.service.candidateAssessmentService.getCandidate(w.c.id, { includeAssessmentContext: true }).assessmentContext!;
  expect(context.inputManifest.jdHash).not.toBe(first.jdHash);
  const saved = w.record({ ...w.request(), expectedJdHash: context.inputManifest.jdHash });
  expect(saved.jdHash).toBe(first.jdHash);
});

it("invalidates screening on JD replacement, retains historical inputs and preserves KEEP", () => {
  const w = fixture(), f = seedCandidateScreening(w.service), stale = f.request();
  w.service.candidateScreeningService.record(stale);
  w.service.candidateScreeningService.setOverride(f.override());
  const read = w.service.candidateAssessmentService.getCandidate(f.candidate.id, { includeAssessmentContext: true });
  w.record({ ...w.request(), candidateId: f.candidate.id, expectedJdHash: read.assessmentContext!.inputManifest.jdHash,
    sourceUrl: f.candidate.sourceUrl!, text: "A revised complete JD with no commercial tenure requirement." });
  expect(w.service.candidateScreeningService.get(f.candidate.id).summary).toMatchObject({ status: "STALE", hidden: false, overrideMode: "KEEP" });
  expect(w.service.candidateScreeningService.get(f.candidate.id, { version: 1 }).record?.inputs.jd)
    .toEqual(read.assessmentContext!.jd);
  expect(() => w.service.candidateScreeningService.record({ ...stale, expectedScreeningVersion: 1, idempotencyKey: randomUUID() })).toThrow(/changed|stale/i);
});

it("rolls back initial and replacement JD writes if durable receipt storage fails", () => {
  const w = fixture();
  w.database.exec("CREATE TRIGGER reject_jd_receipt BEFORE INSERT ON idempotency_records WHEN NEW.operation='workspace_record_candidate_job_description' BEGIN SELECT RAISE(ABORT,'receipt unavailable'); END");
  expect(() => w.record(w.request())).toThrow(/receipt unavailable/);
  expect(w.service.jobLibraryService.description(w.c.id)).toBeUndefined();
  w.service.jobLibraryService.saveDescription(w.c.id, "Existing JD", w.c.sourceUrl!);
  const before = w.service.jobLibraryService.description(w.c.id)!;
  expect(() => w.record({ ...w.request(), expectedJdHash: canonicalHash({ text: before.jd_text, sourceUrl: before.source_url }) })).toThrow(/receipt unavailable/);
  expect(w.service.jobLibraryService.description(w.c.id)).toEqual(before);
});
