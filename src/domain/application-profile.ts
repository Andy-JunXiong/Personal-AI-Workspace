import { z } from "zod";

// Saved analysis is explicit source content, never inferred from email status.
export const applicationProfileSchema = z.object({
  contractVersion: z.literal("job-application-profile-v0.1"),
  resumeVersion: z.string().trim().max(500).optional(),
  resumeText: z.string().trim().max(50000).optional(),
  skillMatchText: z.string().trim().max(50000).optional(),
  sourceReference: z.string().trim().max(2000).optional(),
  jobDescription: z.string().trim().min(1).max(50000).nullable(),
  skillMatch: z.object({
    summary: z.string().trim().min(1).max(5000),
    matches: z.array(z.object({
      requirement: z.string().trim().min(1).max(1000),
      evidence: z.string().trim().min(1).max(2000),
      assessment: z.enum(["MATCH", "PARTIAL", "GAP", "UNKNOWN"]),
    }).strict()).max(100),
    gaps: z.array(z.string().trim().min(1).max(1000)).max(100),
  }).strict().nullable(),
}).strict();
