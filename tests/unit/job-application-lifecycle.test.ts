import { describe, expect, it } from "vitest";
import {
  derivedTaskForTransition,
  deterministicAdmissionRules,
  isAllowedTransition,
  isTerminalLifecycleState,
} from "../../src/domain/job-application-lifecycle.js";
import type { LifecycleState } from "../../src/domain/types.js";

const states: LifecycleState[] = [
  "APPLIED",
  "RECRUITER_CONTACT",
  "INTERVIEWING",
  "OFFER",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

const expectedEdges: Record<LifecycleState, LifecycleState[]> = {
  APPLIED: ["RECRUITER_CONTACT", "INTERVIEWING", "REJECTED", "WITHDRAWN"],
  RECRUITER_CONTACT: ["INTERVIEWING", "REJECTED", "WITHDRAWN"],
  INTERVIEWING: ["OFFER", "REJECTED", "WITHDRAWN"],
  OFFER: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

describe("Job Application lifecycle", () => {
  it("supports the blocking APPLIED to RECRUITER_CONTACT edge", () => {
    expect(isAllowedTransition("APPLIED", "RECRUITER_CONTACT")).toBe(true);
    expect(
      derivedTaskForTransition("APPLIED", "RECRUITER_CONTACT"),
    ).toEqual({
      taskKind: "RESPOND_TO_RECRUITER",
      title: "Respond to recruiter",
      priority: "HIGH",
    });
  });

  it("implements the complete approved M3 edge matrix and rejects every other edge", () => {
    for (const fromState of states) {
      for (const toState of states) {
        expect(isAllowedTransition(fromState, toState)).toBe(
          expectedEdges[fromState].includes(toState),
        );
      }
    }
  });

  it("derives only the three approved M3 action Tasks", () => {
    expect(
      derivedTaskForTransition("RECRUITER_CONTACT", "INTERVIEWING"),
    ).toEqual({
      taskKind: "PREPARE_FOR_INTERVIEW",
      title: "Prepare for interview",
      priority: "HIGH",
    });
    expect(derivedTaskForTransition("INTERVIEWING", "OFFER")).toEqual({
      taskKind: "REVIEW_OFFER",
      title: "Review offer",
      priority: "HIGH",
    });
    expect(derivedTaskForTransition("OFFER", "ACCEPTED")).toBeNull();
    expect(derivedTaskForTransition("APPLIED", "REJECTED")).toBeNull();
  });

  it("marks only accepted, rejected, and withdrawn as terminal", () => {
    expect(states.filter(isTerminalLifecycleState)).toEqual([
      "ACCEPTED",
      "REJECTED",
      "WITHDRAWN",
    ]);
  });

  it("enumerates only the fixture initialization rule", () => {
    expect(deterministicAdmissionRules).toEqual(["SPIKE_FIXTURE_IMPORT"]);
  });
});
