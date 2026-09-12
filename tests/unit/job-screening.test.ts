import { describe, expect, it } from "vitest";
import { screenJob, type JobScreeningInput } from "../../src/domain/job-screening.js";

const evidence = { statement: "Synthetic confirmed profile fact", reference: "fixture:profile-v1" };
function fixture(): JobScreeningInput {
  return { jd: "Minimum eight years of software engineering or technology delivery. Cloud experience preferred.",
    fullJdReviewed: true, profileVersion: 1,
    experience: [{ category: "PROFESSIONAL", lowerYears: 12, upperYears: 12, evidence }],
    tenureExclusions: [], requirements: [{ id: "r1", jdQuote: "Minimum eight years of software engineering or technology delivery.",
      importance: "REQUIRED", interpretation: "Explicit alternative career paths",
      alternatives: [{ kind: "EXPERIENCE", category: "SOFTWARE_ENGINEERING", minimumYears: 8 }] }] };
}

describe("recoverable job screening core", () => {
  it("does not convert total professional experience to SWE tenure", () => {
    const result = screenJob(fixture());
    expect(result.decision).toBe("USER_CONFIRMATION_REQUIRED");
    expect(result.findings[0]?.rule).toBe("TENURE_UNKNOWN");
    expect(result.matchGrade).toBeNull();
  });
  it("does not turn a lower bound into a known upper bound", () => {
    const input = fixture();
    input.experience.push({ category: "SOFTWARE_ENGINEERING", lowerYears: 2, upperYears: null, evidence });
    expect(screenJob(input).decision).toBe("USER_CONFIRMATION_REQUIRED");
  });
  it.each([
    ["SOFTWARE_ENGINEERING", 8, "FILTER"], ["SOFTWARE_ENGINEERING", 10, "FILTER"],
    ["SOFTWARE_ENGINEERING", 5, "DEPRIORITIZE"], ["AI_ML_ENGINEERING", 5, "FILTER"],
    ["AI_ML_ENGINEERING", 10, "FILTER"], ["DIRECT_PEOPLE_MANAGEMENT", 3, "FILTER"],
    ["PROFESSIONAL", 10, "DEPRIORITIZE"], ["TECHNOLOGY_DELIVERY", 10, "DEPRIORITIZE"],
  ] as const)("handles confirmed %s shortfall at %s years", (category, minimumYears, expected) => {
    const input = fixture();
    input.experience = [{ category, lowerYears: 1, upperYears: 1, evidence }];
    input.requirements[0]!.alternatives = [{ kind: "EXPERIENCE", category, minimumYears }];
    expect(screenJob(input).decision).toBe(expected);
  });
  it("honours an explicit exclusion as a preference rather than invented negative evidence", () => {
    const input = fixture();
    input.tenureExclusions = [{ category: "SOFTWARE_ENGINEERING", minimumYears: 8, evidence }];
    const result = screenJob(input);
    expect(result.decision).toBe("FILTER");
    expect(result.findings[0]?.basis).toBe("PREFERENCE");
    expect(result.recoverable).toBe(true);
  });
  it("retains an OR requirement when technology delivery satisfies the alternative", () => {
    const input = fixture();
    input.tenureExclusions = [{ category: "SOFTWARE_ENGINEERING", minimumYears: 8, evidence }];
    input.experience.push({ category: "TECHNOLOGY_DELIVERY", lowerYears: 11, upperYears: null, evidence });
    input.requirements[0]!.alternatives.push({ kind: "EXPERIENCE", category: "TECHNOLOGY_DELIVERY", minimumYears: 8 });
    expect(screenJob(input).decision).toBe("EVALUATE");
  });
  it("does not filter an OR group with an unknown alternative", () => {
    const input = fixture();
    input.tenureExclusions = [{ category: "SOFTWARE_ENGINEERING", minimumYears: 8, evidence }];
    input.requirements[0]!.alternatives.push({ kind: "EXPERIENCE", category: "TECHNOLOGY_DELIVERY", minimumYears: 8 });
    expect(screenJob(input).decision).toBe("USER_CONFIRMATION_REQUIRED");
  });
  it("does not guess ambiguous engineering experience", () => {
    const input = fixture();
    input.requirements[0]!.alternatives = [{ kind: "EXPERIENCE", category: "AMBIGUOUS_ENGINEERING", minimumYears: 8 }];
    expect(screenJob(input).findings[0]?.rule).toBe("AMBIGUOUS_EXPERIENCE");
  });
  it.each(["PREFERRED", "UNKNOWN"] as const)("does not hard-filter %s requirements", importance => {
    const input = fixture();
    input.tenureExclusions = [{ category: "SOFTWARE_ENGINEERING", minimumYears: 8, evidence }];
    input.requirements[0]!.importance = importance;
    expect(screenJob(input).decision).toBe(importance === "PREFERRED" ? "DEPRIORITIZE" : "USER_CONFIRMATION_REQUIRED");
  });
  it.each(["LOCATION", "WORK_RIGHTS", "CLEARANCE", "SPECIALIST_DIRECTION", "QUALIFICATION"] as const)(
    "requires evidence for a %s mismatch", condition => {
      const input = fixture();
      input.requirements[0]!.alternatives = [{ kind: "CONDITION", condition, outcome: "UNKNOWN", evidence: null }];
      expect(screenJob(input).decision).toBe("USER_CONFIRMATION_REQUIRED");
      input.requirements[0]!.alternatives = [{ kind: "CONDITION", condition, outcome: "MISMATCH", evidence }];
      expect(screenJob(input).decision).toBe("FILTER");
      input.requirements[0]!.alternatives = [{ kind: "CONDITION", condition, outcome: "MISMATCH", evidence: null }];
      expect(() => screenJob(input)).toThrow("require attributable");
    });
  it.each(["TOOL", "COMPENSATION"] as const)("keeps %s gaps soft", condition => {
    const input = fixture();
    input.requirements[0]!.alternatives = [{ kind: "CONDITION", condition, outcome: "MISMATCH", evidence }];
    expect(screenJob(input).decision).toBe("DEPRIORITIZE");
  });
  it("does not exclude from incomplete JD review, even with a filtering finding", () => {
    const input = fixture();
    input.fullJdReviewed = false;
    input.tenureExclusions = [{ category: "SOFTWARE_ENGINEERING", minimumYears: 8, evidence }];
    expect(screenJob(input).decision).toBe("USER_CONFIRMATION_REQUIRED");
    expect(screenJob(input).missingMaterials).toEqual(["FULL_JD_REVIEW"]);
  });
  it("does not evaluate an empty extraction as a passing job", () => {
    const input = fixture(); input.requirements = [];
    expect(screenJob(input).decision).toBe("USER_CONFIRMATION_REQUIRED");
  });
  it("preserves a mandatory blocker even when another clause is met", () => {
    const input = fixture();
    input.tenureExclusions = [{ category: "SOFTWARE_ENGINEERING", minimumYears: 8, evidence }];
    input.requirements.push({ ...input.requirements[0]!, id: "r2", alternatives: [
      { kind: "CONDITION", condition: "LOCATION", outcome: "MATCH", evidence },
    ] });
    expect(screenJob(input).decision).toBe("FILTER");
  });
  it("rejects unsupported quotes, duplicate IDs and contradictory tenure bounds", () => {
    const input = fixture(); input.requirements[0]!.jdQuote = "not present";
    expect(() => screenJob(input)).toThrow("unsupported JD");
    const duplicate = fixture(); duplicate.requirements.push(duplicate.requirements[0]!);
    expect(() => screenJob(duplicate)).toThrow("Duplicate requirement");
    const bounds = fixture(); bounds.experience[0]!.upperYears = 1;
    expect(() => screenJob(bounds)).toThrow("inconsistent tenure bounds");
  });
  it("rejects unknown fields and ambiguous exclusion policies", () => {
    expect(() => screenJob({ ...fixture(), candidateDecision: "DISMISSED" })).toThrow("Invalid job screening");
    const input = fixture();
    input.tenureExclusions = [{ category: "AMBIGUOUS_ENGINEERING", minimumYears: 8, evidence }];
    expect(() => screenJob(input)).toThrow("explicit experience categories");
  });
  it("is deterministic and does not mutate input or invent a match grade", () => {
    const input = fixture(), before = structuredClone(input);
    expect(screenJob(input)).toEqual(screenJob(input));
    expect(input).toEqual(before);
    expect(screenJob(input).matchGrade).toBeNull();
  });
});
