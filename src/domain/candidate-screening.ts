import { z } from "zod";
import { assessmentManifestSchema } from "./candidate-match-assessment.js";
import { jobScreeningInputSchema, type ScreeningDecision } from "./job-screening.js";

const text = z.string().trim().min(1).max(2000);
const version = z.number().int().min(0);
const command = {
  candidateId: z.uuid(), expectedCandidateVersion: z.number().int().positive(),
  expectedScreeningVersion: version, userConfirmed: z.boolean(),
  authorityReference: text, idempotencyKey: z.string().trim().min(1).max(200),
};
export const recordScreeningSchema = z.object({
  ...command, inputManifest: assessmentManifestSchema, profileSourceId: z.uuid(),
  input: jobScreeningInputSchema.omit({ jd: true }), reason: text, provenanceReference: text,
}).strict();
export const overrideScreeningSchema = z.object({
  ...command, expectedOverrideVersion: version, mode: z.enum(["KEEP", "AUTOMATIC"]), reason: text,
}).strict();
export const screeningReadSchema = z.object({
  version: z.number().int().positive().optional(), beforeVersion: z.number().int().positive().optional(),
  overrideBeforeVersion: z.number().int().positive().optional(),
}).strict();

export interface CandidateScreeningSummary {
  status: "UNSCREENED" | "CURRENT" | "STALE";
  recordVersion: number; id: string | null; decision: ScreeningDecision | null;
  reason: string | null; hidden: boolean; staleReasons: string[];
  overrideVersion: number; overrideMode: "KEEP" | "AUTOMATIC";
  savedByUser: boolean;
}
