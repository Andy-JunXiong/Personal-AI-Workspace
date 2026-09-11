import { z } from "zod";
import { ValidationError } from "./errors.js";

const text = (max: number) => z.string().trim().min(1).max(max);
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const version = z.number().int().positive();
export const assessmentManifestSchema = z.object({
  candidateHash: hash,
  jdHash: hash.nullable(),
  baseResume: z.object({ recordVersion: version, hash }).strict().nullable(),
  libraryHash: hash,
  selectedSourceIds: z.array(z.uuid()).max(100),
  sources: z.array(z.object({ id: z.uuid(), recordVersion: version, hash }).strict()).max(100),
}).strict();
export type AssessmentManifest = z.infer<typeof assessmentManifestSchema>;

export const candidateAssessmentReadSchema = z.object({
  includeAssessmentContext: z.boolean().default(false),
  sourceIds: z.array(z.uuid()).max(100).default([]),
  sourceOffset: z.number().int().min(0).default(0),
  assessmentVersion: version.optional(),
  historyBeforeVersion: version.optional(),
}).strict();

export const candidateAssessmentReportSchema = z.object({
  rubricVersion: z.literal("candidate-match-grades-v1"),
  grade: z.enum(["A+", "A", "A−", "B+", "B", "B−"]).nullable(),
  reason: text(1000),
  completeness: z.object({
    fullJdReviewed: z.boolean(),
    missingMaterials: z.array(text(500)).max(30),
    limitations: z.array(text(1000)).max(30),
  }).strict(),
  requirements: z.array(z.object({
    id: text(80), requirement: text(1000), jdQuote: text(1500),
    importance: z.enum(["REQUIRED", "PREFERRED"]),
    assessment: z.enum(["MATCH", "PARTIAL", "UNKNOWN"]),
    evidence: z.array(z.object({
      kind: z.enum(["BASE_RESUME", "LIBRARY_SOURCE"]),
      sourceId: z.uuid().nullable(), quote: text(2000),
    }).strict()).max(10),
    inference: text(1500),
  }).strict()).max(50),
  strengths: z.array(z.object({ requirementId: text(80), explanation: text(1000) }).strict()).max(50),
  gaps: z.array(z.object({ requirementId: text(80), explanation: text(1000) }).strict()).max(50),
  questions: z.array(z.object({ requirementId: text(80), explanation: text(1000) }).strict()).max(50),
  provenance: z.object({
    assessor: z.literal("CHATGPT"), reference: text(2000),
    generatedAt: z.iso.datetime(), model: text(200).nullable(),
  }).strict(),
}).strict();
export type CandidateAssessmentReport = z.infer<typeof candidateAssessmentReportSchema>;

export const recordCandidateAssessmentSchema = z.object({
  candidateId: z.uuid(), expectedCandidateVersion: version,
  expectedAssessmentVersion: z.number().int().min(0),
  inputManifest: assessmentManifestSchema,
  report: candidateAssessmentReportSchema,
  supersedesAssessmentId: z.uuid().nullable(),
  correction: z.object({ kind: z.literal("USER_STATEMENT"), statement: text(2000), reference: text(2000) }).strict().nullable(),
  userConfirmed: z.boolean(), authorityReference: text(1000), idempotencyKey: text(200),
}).strict();

export function parseAssessment<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError("Invalid candidate assessment input");
  return result.data;
}

// Search individual resume strings, not serialized JSON, so keys/JSON escapes
// cannot be cited as experience and evidence cannot cross unrelated fields.
export function resumeContains(value: unknown, quote: string): boolean {
  if (typeof value === "string") return value.includes(quote);
  if (Array.isArray(value)) return value.some(item => resumeContains(item, quote));
  if (value && typeof value === "object") return Object.values(value).some(item => resumeContains(item, quote));
  return false;
}

export function validateAssessmentEvidence(report: CandidateAssessmentReport, inputs: {
  jd: { text: string } | null;
  baseResume: { content: unknown } | null;
  sources: Array<{ id: string; content: string }>;
  missingMaterials: string[];
}) {
  if (report.grade !== null && (!report.completeness.fullJdReviewed ||
      report.completeness.missingMaterials.length || inputs.missingMaterials.length || !report.requirements.length)) {
    throw new ValidationError("A grade requires a reviewed full JD, base resume and complete assessment inputs");
  }
  const ids = new Set<string>(), labels = new Set<string>();
  for (const requirement of report.requirements) {
    const label = requirement.requirement.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ");
    if (ids.has(requirement.id) || labels.has(label)) throw new ValidationError("Duplicate assessment requirement");
    ids.add(requirement.id); labels.add(label);
    if (!inputs.jd?.text.includes(requirement.jdQuote)) throw new ValidationError("Requirement lacks exact JD evidence");
    if (requirement.assessment === "UNKNOWN" ? requirement.evidence.length > 0 : requirement.evidence.length === 0) {
      throw new ValidationError("Requirement evidence is inconsistent with its assessment");
    }
    for (const evidence of requirement.evidence) {
      const valid = evidence.kind === "BASE_RESUME"
        ? evidence.sourceId === null && resumeContains(inputs.baseResume?.content, evidence.quote)
        : evidence.sourceId !== null && inputs.sources.some(s => s.id === evidence.sourceId && s.content.includes(evidence.quote));
      if (!valid) throw new ValidationError("Assessment contains unsupported evidence");
    }
  }
  for (const item of [...report.strengths, ...report.gaps, ...report.questions]) {
    if (!ids.has(item.requirementId)) throw new ValidationError("Assessment conclusion references an unknown requirement");
  }
}
