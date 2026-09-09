import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const timestamp = z.iso.datetime({ offset: true });

// A Drive observation identifies a file/version. It does not establish submission.
export const applicationResumeSchema = z.object({
  contractVersion: z.literal("job-application-resume-v0.1"),
  supersedesResourceId: z.uuid().nullable(),
  sourceFacts: z.object({
    fileId: text(200).regex(/^[A-Za-z0-9_-]+$/u),
    fileName: text(500),
    mimeType: text(200),
    modifiedTime: timestamp.nullable(),
    revisionId: text(500).nullable(),
    revisionModifiedTime: timestamp.nullable(),
  }).strict(),
  interpretation: z.object({
    status: z.enum(["CANDIDATE", "CONFIRMED_FILE", "CONFIRMED_VERSION", "DISMISSED"]),
    reason: text(2000),
  }).strict(),
  confirmation: z.object({
    kind: z.enum(["USER_STATEMENT", "SUBMISSION_RECORD"]),
    reference: text(2000),
    statement: text(2000),
  }).strict().nullable(),
}).strict().superRefine((value, ctx) => {
  const confirmed = value.interpretation.status.startsWith("CONFIRMED_");
  if (confirmed !== (value.confirmation !== null)) {
    ctx.addIssue({ code: "custom", message: "Submission confirmation requires attributable evidence; candidates cannot claim confirmation" });
  }
  if (value.interpretation.status === "CONFIRMED_VERSION" && !value.sourceFacts.revisionId) {
    ctx.addIssue({ code: "custom", message: "Confirmed version requires a specific Drive revision" });
  }
});

export type ApplicationResume = z.infer<typeof applicationResumeSchema>;

export function isResumeFileUrl(value: string | null, fileId: string): boolean {
  try {
    const url = new URL(value ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    if (url.hostname === "drive.google.com") {
      return url.pathname === `/file/d/${fileId}/view` ||
        (url.pathname === "/open" && url.searchParams.get("id") === fileId);
    }
    return url.hostname === "docs.google.com" && url.pathname === `/document/d/${fileId}/edit`;
  } catch { return false; }
}
