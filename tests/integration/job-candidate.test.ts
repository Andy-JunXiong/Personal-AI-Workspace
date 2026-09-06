import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  AuthorizationError,
  ConcurrencyConflictError,
  IdempotencyConflictError,
  NotFoundError,
  ValidationError,
} from "../../src/domain/errors.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { verifiedRequestContext } from "../../src/application/request-context.js";
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

function recordInput(overrides: Record<string, unknown> = {}) {
  return {
    provider: "seek",
    postingId: "seek-12345",
    sourceUrl: "https://www.seek.com.au/job/12345",
    title: "Senior Software Engineer",
    company: "Acme",
    role: "Senior Software Engineer",
    location: "Sydney",
    fitReason: "Matches distributed systems background",
    fitUncertainty: "MEDIUM" as const,
    sourceAvailability: "AVAILABLE" as const,
    authority: devAuthority,
    idempotencyKey: "record-1",
    ...overrides,
  };
}

describe("Candidate recording", () => {
  it("creates an unreviewed candidate and replays the same intent", () => {
    const w = setup();
    const first = w.service.candidateService.recordCandidate(recordInput());
    expect(first.created).toBe(true);
    expect(first.changed).toBe(true);
    expect(first.replayed).toBe(false);
    expect(first.candidate.decision).toBe("UNREVIEWED");
    expect(first.candidate.recordVersion).toBe(1);
    expect(first.candidate.linkedProjectId).toBeNull();

    const replay = w.service.candidateService.recordCandidate(recordInput());
    expect(replay.replayed).toBe(true);
    expect(replay.candidate.id).toBe(first.candidate.id);
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM job_candidates").get()).toEqual({ n: 1 });
  });

  it("deduplicates by posting identity and preserves the user decision", () => {
    const w = setup();
    const first = w.service.candidateService.recordCandidate(recordInput());
    w.service.candidateService.decideCandidate({
      candidateId: first.candidate.id,
      action: "SAVE",
      expectedRecordVersion: first.candidate.recordVersion,
      authority: devAuthority,
      idempotencyKey: "save-1",
    });

    const rerecord = w.service.candidateService.recordCandidate(recordInput({
      idempotencyKey: "record-2",
      fitReason: "Updated fit reason",
    }));
    expect(rerecord.created).toBe(false);
    expect(rerecord.candidate.id).toBe(first.candidate.id);
    expect(rerecord.candidate.fitReason).toBe("Updated fit reason");
    expect(rerecord.candidate.decision).toBe("SAVED");
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM job_candidates").get()).toEqual({ n: 1 });
  });

  it("deduplicates by canonical source URL without a posting identity", () => {
    const w = setup();
    const input = recordInput({ postingId: null, idempotencyKey: "url-1" });
    const first = w.service.candidateService.recordCandidate(input);
    const second = w.service.candidateService.recordCandidate({ ...input, idempotencyKey: "url-2" });
    expect(second.created).toBe(false);
    expect(second.candidate.id).toBe(first.candidate.id);
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM job_candidates").get()).toEqual({ n: 1 });
  });

  it("rejects a cross-identity match and a missing or invalid identity", () => {
    const w = setup();
    w.service.candidateService.recordCandidate(recordInput({ idempotencyKey: "a-1" }));
    w.service.candidateService.recordCandidate(recordInput({
      idempotencyKey: "b-1",
      postingId: "seek-99999",
      sourceUrl: "https://www.seek.com.au/job/99999",
    }));

    expect(() => w.service.candidateService.recordCandidate(recordInput({
      idempotencyKey: "conflict-1",
      postingId: "seek-99999",
      sourceUrl: "https://www.seek.com.au/job/12345",
    }))).toThrow(/two different records/u);

    expect(() => w.service.candidateService.recordCandidate(recordInput({
      postingId: null,
      sourceUrl: null,
    }))).toThrow(ValidationError);

    expect(() => w.service.candidateService.recordCandidate(recordInput({
      sourceUrl: "not-a-url",
    }))).toThrow(ValidationError);
  });

  it("conflicts when the same key is reused with a different payload", () => {
    const w = setup();
    w.service.candidateService.recordCandidate(recordInput());
    expect(() => w.service.candidateService.recordCandidate(recordInput({ company: "Other" })))
      .toThrow(IdempotencyConflictError);
  });
});

describe("Candidate decisions", () => {
  it("saves, dismisses, and restores with version increments and audit", () => {
    const w = setup();
    const { candidate } = w.service.candidateService.recordCandidate(recordInput());

    const saved = w.service.candidateService.decideCandidate({
      candidateId: candidate.id, action: "SAVE", expectedRecordVersion: 1,
      authority: devAuthority, idempotencyKey: "save-1",
    });
    expect(saved.changed).toBe(true);
    expect(saved.candidate.decision).toBe("SAVED");
    expect(saved.candidate.recordVersion).toBe(2);
    expect(saved.candidate.decisionAt).not.toBeNull();

    const dismissed = w.service.candidateService.decideCandidate({
      candidateId: candidate.id, action: "DISMISS", expectedRecordVersion: 2,
      authority: devAuthority, idempotencyKey: "dismiss-1",
    });
    expect(dismissed.candidate.decision).toBe("DISMISSED");
    expect(dismissed.candidate.recordVersion).toBe(3);

    const restored = w.service.candidateService.decideCandidate({
      candidateId: candidate.id, action: "RESTORE", expectedRecordVersion: 3,
      authority: devAuthority, idempotencyKey: "restore-1",
    });
    expect(restored.candidate.decision).toBe("UNREVIEWED");
    expect(restored.candidate.recordVersion).toBe(4);
    expect(restored.candidate.decisionAt).toBeNull();

    expect(w.database.prepare(
      "SELECT action, from_decision, to_decision, channel FROM candidate_decisions ORDER BY record_version",
    ).all()).toEqual([
      { action: "SAVE", from_decision: "UNREVIEWED", to_decision: "SAVED", channel: "MCP" },
      { action: "DISMISS", from_decision: "SAVED", to_decision: "DISMISSED", channel: "MCP" },
      { action: "RESTORE", from_decision: "DISMISSED", to_decision: "UNREVIEWED", channel: "MCP" },
    ]);
  });

  it("records a no-op decision without bumping the version", () => {
    const w = setup();
    const { candidate } = w.service.candidateService.recordCandidate(recordInput());
    w.service.candidateService.decideCandidate({
      candidateId: candidate.id, action: "SAVE", expectedRecordVersion: 1,
      authority: devAuthority, idempotencyKey: "save-1",
    });
    const noop = w.service.candidateService.decideCandidate({
      candidateId: candidate.id, action: "SAVE", expectedRecordVersion: 2,
      authority: devAuthority, idempotencyKey: "save-2",
    });
    expect(noop.changed).toBe(false);
    expect(noop.candidate.recordVersion).toBe(2);
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM candidate_decisions").get()).toEqual({ n: 2 });
  });

  it("rejects a stale decision and replays the same intent", () => {
    const w = setup();
    const { candidate } = w.service.candidateService.recordCandidate(recordInput());
    w.service.candidateService.decideCandidate({
      candidateId: candidate.id, action: "SAVE", expectedRecordVersion: 1,
      authority: devAuthority, idempotencyKey: "save-1",
    });
    expect(() => w.service.candidateService.decideCandidate({
      candidateId: candidate.id, action: "DISMISS", expectedRecordVersion: 1,
      authority: devAuthority, idempotencyKey: "stale-1",
    })).toThrow(ConcurrencyConflictError);

    const replay = w.service.candidateService.decideCandidate({
      candidateId: candidate.id, action: "SAVE", expectedRecordVersion: 1,
      authority: devAuthority, idempotencyKey: "save-1",
    });
    expect(replay.replayed).toBe(true);
    expect(replay.candidate.decision).toBe("SAVED");
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM candidate_decisions").get()).toEqual({ n: 1 });
  });

  it("rejects a forged development authority on the web channel", () => {
    const w = setup();
    const context = verifiedRequestContext(w.database, w.identity, "WEB", randomUUID());
    const web = new WorkspaceService(w.database, context);
    const { candidate } = w.service.candidateService.recordCandidate(recordInput());

    const webAuthority = { type: "EXPLICIT_USER_WEB" as const, reference: "web-decision" };
    const decided = web.candidateService.decideCandidate({
      candidateId: candidate.id, action: "SAVE", expectedRecordVersion: 1,
      authority: webAuthority, idempotencyKey: "web-save-1",
    });
    expect(decided.candidate.decision).toBe("SAVED");
    expect(w.database.prepare(
      "SELECT channel, authority_type FROM candidate_decisions ORDER BY record_version",
    ).all()).toEqual([{ channel: "WEB", authority_type: "EXPLICIT_USER_WEB" }]);

    expect(() => web.candidateService.decideCandidate({
      candidateId: candidate.id, action: "DISMISS", expectedRecordVersion: 2,
      authority: devAuthority, idempotencyKey: "forged-dev",
    })).toThrow(AuthorizationError);

    expect(() => web.candidateService.recordCandidate(recordInput({
      idempotencyKey: "forged-record",
    }))).toThrow(AuthorizationError);
  });
});

describe("Candidate reads", () => {
  it("lists by decision and linked filter with stable pagination", () => {
    const w = setup();
    const a = w.service.candidateService.recordCandidate(recordInput({ idempotencyKey: "a" })).candidate;
    const b = w.service.candidateService.recordCandidate(recordInput({
      idempotencyKey: "b", postingId: "seek-2", sourceUrl: "https://www.seek.com.au/job/2",
      company: "Beta", role: "Engineer",
    })).candidate;
    w.service.candidateService.decideCandidate({
      candidateId: b.id, action: "SAVE", expectedRecordVersion: 1,
      authority: devAuthority, idempotencyKey: "save-b",
    });

    const all = w.service.jobSearchQueryService.listCandidates({ pageSize: 2 });
    expect(all.totalCount).toBe(2);
    expect(all.items).toHaveLength(2);

    const saved = w.service.jobSearchQueryService.listCandidates({ decision: "SAVED" });
    expect(saved.totalCount).toBe(1);
    expect(saved.items[0]!.id).toBe(b.id);

    const unreviewed = w.service.jobSearchQueryService.listCandidates({ decision: "UNREVIEWED" });
    expect(unreviewed.totalCount).toBe(1);
    expect(unreviewed.items[0]!.id).toBe(a.id);

    const unlinked = w.service.jobSearchQueryService.listCandidates({ linked: "UNLINKED" });
    expect(unlinked.totalCount).toBe(2);
  });

  it("returns one exact candidate and rejects a wrong owner", () => {
    const w = setup();
    const { candidate } = w.service.candidateService.recordCandidate(recordInput());
    expect(w.service.jobSearchQueryService.getCandidate(candidate.id)).toMatchObject({
      id: candidate.id,
      company: "Acme",
      decision: "UNREVIEWED",
    });
    expect(() => w.service.jobSearchQueryService.getCandidate(randomUUID())).toThrow(NotFoundError);
  });
});
