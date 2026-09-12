import { randomUUID } from "node:crypto";
import type { WorkspaceService } from "../../src/application/workspace-service.js";
import { canonicalHash } from "../../src/domain/canonical-json.js";
import type { seedCandidateAssessmentViews } from "./candidate-assessment-fixture.js";

export function seedSkillLibraryViews(service: WorkspaceService, fixtures: ReturnType<typeof seedCandidateAssessmentViews>) {
  const sources = service.jobLibraryService.snapshot().sources;
  const source = sources.find(s => s.id === fixtures.source.id)!;
  const reference = { sourceId: source.id, recordVersion: source.record_version, hash: canonicalHash(source), quote: source.content };
  service.skillLibraryService.record({ expectedVersion: 0, userConfirmed: true, authorityReference: "Synthetic preview only", idempotencyKey: randomUUID(),
    catalog: { format: "skill-library-v1", reviewedSources: sources.map(s => ({ sourceId: s.id, recordVersion: s.record_version, hash: canonicalHash(s) })),
      skills: [{ id: "python-api", name: "Python API 开发", aliases: ["Python", "API development"], category: "TECHNICAL", summary: "使用 Python 构建 API，并实现自动化测试。",
        status: "SUPPORTED", projectIds: ["platform-api"], evidence: [reference] }],
      projects: [{ id: "platform-api", name: "Platform API 项目", contribution: "开发接口及自动化测试；商业 SWE 年限仍为 UNKNOWN。", repositorySourceId: null, evidence: [reference] }],
      limitations: ["合成预览数据，不代表用户实际技能或经历。"] } });
  const state = service.skillLibraryService.read();
  const input = fixtures.request(fixtures.current.id);
  input.report.requirements[0]!.evidence = [{ kind: "SKILL", skillId: "python-api", sourceId: state.source!.id, quote: state.catalog!.skills[0]!.summary }];
  service.candidateAssessmentService.record(input);
}
