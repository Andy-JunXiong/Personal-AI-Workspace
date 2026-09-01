import { afterEach, describe, expect, it } from "vitest";
import { IdempotencyConflictError } from "../../src/domain/errors.js";
import { createTestWorkspace } from "../helpers/test-workspace.js";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function setup() {
  const workspace = createTestWorkspace();
  cleanups.push(workspace.cleanup);
  return workspace;
}

function observationInput(projectId: string, idempotencyKey: string) {
  return {
    projectId,
    resourceType: "EMAIL",
    provider: "test-mail",
    externalId: "message-idempotent",
    externalUri: null,
    title: "Recruiter message",
    observedFacts: { recruiterReplied: true },
    observedAt: "2026-09-02T02:00:00.000Z",
    idempotencyKey,
  };
}

describe("command idempotency and deterministic duplicate protection", () => {
  it("replays same key and same canonical payload", () => {
    const workspace = setup();
    const input = observationInput(workspace.projectId, "same-key");

    const first = workspace.service.recordObservation(input);
    const second = workspace.service.recordObservation(input);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.resource.id).toBe(first.resource.id);
    expect(
      workspace.database.prepare("SELECT COUNT(*) AS count FROM resources").get(),
    ).toEqual({ count: 1 });
  });

  it("conflicts on same key and different canonical payload", () => {
    const workspace = setup();
    const input = observationInput(workspace.projectId, "conflict-key");
    workspace.service.recordObservation(input);

    expect(() =>
      workspace.service.recordObservation({
        ...input,
        observedFacts: { recruiterReplied: false },
      }),
    ).toThrow(IdempotencyConflictError);
  });

  it("deduplicates only by deterministic external identity", () => {
    const workspace = setup();
    const first = workspace.service.recordObservation(
      observationInput(workspace.projectId, "external-key-1"),
    );
    const second = workspace.service.recordObservation({
      ...observationInput(workspace.projectId, "external-key-2"),
      observedFacts: { recruiterReplied: true, summary: "Different extraction" },
    });

    expect(second.deduplicated).toBe(true);
    expect(second.resource.id).toBe(first.resource.id);
  });

  it("does not fuzzy-deduplicate similar non-identical records", () => {
    const workspace = setup();
    const base = observationInput(workspace.projectId, "exact-1");
    workspace.service.recordObservation({
      ...base,
      externalId: null,
      idempotencyKey: "exact-1",
    });
    workspace.service.recordObservation({
      ...base,
      externalId: null,
      observedFacts: { recruiterReplied: true, punctuation: "." },
      idempotencyKey: "exact-2",
    });

    expect(
      workspace.database.prepare("SELECT COUNT(*) AS count FROM resources").get(),
    ).toEqual({ count: 2 });
  });

  it("deduplicates an exact proposal and never duplicates its derived task", () => {
    const workspace = setup();
    const observation = workspace.service.recordObservation(
      observationInput(workspace.projectId, "proposal-observation"),
    );
    const proposalInput = {
      projectId: workspace.projectId,
      expectedLifecycleVersion: 1,
      toState: "RECRUITER_CONTACT" as const,
      triggerType: "EXTERNAL_EVIDENCE" as const,
      evidenceResourceIds: [observation.resource.id],
      rationale: "Exact proposal",
    };

    const first = workspace.service.proposeTransition({
      ...proposalInput,
      idempotencyKey: "proposal-key-1",
    });
    const duplicate = workspace.service.proposeTransition({
      ...proposalInput,
      idempotencyKey: "proposal-key-2",
    });

    expect(duplicate.deduplicated).toBe(true);
    expect(duplicate.transition.id).toBe(first.transition.id);

    const admissionInput = {
      transitionId: first.transition.id,
      expectedLifecycleVersion: 1,
      authority: {
        type: "EXPLICIT_USER_DEV" as const,
        confirmed: true as const,
        reference: "Explicit test user instruction",
      },
    };
    const admitted = workspace.service.admitTransition({
      ...admissionInput,
      idempotencyKey: "admission-key-1",
    });
    const replayed = workspace.service.admitTransition({
      ...admissionInput,
      idempotencyKey: "admission-key-1",
    });
    const repeatedWithNewKey = workspace.service.admitTransition({
      ...admissionInput,
      idempotencyKey: "admission-key-2",
    });

    expect(admitted.alreadyAdmitted).toBe(false);
    expect(replayed.replayed).toBe(true);
    expect(repeatedWithNewKey.alreadyAdmitted).toBe(true);
    expect(
      workspace.database.prepare("SELECT COUNT(*) AS count FROM tasks").get(),
    ).toEqual({ count: 1 });
    expect(
      workspace.database
        .prepare(
          "SELECT COUNT(*) AS count FROM state_transitions WHERE status = 'ADMITTED'",
        )
        .get(),
    ).toEqual({ count: 2 });
  });
});
