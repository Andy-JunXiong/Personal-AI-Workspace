import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createEmptyTestWorkspace, testPrincipal } from "../helpers/test-workspace.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { createWorkspaceMcpServer } from "../../src/mcp/create-server.js";
import { canonicalHash } from "../../src/domain/canonical-json.js";
import type { SkillCatalog } from "../../src/domain/skill-library.js";
import { githubRefreshSchema } from "../../src/domain/skill-library.js";
import { skillLibraryPanel } from "../../src/web/skill-library-view.js";
import { candidateAssessmentPanel } from "../../src/web/candidate-assessment-view.js";
import type { CandidateAssessmentReport } from "../../src/domain/candidate-match-assessment.js";
import { openDatabase } from "../../src/persistence/database.js";

const cleanup: Array<() => void> = [];
afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); });
const authority = () => ({ userConfirmed: true, authorityReference: "Synthetic user authorized skill-library update", idempotencyKey: randomUUID() });
function fixture(fileBacked = false) {
  const w = createEmptyTestWorkspace({ fileBacked }); cleanup.push(w.cleanup);
  const imported = w.service.skillLibraryService.importSource({ ...authority(), sourceKey: "import:drive:one",
    title: "Uploaded resume", content: "Built Python APIs with automated tests.", sourceUrl: "https://drive.google.com/file/d/one/view", expectedVersion: 0 }) as any;
  const source = imported.source;
  const catalog: SkillCatalog = { format: "skill-library-v1", reviewedSources: [{ sourceId: source.id, recordVersion: source.record_version, hash: canonicalHash(source) }], skills: [{ id: "python", name: "Python", aliases: ["Python API"],
    category: "TECHNICAL", summary: "Python APIs with automated tests", status: "SUPPORTED", projectIds: ["api-project"],
    evidence: [{ sourceId: source.id, recordVersion: source.record_version, hash: canonicalHash(source), quote: source.content }] }],
    projects: [{ id: "api-project", name: "API project", contribution: "Built APIs; commercial tenure UNKNOWN", repositorySourceId: null,
      evidence: [{ sourceId: source.id, recordVersion: source.record_version, hash: canonicalHash(source), quote: source.content }] }], limitations: ["Commercial SWE tenure UNKNOWN"] };
  const request = () => ({ ...authority(), expectedVersion: w.service.skillLibraryService.read().version, catalog: structuredClone(catalog) });
  return { ...w, source, catalog, request };
}
const sha1 = "a".repeat(40), sha2 = "b".repeat(40);
const repoRequest = (expectedVersion = 0) => ({ ...authority(), repositoryUrl: "https://github.com/example/project", paths: ["README.md"], expectedVersion });
function github(commit: string, file = "Python API with tests") {
  return vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify(String(url).endsWith("/commits/HEAD") ? { sha: commit } :
    { type: "file", encoding: "base64", size: Buffer.byteLength(file), content: Buffer.from(file).toString("base64") }), { status: 200 })) as unknown as typeof fetch;
}

it("persists a sourced catalog and historical idempotency receipts across reopen", () => {
  const w = fixture(true), request = w.request();
  const saved = w.service.skillLibraryService.record(request) as any;
  expect(w.service.skillLibraryService.read()).toMatchObject({ version: 1, status: "CURRENT", catalog: w.catalog });
  const next = w.request(); next.catalog.skills[0]!.summary = "Updated synthesis of Python APIs";
  w.service.skillLibraryService.record(next);
  expect(w.service.skillLibraryService.record(request)).toEqual({ ...saved, replayed: true });
  expect(w.service.skillLibraryService.read().version).toBe(2);
  w.database.close();
  const reopened = openDatabase(w.databasePath); cleanup.push(() => reopened.close());
  const service = new WorkspaceService(reopened, testPrincipal);
  expect(service.skillLibraryService.read().version).toBe(2);
  expect(service.skillLibraryService.record(request)).toEqual({ ...saved, replayed: true });
});

it("rejects forged/stale references, duplicate skills, absent projects and missing authority with zero writes", () => {
  const w = fixture(), before = w.database.prepare("SELECT total_changes() n").get();
  for (const mutate of [
    (v: ReturnType<typeof w.request>) => { v.catalog.skills[0]!.evidence[0]!.quote = "invented"; },
    (v: ReturnType<typeof w.request>) => { v.catalog.skills[0]!.evidence[0]!.hash = "f".repeat(64); },
    (v: ReturnType<typeof w.request>) => { v.catalog.skills.push(structuredClone(v.catalog.skills[0]!)); },
    (v: ReturnType<typeof w.request>) => { v.catalog.skills[0]!.projectIds = ["missing"]; },
    (v: ReturnType<typeof w.request>) => { v.userConfirmed = false; },
  ]) { const input = w.request(); mutate(input); expect(() => w.service.skillLibraryService.record(input)).toThrow(); }
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
  expect(() => w.service.jobLibraryService.saveSource({ sourceKey: "skills:catalog", title: "Bypass", content: "{}", sourceUrl: null, expectedVersion: 0, reviewStatus: "CONFIRMED" })).toThrow(/managed/);
});

it("rolls back a catalog save if its durable receipt cannot be committed", () => {
  const w = fixture();
  w.database.exec("CREATE TRIGGER fail_skill_receipt BEFORE INSERT ON idempotency_records WHEN NEW.operation='skills.catalog.record' BEGIN SELECT RAISE(ABORT,'forced'); END");
  expect(() => w.service.skillLibraryService.record(w.request())).toThrow(/forced/);
  expect(w.service.skillLibraryService.read().version).toBe(0);
});

it("marks source replacements stale without changing the saved skill synthesis", () => {
  const w = fixture(); w.service.skillLibraryService.record(w.request());
  w.service.skillLibraryService.importSource({ ...authority(), sourceKey: "import:drive:one", title: "Updated resume", sourceUrl: null,
    content: "New evidence without the old statement", expectedVersion: 1 });
  expect(w.service.skillLibraryService.read()).toMatchObject({ status: "STALE", staleSkillIds: ["python"], catalog: w.catalog });
});

it("requires coverage of new sources and isolates catalog writes by workspace", () => {
  const w = fixture(); w.service.skillLibraryService.record(w.request());
  w.service.skillLibraryService.importSource({ ...authority(), sourceKey: "import:drive:two", title: "New project", sourceUrl: null,
    content: "Added SQL experience", expectedVersion: 0 });
  expect(w.service.skillLibraryService.read().status).toBe("STALE");
  expect(() => w.service.skillLibraryService.record(w.request())).toThrow(/coverage/);
  const other = new WorkspaceService(w.database, { ...testPrincipal, subject: "another-user", workspaceName: "Other" });
  other.ensureDevelopmentIdentity();
  expect(other.skillLibraryService.read()).toMatchObject({ status: "MISSING", sources: [], version: 0 });
  expect(other.skillLibraryService.read({ sourceIds: [w.source.id] }).unavailableSourceIds).toEqual([w.source.id]);
  expect(() => other.skillLibraryService.record({ ...w.request(), expectedVersion: 0 })).toThrow();
});

it("binds GitHub code quotes to the captured source, not serialized metadata", async () => {
  const w = fixture();
  const refresh = await w.service.skillLibraryService.refreshGithub(repoRequest(), undefined, github(sha1, "def api():\n    return 'ok'")) as any;
  const repo = w.service.jobLibraryService.sources().find(s => s.id === refresh.sourceId)!;
  const input = w.request();
  input.catalog.reviewedSources.push({ sourceId: repo.id, recordVersion: repo.record_version, hash: canonicalHash(repo) });
  input.catalog.skills[0]!.evidence.push({ sourceId: repo.id, recordVersion: repo.record_version, hash: canonicalHash(repo), quote: "def api():\n    return 'ok'" });
  expect(() => w.service.skillLibraryService.record(input)).not.toThrow();
  const invalid = w.request(); invalid.catalog = structuredClone(input.catalog); invalid.catalog.skills[0]!.evidence[1]!.quote = "github-project-v1";
  expect(() => w.service.skillLibraryService.record(invalid)).toThrow(/exact source quote/);
});

it("checks HEAD on new runs, reuses unchanged evidence, pins new files and records failures", async () => {
  const w = fixture(), first = repoRequest(), fetcher = github(sha1);
  const saved = await w.service.skillLibraryService.refreshGithub(first, undefined, fetcher) as any;
  expect(saved).toMatchObject({ status: "UPDATED", recordVersion: 1, commit: sha1 });
  expect(vi.mocked(fetcher).mock.calls[1]![0]).toContain(`?ref=${sha1}`);
  const hashBefore = w.service.jobLibraryService.snapshot().hash;
  const unchanged = github(sha1);
  expect(await w.service.skillLibraryService.refreshGithub(repoRequest(1), undefined, unchanged)).toMatchObject({ status: "UNCHANGED", recordVersion: 1 });
  expect(unchanged).toHaveBeenCalledTimes(1);
  expect(w.service.jobLibraryService.snapshot().hash).toBe(hashBefore);
  expect(await w.service.skillLibraryService.refreshGithub(repoRequest(1), undefined, github(sha2))).toMatchObject({ status: "UPDATED", recordVersion: 2 });
  const fail = vi.fn(async () => new Response("", { status: 403 })) as unknown as typeof fetch;
  expect(await w.service.skillLibraryService.refreshGithub(repoRequest(2), undefined, fail)).toMatchObject({ status: "FAILED", recordVersion: 2, commit: sha2 });
  expect(w.service.skillLibraryService.read().githubProjects[0]).toMatchObject({ lastCheck: { status: "FAILED" }, commit: sha2 });
  expect(await w.service.skillLibraryService.refreshGithub(first, undefined, fail)).toEqual({ ...saved, replayed: true });
  expect(fail).toHaveBeenCalledTimes(1);
});

it("rejects unsafe repositories and paths before network access, and rejects nontext or redirect responses", async () => {
  const w = fixture();
  for (const repositoryUrl of ["http://github.com/example/project", "https://github.com.evil.test/a/b", "https://user:pass@github.com/a/b", "https://127.0.0.1/a/b"]) {
    expect(githubRefreshSchema.safeParse({ ...repoRequest(), repositoryUrl }).success).toBe(false);
  }
  for (const path of ["../secret", "/etc/passwd", "a/../b", "a\\b"]) expect(githubRefreshSchema.safeParse({ ...repoRequest(), paths: [path] }).success).toBe(false);
  const redirect = vi.fn(async () => new Response("", { status: 302, headers: { location: "http://127.0.0.1/" } })) as unknown as typeof fetch;
  expect(await w.service.skillLibraryService.refreshGithub(repoRequest(), undefined, redirect)).toMatchObject({ status: "FAILED", sourceId: null });
  expect(vi.mocked(redirect).mock.calls[0]![1]).toMatchObject({ redirect: "error" });
  expect(await w.service.skillLibraryService.refreshGithub(repoRequest(), undefined, github(sha1, "binary\0data"))).toMatchObject({ status: "FAILED" });
});

it("checks authority after network work and detects overlapping source writes", async () => {
  const w = fixture();
  await expect(w.service.skillLibraryService.refreshGithub(repoRequest(), () => { throw new Error("session revoked"); }, github(sha1))).rejects.toThrow(/revoked/);
  expect(w.service.skillLibraryService.read().githubProjects).toHaveLength(0);
  const input = repoRequest();
  const delayed = github(sha2);
  await expect(w.service.skillLibraryService.refreshGithub(input, () => {
    w.service.jobLibraryService.saveSource({ sourceKey: "github:example/project", title: "Concurrent", content: "{}", sourceUrl: input.repositoryUrl, reviewStatus: "SOURCE", expectedVersion: 0 }, true);
  }, delayed)).rejects.toThrow(/changed during refresh/);
});

it("matches JD requirements through skills without requiring a base resume, and retains history after evidence changes", () => {
  const w = fixture(); w.service.skillLibraryService.record(w.request());
  const candidate = w.service.candidateService.recordCandidate({ provider: "seek", postingId: "skill-test", company: "Example", title: "Python Engineer", role: "Python Engineer",
    authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Synthetic" }, idempotencyKey: randomUUID() }).candidate;
  w.service.jobLibraryService.saveDescription(candidate.id, "Build Python APIs", "https://example.test/job");
  const read = w.service.candidateAssessmentService.getCandidate(candidate.id, { includeAssessmentContext: true });
  expect(read.assessmentContext?.missingMaterials).toEqual([]);
  const report: CandidateAssessmentReport = { rubricVersion: "candidate-match-grades-v1", grade: "A", reason: "Python evidence",
    completeness: { fullJdReviewed: true, missingMaterials: [], limitations: [] }, requirements: [{ id: "python", requirement: "Build Python APIs", jdQuote: "Build Python APIs",
      importance: "REQUIRED", assessment: "MATCH", evidence: [{ kind: "SKILL", skillId: "python", sourceId: read.assessmentContext!.skillLibrary.source!.id, quote: w.catalog.skills[0]!.summary }], inference: "Specific project evidence" }],
    strengths: [], gaps: [], questions: [], provenance: { assessor: "CHATGPT", reference: "Synthetic", generatedAt: new Date().toISOString(), model: null } };
  const request = { ...authority(), candidateId: candidate.id, expectedCandidateVersion: 1, expectedAssessmentVersion: 0,
    inputManifest: read.assessmentContext!.inputManifest, report, supersedesAssessmentId: null, correction: null };
  const invalid = structuredClone(request); invalid.report.requirements[0]!.evidence[0]!.skillId = "invented";
  expect(() => w.service.candidateAssessmentService.record(invalid)).toThrow(/Skill evidence/);
  const direct = structuredClone(request); direct.report.requirements[0]!.evidence = [{ kind: "LIBRARY_SOURCE", sourceId: w.source.id, quote: w.source.content }];
  expect(() => w.service.candidateAssessmentService.record(direct)).toThrow(/rather than a resume/);
  w.service.candidateAssessmentService.record(request);
  const detail = w.service.candidateAssessmentService.getCandidate(candidate.id, { assessmentVersion: 1 });
  expect(candidateAssessmentPanel(detail, "Australia/Sydney")).toContain("API project");
  expect(candidateAssessmentPanel(detail, "Australia/Sydney")).toContain("技能的原始依据");
  w.service.skillLibraryService.importSource({ ...authority(), sourceKey: "import:drive:one", title: "Updated", content: "Different evidence", sourceUrl: null, expectedVersion: 1 });
  const after = w.service.candidateAssessmentService.getCandidate(candidate.id, { assessmentVersion: 1, includeAssessmentContext: true });
  expect(after.matchAssessment.status).toBe("STALE");
  expect(after.assessmentContext?.missingMaterials).toContain("SKILL_LIBRARY_STALE");
  expect(after.assessment?.inputs.skillLibrary.catalog).toEqual(w.catalog);
  expect(after.decision).toBe("UNREVIEWED"); expect(after.recordVersion).toBe(1);
});

it("exposes actual MCP schemas and saves through the tool without confirming facts", async () => {
  const w = fixture(), server = createWorkspaceMcpServer(w.service), client = new Client({ name: "skills-test", version: "1" });
  const [a,b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  cleanup.push(() => { void client.close(); void server.close(); });
  const input = w.request();
  const saved = await client.callTool({ name: "workspace_record_skill_library", arguments: input });
  expect(saved.isError).not.toBe(true);
  const result = await client.callTool({ name: "workspace_get_skill_library", arguments: { sourceIds: [w.source.id] } });
  expect(result.isError).not.toBe(true);
  expect(w.service.skillLibraryService.read().source?.review_status).toBe("SOURCE");
  expect(skillLibraryPanel(w.service)).toContain("复制汇总指令");
  expect(skillLibraryPanel(w.service)).toContain("API project");
});
