import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { NotFoundError } from "../../src/domain/errors.js";
import type { ApplicationResume } from "../../src/domain/application-resume.js";
import { createTestWorkspace } from "../helpers/test-workspace.js";
import { resumeFixture } from "../helpers/resume-fixture.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function setup() {
  const workspace = createTestWorkspace({
    clock: () => new Date("2026-09-11T04:30:00.000Z"),
  });
  cleanups.push(workspace.cleanup);
  workspace.service.resumeService.initialize(
    Buffer.from("PKsynthetic"),
    resumeFixture(),
    "https://drive.google.com/file/d/base-resume/view",
  );
  return workspace;
}

function createApplicationVariant(
  workspace: ReturnType<typeof setup>,
  name: string,
) {
  return workspace.service.resumeService.createVariant({
    name,
    targetType: "APPLICATION",
    targetId: workspace.projectId,
    expectedBaseVersion: 1,
    intentKey: randomUUID(),
  });
}

function confirmedResume(): ApplicationResume {
  return {
    contractVersion: "job-application-resume-v0.1",
    supersedesResourceId: null,
    sourceFacts: {
      fileId: "submittedResume",
      fileName: "Example Co Software Engineer Resume.pdf",
      mimeType: "application/pdf",
      modifiedTime: "2026-09-01T00:00:00Z",
      revisionId: "submitted-revision-1",
      revisionModifiedTime: "2026-09-01T00:00:00Z",
    },
    interpretation: {
      status: "CONFIRMED_VERSION",
      reason: "The exact submitted Drive revision was confirmed.",
    },
    confirmation: {
      kind: "USER_STATEMENT",
      reference: "Synthetic explicit user confirmation",
      statement: "This exact revision was submitted.",
    },
  };
}

it("returns one bounded read-only preparation projection with attributable dossier and resume versions", () => {
  const workspace = setup();
  const variant = createApplicationVariant(workspace, "Example Co working resume");
  workspace.database.prepare(
    "UPDATE projects SET metadata_json=json_set(metadata_json,'$.postingReference',?) WHERE id=?",
  ).run("https://example.test/jobs/123", workspace.projectId);
  const profile = workspace.service.recordObservation({
    projectId: workspace.projectId,
    provider: "chatgpt",
    resourceType: "NOTE",
    externalUri: null,
    title: "Saved application dossier",
    externalId: randomUUID(),
    observedAt: "2026-09-11T02:00:00Z",
    observedFacts: {
      contractVersion: "job-application-profile-v0.1",
      sourceReference: "https://example.test/jobs/123 and working resume version 1",
      jobDescription: "Build reliable data and AI systems.",
      skillMatch: {
        summary: "Grounded comparison",
        matches: [{
          requirement: "Reliable data systems",
          evidence: "Saved resume project evidence",
          assessment: "MATCH",
        }],
        gaps: [],
      },
    },
    idempotencyKey: randomUUID(),
  });
  const submitted = workspace.service.recordObservation({
    projectId: workspace.projectId,
    provider: "google-drive-resume",
    resourceType: "DOCUMENT",
    externalUri: "https://drive.google.com/file/d/submittedResume/view",
    title: "Submitted resume",
    externalId: randomUUID(),
    observedAt: "2026-09-11T02:10:00Z",
    observedFacts: confirmedResume(),
    idempotencyKey: randomUUID(),
  });
  for (let index = 0; index < 11; index += 1) {
    workspace.service.recordObservation({
      projectId: workspace.projectId,
      provider: "chatgpt",
      resourceType: "NOTE",
      externalUri: null,
      title: `Later note ${index}`,
      externalId: randomUUID(),
      observedAt: "2026-09-11T03:00:00Z",
      observedFacts: { summary: `Later note ${index}` },
      idempotencyKey: randomUUID(),
    });
  }

  const changesBeforeRead = workspace.database.prepare("SELECT total_changes() AS count").get();
  const result = workspace.service.getProject(workspace.projectId);

  expect(result.applicationProfile?.saved?.id).toBe(profile.resource.id);
  expect(result.preparationContext).toMatchObject({
    contractVersion: "job-application-preparation-context-v0.1",
    readAt: "2026-09-11T04:30:00.000Z",
    dossier: {
      profileResourceId: profile.resource.id,
      profileProvider: "chatgpt",
      profileSavedAt: "2026-09-11T02:00:00Z",
      jobDescriptionStatus: "AVAILABLE",
      skillMatchStatus: "AVAILABLE",
    },
    workingResume: {
      status: "SELECTED",
      options: [{ id: variant.variant?.id, recordVersion: 1 }],
      selected: {
        id: variant.variant?.id,
        selectionBasis: "SINGLE_APPLICATION_VARIANT",
        recordVersion: 1,
        content: resumeFixture(),
      },
    },
    submittedResume: {
      status: "VERSION_CONFIRMED",
      options: [{
        resourceId: submitted.resource.id,
        confirmationStatus: "CONFIRMED_VERSION",
        revisionId: "submitted-revision-1",
      }],
    },
    missingItems: [],
    history: { resources: { returned: 10, truncated: true } },
  });
  expect(workspace.database.prepare("SELECT total_changes() AS count").get()).toEqual(changesBeforeRead);
});

it("requires an exact choice when several working resumes exist and rejects another target's version", () => {
  const workspace = setup();
  const first = createApplicationVariant(workspace, "Example Co primary");
  createApplicationVariant(workspace, "Example Co alternate");
  const candidate = workspace.service.candidateService.recordCandidate({
    provider: "seek",
    postingId: "other-target",
    company: "Other Co",
    title: "AI Engineer",
    role: "AI Engineer",
    authority: { type: "EXPLICIT_USER_DEV", confirmed: true, reference: "Synthetic test" },
    idempotencyKey: randomUUID(),
  }).candidate;
  const candidateVariant = workspace.service.resumeService.createVariant({
    name: "Other target resume",
    targetType: "CANDIDATE",
    targetId: candidate.id,
    expectedBaseVersion: 1,
    intentKey: randomUUID(),
  });

  const unresolved = workspace.service.getProject(workspace.projectId).preparationContext!;
  expect(unresolved.workingResume).toMatchObject({
    status: "SELECTION_REQUIRED",
    selected: null,
  });
  expect(unresolved.workingResume.options).toHaveLength(2);
  expect(unresolved.missingItems).toContain("WORKING_RESUME_SELECTION");

  const selected = workspace.service.getProject(workspace.projectId, {
    resumeVariantId: first.variant!.id,
  }).preparationContext!;
  expect(selected.workingResume.selected).toMatchObject({
    id: first.variant!.id,
    selectionBasis: "EXPLICIT_ID",
  });
  expect(selected.missingItems).not.toContain("WORKING_RESUME_SELECTION");
  expect(() => workspace.service.getProject(workspace.projectId, {
    resumeVariantId: candidateVariant.variant!.id,
  })).toThrow(NotFoundError);
});

it("reports explicit material gaps without fabricating a resume or complete history", () => {
  const workspace = setup();
  const context = workspace.service.getProject(workspace.projectId).preparationContext!;

  expect(context).toMatchObject({
    dossier: {
      profileResourceId: null,
      jobDescriptionStatus: "MISSING",
      skillMatchStatus: "MISSING",
    },
    workingResume: { status: "MISSING", options: [], selected: null },
    submittedResume: { status: "MISSING", options: [] },
    history: {
      resources: { returned: 0, total: 0, limit: 10, truncated: false },
      transitions: { returned: 1, total: 1, limit: 10, truncated: false },
      openTasks: { returned: 0, total: 0, truncated: false },
    },
  });
  expect(context.missingItems).toEqual([
    "POSTING_REFERENCE",
    "JOB_DESCRIPTION",
    "SKILL_MATCH",
    "SUBMITTED_RESUME_FILE",
    "SUBMITTED_RESUME_VERSION",
    "WORKING_RESUME",
  ]);
});
