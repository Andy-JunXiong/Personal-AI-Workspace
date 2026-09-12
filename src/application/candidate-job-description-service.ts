import { z } from "zod";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { IdentityContext } from "../domain/types.js";
import { canonicalHash, canonicalJson } from "../domain/canonical-json.js";
import { AuthorizationError, ConcurrencyConflictError, IdempotencyConflictError } from "../domain/errors.js";
import { parseAssessment } from "../domain/candidate-match-assessment.js";
import type { JobLibraryService } from "./job-library-service.js";
import type { JobSearchQueryService } from "./job-search-query-service.js";

export const recordCandidateJobDescriptionSchema = z.object({
  candidateId: z.uuid(),
  expectedCandidateVersion: z.number().int().min(1),
  expectedJdHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  text: z.string().trim().min(1).max(50000),
  sourceUrl: z.url().max(2000).refine(url => /^https?:\/\//i.test(url), "JD source must be an HTTP(S) URL"),
  fullTextProvided: z.boolean(),
  provenanceReference: z.string().trim().min(1).max(2000),
  userConfirmed: z.boolean(),
  authorityReference: z.string().trim().min(1).max(2000),
  idempotencyKey: z.string().trim().min(1).max(200),
}).strict();

const OPERATION = "workspace_record_candidate_job_description";
interface DescriptionReceipt {
  candidateId: string; candidateVersion: number; jdHash: string;
  jd: { text: string; sourceUrl: string };
  attribution: { principalId: string; channel: "MCP"; authorityReference: string;
    provenanceReference: string; fullTextProvided: true; recordedAt: string };
  replayed: boolean;
}

export class CandidateJobDescriptionService {
  constructor(private db: WorkspaceDatabase,
    private identity: () => IdentityContext & { channel: "MCP" | "WEB" },
    private candidates: JobSearchQueryService, private library: JobLibraryService,
    private clock = () => new Date()) {}

  record(input: unknown): DescriptionReceipt {
    const parsed = parseAssessment(recordCandidateJobDescriptionSchema, input), identity = this.identity();
    if (identity.channel !== "MCP" || !parsed.userConfirmed || !parsed.fullTextProvided) {
      throw new AuthorizationError("JD recording requires interactive MCP user authority and a complete-text assertion");
    }
    const requestHash = canonicalHash({ ...parsed, principalId: identity.principalId });
    return this.db.transaction(() => {
      // Check workspace ownership even for a replay; metadata creation is a separate command.
      const candidate = this.candidates.getCandidate(parsed.candidateId);
      const prior = this.db.prepare("SELECT request_hash,response_json FROM idempotency_records WHERE workspace_id=? AND operation=? AND idempotency_key=?")
        .get(identity.workspaceId, OPERATION, parsed.idempotencyKey) as { request_hash: string; response_json: string } | undefined;
      if (prior) {
        if (prior.request_hash !== requestHash) throw new IdempotencyConflictError("Candidate JD idempotency conflict");
        return { ...JSON.parse(prior.response_json) as DescriptionReceipt, replayed: true };
      }
      const old = this.library.description(candidate.id);
      // Same representation as assessment inputManifest.jdHash, including source URL.
      const currentHash = old?.jd_text.trim() ? canonicalHash({ text: old.jd_text, sourceUrl: old.source_url }) : null;
      if (candidate.recordVersion !== parsed.expectedCandidateVersion || currentHash !== parsed.expectedJdHash) {
        throw new ConcurrencyConflictError("Candidate or JD changed; reread candidate assessment context before saving");
      }
      this.library.saveDescription(candidate.id, parsed.text, parsed.sourceUrl);
      const jd = { text: parsed.text, sourceUrl: parsed.sourceUrl };
      const receipt: DescriptionReceipt = { candidateId: candidate.id, candidateVersion: candidate.recordVersion,
        jdHash: canonicalHash(jd), jd, attribution: { principalId: identity.principalId, channel: "MCP",
          authorityReference: parsed.authorityReference, provenanceReference: parsed.provenanceReference,
          fullTextProvided: true, recordedAt: this.clock().toISOString() }, replayed: false };
      // Preserve the exact admitted snapshot and provenance atomically with the write.
      this.db.prepare("INSERT INTO idempotency_records(workspace_id,operation,idempotency_key,request_hash,response_json,created_at) VALUES(?,?,?,?,?,?)")
        .run(identity.workspaceId, OPERATION, parsed.idempotencyKey, requestHash, canonicalJson(receipt), receipt.attribution.recordedAt);
      return receipt;
    })();
  }
}
