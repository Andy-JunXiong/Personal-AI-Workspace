import { describe, expect, it } from "vitest";
import {
  derivedTaskForTransition,
  deterministicAdmissionRules,
  isAllowedTransition,
} from "../../src/domain/job-application-lifecycle.js";

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

  it("retains RECRUITER_CONTACT to INTERVIEWING as an optional edge", () => {
    expect(isAllowedTransition("RECRUITER_CONTACT", "INTERVIEWING")).toBe(
      true,
    );
    expect(
      derivedTaskForTransition("RECRUITER_CONTACT", "INTERVIEWING"),
    ).toBeNull();
  });

  it("enumerates only the fixture initialization rule", () => {
    expect(deterministicAdmissionRules).toEqual(["SPIKE_FIXTURE_IMPORT"]);
  });
});
