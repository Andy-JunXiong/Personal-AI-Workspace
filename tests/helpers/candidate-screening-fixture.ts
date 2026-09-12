import { randomUUID } from "node:crypto";
import type { WorkspaceService } from "../../src/application/workspace-service.js";
import type { JobScreeningInput } from "../../src/domain/job-screening.js";

export function seedCandidateScreening(service: WorkspaceService) {
  const profileContent = "I choose to exclude roles requiring at least eight years of commercial software engineering. This is a search preference, not a tenure claim.";
  const profile = service.jobLibraryService.saveSource({ sourceKey: "synthetic:screening-profile", title: "Synthetic confirmed screening preferences",
    sourceUrl: "https://example.test/profile", content: profileContent, reviewStatus: "CONFIRMED", expectedVersion: 0 });
  const addCandidate = (title = "Example specialist role") => {
    const candidate = service.candidateService.recordCandidate({ provider: "seek", postingId: randomUUID(),
      company: "Synthetic company", title, role: title, sourceUrl: "https://example.test/job/" + randomUUID(),
      authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Synthetic fixture" }, idempotencyKey: randomUUID() }).candidate;
    service.jobLibraryService.saveDescription(candidate.id, "Minimum eight years of commercial software engineering. Consulting experience preferred.", candidate.sourceUrl!);
    return candidate;
  };
  const candidate = addCandidate();
  function request(candidateId = candidate.id) {
    const read = service.candidateAssessmentService.getCandidate(candidateId, { includeAssessmentContext: true, sourceIds: [profile.id] });
    const source = read.assessmentContext!.sources.find(source => source.id === profile.id)!;
    const input: Omit<JobScreeningInput, "jd"> = { profileVersion: source.record_version, fullJdReviewed: true, experience: [],
      tenureExclusions: [{ category: "SOFTWARE_ENGINEERING", minimumYears: 8, evidence: { statement: profileContent, reference: profile.id } }],
      requirements: [{ id: "tenure", jdQuote: "Minimum eight years of commercial software engineering.", importance: "REQUIRED",
        interpretation: "明确要求长期商业软件工程经验。", alternatives: [{ kind: "EXPERIENCE", category: "SOFTWARE_ENGINEERING", minimumYears: 8 }] }] };
    return { candidateId, expectedCandidateVersion: read.recordVersion, expectedScreeningVersion: read.screening?.recordVersion ?? 0,
      profileSourceId: profile.id, inputManifest: read.assessmentContext!.inputManifest, input,
      reason: "岗位要求八年以上商业软件工程经验，符合明确的筛除偏好。", provenanceReference: "Synthetic screening evaluation",
      userConfirmed: true, authorityReference: "Synthetic user screening request", idempotencyKey: randomUUID() };
  }
  function override(mode: "KEEP" | "AUTOMATIC" = "KEEP", candidateId = candidate.id) {
    const read = service.candidateAssessmentService.getCandidate(candidateId), screening = read.screening!;
    return { candidateId, expectedCandidateVersion: read.recordVersion, expectedScreeningVersion: screening.recordVersion,
      expectedOverrideVersion: screening.overrideVersion, mode, reason: "Synthetic explicit choice", userConfirmed: true,
      authorityReference: "Synthetic explicit keep/withdraw request", idempotencyKey: randomUUID() };
  }
  return { profile, profileContent, candidate, addCandidate, request, override };
}
