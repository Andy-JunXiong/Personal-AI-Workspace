import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { createTestWorkspace } from "../helpers/test-workspace.js";
import { applicationView } from "../../src/web/views.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import type { ApplicationResume } from "../../src/domain/application-resume.js";
import { IdempotencyConflictError } from "../../src/domain/errors.js";

const cleanups: (() => void)[] = [];
function setup() { const w = createTestWorkspace(); cleanups.push(w.cleanup); return w; }
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });
const candidate = (): ApplicationResume => ({
  contractVersion: "job-application-resume-v0.1", supersedesResourceId: null,
  sourceFacts: { fileId: "resumeFile", fileName: "Company resume <script>bad()</script>.pdf", mimeType: "application/pdf",
    modifiedTime: "2026-09-01T00:00:00Z", revisionId: "revision1", revisionModifiedTime: "2026-09-01T00:00:00Z" },
  interpretation: { status: "CANDIDATE", reason: "Company and role filename match; submission version unknown" }, confirmation: null,
});
function input(w: ReturnType<typeof setup>, facts = candidate()) {
  return { projectId: w.projectId, resourceType: "DOCUMENT" as const, provider: "google-drive-resume",
    externalId: randomUUID(), externalUri: "https://drive.google.com/file/d/resumeFile/view", title: "Resume candidate",
    observedAt: "2026-09-09T05:00:00Z", observedFacts: facts, idempotencyKey: randomUUID() };
}

it("keeps candidate discovery separate from submission, dossier and lifecycle, surviving bounded Resource history", () => {
  const w = setup(); const before = w.service.getProject(w.projectId);
  const request = input(w); const saved = w.service.recordObservation(request);
  expect(w.service.recordObservation(request)).toMatchObject({ replayed: true, resource: { id: saved.resource.id } });
  for (let n = 0; n < 12; n++) w.service.recordObservation({ ...input(w), provider: "chatgpt", resourceType: "NOTE",
    externalUri: null, observedFacts: { contractVersion: "job-application-profile-v0.1", jobDescription: "Saved JD", skillMatch: null } });
  const after = w.service.getProject(w.projectId);
  expect(after.project).toEqual(before.project); expect(after.transitions).toEqual(before.transitions);
  expect(after.openTasks).toEqual(before.openTasks);
  expect(after.resources).toHaveLength(10); expect(after.resumeAssociations).toHaveLength(1);
  const beforeRead = w.database.prepare("SELECT total_changes() n").get();
  const html = applicationView(w.service, w.projectId, {}, "Australia/Sydney");
  expect(html).toContain("候选简历 · 待确认是否投递"); expect(html).not.toContain("已确认实际投递版本");
  expect(html).toContain("申请资料清单");
  expect(html).toContain("1 / 4 已齐备");
  expect(html).toContain("已有候选，待确认投递版本");
  expect(html).toContain("Saved JD"); expect(html).toContain("&lt;script&gt;bad()"); expect(html).not.toContain("<script>bad()");
  expect(html).toContain("Drive 文件（当前内容）"); expect(html).toContain("revision1");
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(beforeRead);
});

it("requires confirmation evidence and a revision for a confirmed submitted version, with matching provider/file identity", () => {
  const w = setup(); const original = candidate();
  const confirmed = { ...original, interpretation: { ...original.interpretation, status: "CONFIRMED_VERSION" as const } };
  expect(() => w.service.recordObservation(input(w, confirmed))).toThrow();
  confirmed.confirmation = { kind: "USER_STATEMENT", reference: "User instruction 2026-09-09", statement: "This exact version was submitted" };
  expect(() => w.service.recordObservation(input(w, { ...confirmed, sourceFacts: { ...original.sourceFacts, revisionId: null } }))).toThrow();
  expect(() => w.service.recordObservation(input(w, { ...original, confirmation: confirmed.confirmation }))).toThrow();
  for (const uri of ["javascript:alert(1)", "https://evil.test/file/d/resumeFile/view", "https://drive.google.com/file/d/other/view"]) {
    expect(() => w.service.recordObservation({ ...input(w), externalUri: uri })).toThrow();
  }
  expect(() => w.service.recordObservation({ ...input(w), provider: "chatgpt" })).toThrow();
  expect(() => w.service.recordObservation({ ...input(w), resourceType: "NOTE" })).toThrow();
  const result = w.service.recordObservation(input(w, confirmed));
  expect(result.projectStateChanged).toBe(false);
  expect(applicationView(w.service, w.projectId, {}, "Australia/Sydney")).toContain("已确认实际投递版本");
});

it("retains confirmed versions across later discovery and guards corrections against stale reads", () => {
  const w = setup(); const first = w.service.recordObservation(input(w));
  const confirmed: ApplicationResume = { ...candidate(), supersedesResourceId: first.resource.id,
    interpretation: { status: "CONFIRMED_FILE", reason: "User identified the file, not a historical revision" },
    confirmation: { kind: "USER_STATEMENT", reference: "User message", statement: "I submitted this file" } };
  const second = w.service.recordObservation(input(w, confirmed));
  expect(() => w.service.recordObservation(input(w, confirmed))).toThrow("changed");
  expect(() => w.service.recordObservation(input(w, { ...candidate(), supersedesResourceId: second.resource.id }))).toThrow("downgrade");
  w.service.recordObservation(input(w, { ...candidate(), sourceFacts: { ...candidate().sourceFacts, revisionId: "revision2" } }));
  const associations = w.service.getProject(w.projectId).resumeAssociations;
  expect(associations).toHaveLength(2);
  expect(associations.find(r => r.facts.sourceFacts.revisionId === "revision1")?.facts.interpretation.status).toBe("CONFIRMED_FILE");
  const html = applicationView(w.service, w.projectId, {}, "Australia/Sydney");
  expect(html).toContain("已确认投递文件 · 具体版本待确认"); expect(html).not.toContain("已确认实际投递版本");
  w.service.recordObservation(input(w, { ...candidate(), supersedesResourceId: second.resource.id,
    interpretation: { status: "DISMISSED", reason: "User corrected the association" } }));
  expect(applicationView(w.service, w.projectId, {}, "Australia/Sydney")).not.toContain("已确认投递文件");
  expect(applicationView(w.service, w.projectId, { section: "resources" }, "Australia/Sydney")).toContain("历史记录");
});

it("isolates resume reads and writes by owning Workspace", () => {
  const w = setup(); w.service.recordObservation(input(w));
  const other = new WorkspaceService(w.database, { issuer: "test-suite", subject: "other-user", workspaceName: "Other" });
  other.ensureDevelopmentIdentity();
  expect(() => other.jobSearchQueryService.applicationResumes(w.projectId)).toThrow("not found");
  expect(() => other.recordObservation(input(w))).toThrow("not found");
});

it("rejects changed resume events instead of silently deduplicating a confirmation or correction", () => {
  const w = setup();
  const request = input(w);
  const first = w.service.recordObservation(request);
  const confirmation: ApplicationResume = { ...candidate(), supersedesResourceId: first.resource.id,
    interpretation: { status: "CONFIRMED_VERSION", reason: "User identified the submitted revision" },
    confirmation: { kind: "USER_STATEMENT", reference: "User message", statement: "I submitted revision1" } };
  const retryKey = randomUUID();
  const before = w.service.getProject(w.projectId);
  for (const changes of [
    { observedFacts: confirmation },
    { title: "Changed event title" },
    { observedAt: "2026-09-09T06:00:00Z" },
    { externalUri: "https://drive.google.com/open?id=resumeFile" },
    { observedFacts: { ...candidate(), sourceFacts: { ...candidate().sourceFacts, revisionId: "revision2" } } },
  ]) {
    expect(() => w.service.recordObservation({ ...request, ...changes, idempotencyKey: retryKey }))
      .toThrow(IdempotencyConflictError);
  }
  expect(w.service.getProject(w.projectId).resumeAssociations).toEqual(before.resumeAssociations);
  expect(w.service.getProject(w.projectId).totalCounts).toEqual(before.totalCounts);
  // A rejected conflict must not consume the retry key; identical event retries remain safe.
  expect(w.service.recordObservation({ ...request, idempotencyKey: retryKey })).toMatchObject({
    deduplicated: true, replayed: false, resource: { id: first.resource.id },
  });
  const saved = w.service.recordObservation(input(w, confirmation));
  expect(w.service.getProject(w.projectId).resumeAssociations).toMatchObject([
    { id: saved.resource.id, facts: { interpretation: { status: "CONFIRMED_VERSION" } } },
  ]);
  // Retrying the original event after correction returns its historical result, without reverting current state.
  expect(w.service.recordObservation({ ...request, idempotencyKey: randomUUID() })).toMatchObject({
    deduplicated: true, resource: { id: first.resource.id },
  });
  expect(w.service.getProject(w.projectId).resumeAssociations[0]?.id).toBe(saved.resource.id);
});
