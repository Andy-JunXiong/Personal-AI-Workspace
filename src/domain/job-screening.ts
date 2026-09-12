import { z } from "zod";
import { ValidationError } from "./errors.js";

export const SCREENING_RULE_VERSION = "job-screening-v1";
const text = z.string().trim().min(1).max(4000);
const category = z.enum(["PROFESSIONAL", "TECHNOLOGY_DELIVERY", "SOFTWARE_ENGINEERING",
  "AI_ML_ENGINEERING", "DIRECT_PEOPLE_MANAGEMENT", "AMBIGUOUS_ENGINEERING"]);
const years = z.number().finite().min(0).max(80);
const evidence = z.object({ statement: text, reference: text }).strict();
const option = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("EXPERIENCE"), category, minimumYears: years }).strict(),
  z.object({ kind: z.literal("CONDITION"), condition: z.enum([
    "LOCATION", "WORK_RIGHTS", "CLEARANCE", "SPECIALIST_DIRECTION", "QUALIFICATION", "TOOL", "COMPENSATION",
  ]), outcome: z.enum(["MATCH", "MISMATCH", "UNKNOWN"]),
  evidence: evidence.nullable() }).strict(),
]);

export const jobScreeningInputSchema = z.object({
  jd: z.string().trim().min(1).max(600_000), fullJdReviewed: z.boolean(), profileVersion: z.number().int().positive(),
  // lowerYears is evidenced tenure, not a claim that no additional experience exists.
  experience: z.array(z.object({ category, lowerYears: years, upperYears: years.nullable(), evidence }).strict()).max(6),
  // Explicit screening preferences may reject a tenure requirement without claiming
  // the person lacks that tenure. No user-specific profile is embedded in source.
  tenureExclusions: z.array(z.object({ category, minimumYears: years, evidence }).strict()).max(6),
  requirements: z.array(z.object({
    id: text.max(100), jdQuote: text, importance: z.enum(["REQUIRED", "PREFERRED", "UNKNOWN"]),
    interpretation: text,
    // One clause is an OR group. Distinct clauses are AND requirements.
    alternatives: z.array(option).min(1).max(10),
  }).strict()).max(100),
}).strict();
export type JobScreeningInput = z.infer<typeof jobScreeningInputSchema>;
export type ScreeningDecision = "FILTER" | "DEPRIORITIZE" | "EVALUATE" | "USER_CONFIRMATION_REQUIRED";
type Finding = {
  decision: ScreeningDecision; rule: string; reason: string;
  basis: "FACT" | "PREFERENCE" | "UNKNOWN"; candidateEvidence: z.infer<typeof evidence> | null;
};

function finding(decision: ScreeningDecision, rule: string, reason: string,
  basis: Finding["basis"], candidateEvidence: Finding["candidateEvidence"] = null): Finding {
  return { decision, rule, reason, basis, candidateEvidence };
}

function evaluateOption(item: z.infer<typeof option>, input: JobScreeningInput): Finding {
  if (item.kind === "CONDITION") {
    if (item.outcome === "UNKNOWN") return finding("USER_CONFIRMATION_REQUIRED", "MISSING_EVIDENCE",
      "Candidate information is unknown; absence of evidence is not a mismatch.", "UNKNOWN");
    if (!item.evidence) throw new ValidationError("Known condition outcomes require attributable candidate evidence");
    if (item.outcome === "MATCH") return finding("EVALUATE", "CONDITION_MET", "Condition supported by supplied evidence.", "FACT", item.evidence);
    if (item.condition === "TOOL" || item.condition === "COMPENSATION") {
      return finding("DEPRIORITIZE", "SOFT_GAP", "Tool and compensation gaps do not automatically exclude a job.", "FACT", item.evidence);
    }
    return finding("FILTER", "HARD_CONDITION_MISMATCH", "Required condition conflicts with supplied candidate evidence.", "FACT", item.evidence);
  }
  if (item.category === "AMBIGUOUS_ENGINEERING") return finding("USER_CONFIRMATION_REQUIRED", "AMBIGUOUS_EXPERIENCE",
    "Clarify what engineering means; do not substitute total professional tenure.", "UNKNOWN");
  const exclusion = input.tenureExclusions.find(rule => rule.category === item.category && item.minimumYears >= rule.minimumYears);
  if (exclusion) return finding("FILTER", "USER_TENURE_PREFERENCE",
    "Requirement meets an explicit user screening exclusion; this is not a claim of missing capability.", "PREFERENCE", exclusion.evidence);
  const fact = input.experience.find(entry => entry.category === item.category);
  if (fact && fact.lowerYears >= item.minimumYears) return finding("EVALUATE", "TENURE_SUPPORTED",
    "Evidence supports the required years in the same experience category.", "FACT", fact.evidence);
  if (!fact || fact.upperYears === null || fact.upperYears >= item.minimumYears) return finding("USER_CONFIRMATION_REQUIRED", "TENURE_UNKNOWN",
    "Verified years are insufficient to establish either satisfaction or a confirmed shortfall.", "UNKNOWN", fact?.evidence ?? null);
  const hardTenure = (item.category === "SOFTWARE_ENGINEERING" && item.minimumYears >= 8) ||
    (item.category === "AI_ML_ENGINEERING" && item.minimumYears >= 5) ||
    (item.category === "DIRECT_PEOPLE_MANAGEMENT" && item.minimumYears >= 3);
  return finding(hardTenure ? "FILTER" : "DEPRIORITIZE", "CONFIRMED_TENURE_SHORTFALL",
    "A confirmed upper bound is below the required tenure in this category.", "FACT", fact.evidence);
}

export function screenJob(value: unknown) {
  const parsed = jobScreeningInputSchema.safeParse(value);
  if (!parsed.success) throw new ValidationError("Invalid job screening input");
  const input = parsed.data;
  const categories = new Set<string>();
  for (const fact of input.experience) {
    if (categories.has(fact.category) || (fact.upperYears !== null && fact.upperYears < fact.lowerYears)) {
      throw new ValidationError("Duplicate experience category or inconsistent tenure bounds");
    }
    categories.add(fact.category);
  }
  const exclusions = new Set<string>();
  for (const rule of input.tenureExclusions) {
    if (rule.category === "AMBIGUOUS_ENGINEERING" || exclusions.has(rule.category)) {
      throw new ValidationError("Tenure exclusions require distinct, explicit experience categories");
    }
    exclusions.add(rule.category);
  }
  const ids = new Set<string>();
  const findings = input.requirements.map(requirement => {
    if (ids.has(requirement.id) || !input.jd.includes(requirement.jdQuote)) {
      throw new ValidationError("Duplicate requirement or unsupported JD quotation");
    }
    ids.add(requirement.id);
    const alternatives = requirement.alternatives.map(item => evaluateOption(item, input));
    // An acceptable alternative prevents another branch from incorrectly excluding
    // 'software engineering OR technical consulting' requirements.
    const selected = alternatives.find(item => item.decision === "EVALUATE") ??
      alternatives.find(item => item.decision === "USER_CONFIRMATION_REQUIRED") ??
      alternatives.find(item => item.decision === "DEPRIORITIZE") ?? alternatives[0]!;
    let result = selected;
    if (requirement.importance === "PREFERRED" && selected.decision !== "EVALUATE") {
      result = { ...selected, decision: "DEPRIORITIZE", rule: "PREFERRED_ONLY",
        reason: "A preferred requirement cannot be a hard filter or require personal confirmation." };
    } else if (requirement.importance === "UNKNOWN" && selected.decision !== "EVALUATE") {
      result = { ...selected, decision: "USER_CONFIRMATION_REQUIRED", rule: "IMPORTANCE_UNKNOWN",
        reason: "Clarify whether this is mandatory before excluding the job." };
    }
    return { requirementId: requirement.id, jdQuote: requirement.jdQuote,
      importance: requirement.importance, interpretation: requirement.interpretation, ...result, alternatives };
  });
  const decision: ScreeningDecision = !input.fullJdReviewed || !findings.length ? "USER_CONFIRMATION_REQUIRED"
    : findings.some(item => item.decision === "FILTER") ? "FILTER"
    : findings.some(item => item.decision === "USER_CONFIRMATION_REQUIRED") ? "USER_CONFIRMATION_REQUIRED"
    : findings.some(item => item.decision === "DEPRIORITIZE") ? "DEPRIORITIZE" : "EVALUATE";
  return { ruleVersion: SCREENING_RULE_VERSION, profileVersion: input.profileVersion, decision, findings,
    missingMaterials: !input.fullJdReviewed ? ["FULL_JD_REVIEW"] : !findings.length ? ["EXTRACTED_REQUIREMENTS"] : [],
    recoverable: true as const, matchGrade: null,
    limitations: ["Structured JD interpretations and supplied profile evidence require upstream validation.",
      "This pure evaluator does not persist decisions, hide candidates or grant mutation authority."] };
}
