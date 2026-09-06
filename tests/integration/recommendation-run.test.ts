import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  IdempotencyConflictError,
  NotFoundError,
  ValidationError,
} from "../../src/domain/errors.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

function setup() {
  const workspace = createEmptyTestWorkspace();
  cleanups.push(workspace.cleanup);
  return workspace;
}

const devAuthority = {
  type: "EXPLICIT_USER_DEV" as const,
  confirmed: true as const,
  reference: "synthetic",
};

function item(overrides: Record<string, unknown> = {}) {
  return {
    provider: "seek",
    postingId: "seek-123",
    sourceUrl: "https://www.seek.com.au/job/123",
    title: "Senior Engineer",
    company: "Acme",
    role: "Senior Engineer",
    location: "Sydney",
    fitReason: "Matches background",
    fitUncertainty: "MEDIUM" as const,
    sourceAvailability: "AVAILABLE" as const,
    ...overrides,
  };
}

function runInput(overrides: Record<string, unknown> = {}) {
  return {
    provider: "chatgpt-digest",
    runAt: "2026-09-06T09:00:00.000Z",
    runReference: "digest-2026-09-06",
    coverageStatus: "COMPLETE" as const,
    deliveryStatus: "DELIVERED" as const,
    coverageNote: "All sources searched",
    items: [item()],
    authority: devAuthority,
    idempotencyKey: "run-1",
    ...overrides,
  };
}

describe("Recommendation run recording", () => {
  it("records a run with snapshotted items and deduplicates the candidate", () => {
    const w = setup();
    const first = w.service.candidateService.recordRecommendationRun(runInput());
    expect(first.replayed).toBe(false);
    expect(first.run).toMatchObject({
      provider: "chatgpt-digest",
      runReference: "digest-2026-09-06",
      coverageStatus: "COMPLETE",
      deliveryStatus: "DELIVERED",
      itemCount: 1,
    });
    expect(first.run.items).toHaveLength(1);
    expect(first.run.items[0]).toMatchObject({
      position: 0,
      fitReason: "Matches background",
      fitUncertainty: "MEDIUM",
      sourceAvailability: "AVAILABLE",
    });
    expect(first.run.retentionUntil).toBe("2026-12-05T09:00:00.000Z"); // run_at + 90 days
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM job_candidates").get()).toEqual({ n: 1 });
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM recommendation_run_items").get()).toEqual({ n: 1 });
  });

  it("replays the same run once and never mutates a decision, application, or lifecycle", () => {
    const w = setup();
    const { candidate } = w.service.candidateService.recordCandidate({
      provider: "seek", postingId: "seek-123", sourceUrl: "https://www.seek.com.au/job/123",
      title: "Senior Engineer", company: "Acme", role: "Senior Engineer",
      authority: devAuthority, idempotencyKey: "seed",
    });
    w.service.candidateService.decideCandidate({
      candidateId: candidate.id, action: "SAVE", expectedRecordVersion: 1,
      authority: devAuthority, idempotencyKey: "save",
    });

    const projectsBefore = w.database.prepare("SELECT COUNT(*) AS n FROM projects").get();
    const transitionsBefore = w.database.prepare("SELECT COUNT(*) AS n FROM state_transitions").get();
    const decisionsBefore = w.database.prepare("SELECT COUNT(*) AS n FROM candidate_decisions").get();

    const recorded = w.service.candidateService.recordRecommendationRun(runInput({
      items: [item({ fitReason: "Updated fit context" })],
    }));
    expect(recorded.run.itemCount).toBe(1);

    const replay = w.service.candidateService.recordRecommendationRun(runInput({
      items: [item({ fitReason: "Updated fit context" })],
    }));
    expect(replay.replayed).toBe(true);
    expect(replay.run.id).toBe(recorded.run.id);

    const reread = w.service.jobSearchQueryService.getCandidate(candidate.id);
    expect(reread.decision).toBe("SAVED");
    expect(reread.fitReason).toBe("Updated fit context");
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM projects").get()).toEqual(projectsBefore);
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM state_transitions").get()).toEqual(transitionsBefore);
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM candidate_decisions").get()).toEqual(decisionsBefore);
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM recommendation_runs").get()).toEqual({ n: 1 });
  });

  it("records a truthful empty run and a failed source with unknown delivery", () => {
    const w = setup();
    const empty = w.service.candidateService.recordRecommendationRun(runInput({
      items: [], idempotencyKey: "empty",
    }));
    expect(empty.run.itemCount).toBe(0);
    expect(empty.run.items).toHaveLength(0);
    expect(empty.run.coverageStatus).toBe("COMPLETE");

    const failed = w.service.candidateService.recordRecommendationRun(runInput({
      idempotencyKey: "failed",
      coverageStatus: "FAILED",
      deliveryStatus: "UNKNOWN",
      coverageNote: "Source unavailable",
      items: [],
    }));
    expect(failed.run.coverageStatus).toBe("FAILED");
    expect(failed.run.deliveryStatus).toBe("UNKNOWN");
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM job_candidates").get()).toEqual({ n: 0 });
  });

  it("snapshots each run's delivery context without overwriting an earlier run", () => {
    const w = setup();
    const first = w.service.candidateService.recordRecommendationRun(runInput({
      items: [item({ fitReason: "First fit" })],
      idempotencyKey: "first",
    }));
    const second = w.service.candidateService.recordRecommendationRun(runInput({
      runAt: "2026-09-07T09:00:00.000Z",
      runReference: "digest-2026-09-07",
      items: [item({ fitReason: "Second fit" })],
      idempotencyKey: "second",
    }));

    const firstRead = w.service.jobSearchQueryService.getRecommendationRun(first.run.id);
    const secondRead = w.service.jobSearchQueryService.getRecommendationRun(second.run.id);
    expect(firstRead.items[0]!.fitReason).toBe("First fit");
    expect(secondRead.items[0]!.fitReason).toBe("Second fit");
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM job_candidates").get()).toEqual({ n: 1 });
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM recommendation_run_items").get()).toEqual({ n: 2 });
  });

  it("deduplicates a candidate that appears twice in one run", () => {
    const w = setup();
    const result = w.service.candidateService.recordRecommendationRun(runInput({
      items: [item({ position: 0 }), item({ position: 1 })],
    }));
    expect(result.run.itemCount).toBe(1);
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM recommendation_run_items").get()).toEqual({ n: 1 });
  });

  it("rejects invalid statuses, oversized runs, and a conflicting replay", () => {
    const w = setup();
    expect(() => w.service.candidateService.recordRecommendationRun(runInput({
      coverageStatus: "BOGUS",
    }))).toThrow(ValidationError);
    expect(() => w.service.candidateService.recordRecommendationRun(runInput({
      deliveryStatus: "BOGUS",
    }))).toThrow(ValidationError);
    const many = Array.from({ length: 101 }, (_, i) => item({ postingId: `seek-${i}`, sourceUrl: `https://example.test/job/${i}` }));
    expect(() => w.service.candidateService.recordRecommendationRun(runInput({ items: many })))
      .toThrow(ValidationError);

    w.service.candidateService.recordRecommendationRun(runInput());
    expect(() => w.service.candidateService.recordRecommendationRun(runInput({
      coverageNote: "Different payload",
    }))).toThrow(IdempotencyConflictError);
  });
});

describe("Recommendation run reads", () => {
  it("lists runs with pagination and returns one exact run with a wrong-owner rejection", () => {
    const w = setup();
    const a = w.service.candidateService.recordRecommendationRun(runInput({ idempotencyKey: "a" })).run;
    const b = w.service.candidateService.recordRecommendationRun(runInput({
      runAt: "2026-09-07T09:00:00.000Z", runReference: "digest-2", idempotencyKey: "b",
    })).run;

    const list = w.service.jobSearchQueryService.listRecommendationRuns({ pageSize: 1 });
    expect(list.totalCount).toBe(2);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]!.id).toBe(b.id);
    expect(list.nextCursor).not.toBeNull();

    const detail = w.service.jobSearchQueryService.getRecommendationRun(a.id);
    expect(detail).toMatchObject({ id: a.id, coverageStatus: "COMPLETE", itemCount: 1 });
    expect(detail.items).toHaveLength(1);

    expect(() => w.service.jobSearchQueryService.getRecommendationRun(randomUUID())).toThrow(NotFoundError);

    const other = new WorkspaceService(w.database, { issuer: "other", subject: "other", workspaceName: "Other" });
    other.ensureDevelopmentIdentity();
    expect(() => other.jobSearchQueryService.getRecommendationRun(a.id)).toThrow(NotFoundError);
  });
});
