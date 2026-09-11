import { randomUUID } from "node:crypto";
import type { WorkspaceService } from "../../src/application/workspace-service.js";
import type { CandidateAssessmentReport } from "../../src/domain/candidate-match-assessment.js";
import { resumeFixture } from "./resume-fixture.js";

// Synthetic UI evidence only; never imports private source material.
export function seedCandidateAssessmentViews(service: WorkspaceService) {
  if (!service.resumeService.get()) service.resumeService.initialize(Buffer.from("PKsynthetic"), resumeFixture(), "https://drive.google.com/file/d/example/view");
  const source = service.jobLibraryService.saveSource({ sourceKey: "synthetic:assessment-ui", title: "项目经历 · Platform API.docx",
    sourceUrl: "https://example.test/project", content: "Built Python APIs and automated tests.", reviewStatus: "SOURCE", expectedVersion: 0 });
  const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic UI fixture" };
  const candidates = ["Example Technology", "Example Systems", "Example Research", "Example Studio"].map((company, i) => {
    const candidate = service.candidateService.recordCandidate({ provider: "seek", postingId: `assessment-ui-${i}`, company,
      role: ["Software Engineer · Platform Services", "Systems Engineer", "Research Engineer", "Product Engineer"][i]!,
      title: "工程与产品团队", location: "Sydney · Hybrid", sourceUrl: `https://example.test/jobs/${i}`,
      authority, idempotencyKey: randomUUID() }).candidate;
    if (i < 3) service.jobLibraryService.saveDescription(candidate.id,
      "Build reliable Python APIs. Automated testing is required. Cloud operations experience preferred.", candidate.sourceUrl!);
    return candidate;
  });
  const request = (candidateId: string) => {
    const read = service.candidateAssessmentService.getCandidate(candidateId, { includeAssessmentContext: true, sourceIds: [source.id] });
    const report: CandidateAssessmentReport = {
      rubricVersion: "candidate-match-grades-v1", grade: "A",
      reason: "Python API 与自动化测试有项目证据，云端运维范围仍需确认。",
      completeness: { fullJdReviewed: true, missingMaterials: [], limitations: ["仅使用本次选择的资料；未找到证据的能力仍需向你确认。"] },
      requirements: [
        { id: "api", requirement: "构建可靠的 Python API", jdQuote: "Build reliable Python APIs.", importance: "REQUIRED", assessment: "MATCH",
          evidence: [{ kind: "LIBRARY_SOURCE", sourceId: source.id, quote: "Built Python APIs and automated tests." }], inference: "有直接开发与测试经历，能够支持岗位的核心工程要求。" },
        { id: "cloud", requirement: "云端运维经验", jdQuote: "Cloud operations experience preferred.", importance: "PREFERRED", assessment: "UNKNOWN",
          evidence: [], inference: "已选资料未说明云端运维职责，面试前需要确认实际参与范围。" },
      ],
      strengths: [{ requirementId: "api", explanation: "项目同时覆盖接口开发与自动化测试。" }],
      gaps: [], questions: [{ requirementId: "cloud", explanation: "是否负责过部署、监控或故障恢复？请补充真实案例。" }],
      provenance: { assessor: "CHATGPT", reference: "合成 UI 验收对话", generatedAt: "2026-09-11T08:00:00Z", model: null },
    };
    return { candidateId, expectedCandidateVersion: read.recordVersion, expectedAssessmentVersion: read.matchAssessment.recordVersion,
      inputManifest: read.assessmentContext!.inputManifest, report, supersedesAssessmentId: read.matchAssessment.id,
      correction: null as { kind: "USER_STATEMENT"; statement: string; reference: string } | null,
      userConfirmed: true, authorityReference: "Synthetic UI evaluation request", idempotencyKey: randomUUID() };
  };
  for (let i = 0; i < 12; i++) {
    const input = request(candidates[0]!.id);
    if (i === 0) input.report.grade = "B+";
    if (i === 11) input.correction = { kind: "USER_STATEMENT", statement: "我负责了这个项目的接口开发和自动化测试，请保留这个具体范围。", reference: "合成用户纠正记录" };
    service.candidateAssessmentService.record(input);
  }
  service.candidateAssessmentService.record(request(candidates[1]!.id));
  service.jobLibraryService.saveDescription(candidates[1]!.id, "Updated JD: cloud infrastructure and incident management.", candidates[1]!.sourceUrl!);
  return { current: candidates[0]!, stale: candidates[1]!, unassessed: candidates[2]!, missing: candidates[3]!, source, request };
}
