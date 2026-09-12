import { z } from "zod";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { IdentityContext } from "../domain/types.js";
import { canonicalHash, canonicalJson } from "../domain/canonical-json.js";
import { AuthorizationError, ConcurrencyConflictError, IdempotencyConflictError, ValidationError } from "../domain/errors.js";
import { parseAssessment } from "../domain/candidate-match-assessment.js";
import type { JobLibraryService, LibrarySource } from "./job-library-service.js";

export const recordScreeningProfileSchema = z.object({
  content: z.string().trim().min(1).max(50000),
  expectedProfileVersion: z.number().int().min(0),
  userConfirmed: z.boolean(),
  authorityReference: z.string().trim().min(1).max(2000),
  idempotencyKey: z.string().trim().min(1).max(200),
}).strict();

const SOURCE_KEY = "screening:confirmed-profile";
const OPERATION = "workspace_record_screening_profile";
interface ProfileReceipt {
  sourceId: string; recordVersion: number; hash: string; reviewStatus: "CONFIRMED";
  source: LibrarySource;
  confirmation: { principalId: string; channel: "MCP"; authorityReference: string; confirmedAt: string };
  replayed: boolean;
}

export class ScreeningProfileService {
  constructor(private db: WorkspaceDatabase,
    private identity: () => IdentityContext & { channel: "MCP" | "WEB" },
    private library: JobLibraryService, private clock = () => new Date()) {}

  record(input: unknown): ProfileReceipt {
    const parsed = parseAssessment(recordScreeningProfileSchema, input), identity = this.identity();
    if (identity.channel !== "MCP" || !parsed.userConfirmed) {
      throw new AuthorizationError("Screening profile requires explicit interactive MCP user confirmation");
    }
    const requestHash = canonicalHash({ ...parsed, principalId: identity.principalId });
    return this.db.transaction(() => {
      const prior = this.db.prepare("SELECT request_hash,response_json FROM idempotency_records WHERE workspace_id=? AND operation=? AND idempotency_key=?")
        .get(identity.workspaceId, OPERATION, parsed.idempotencyKey) as { request_hash: string; response_json: string } | undefined;
      if (prior) {
        if (prior.request_hash !== requestHash) throw new IdempotencyConflictError("Screening profile idempotency conflict");
        // Return the original confirmation receipt; callers must reread current context.
        return { ...JSON.parse(prior.response_json) as ProfileReceipt, replayed: true };
      }
      const old = this.library.sources().find(source => source.source_key === SOURCE_KEY);
      if ((old?.record_version ?? 0) !== parsed.expectedProfileVersion) {
        throw new ConcurrencyConflictError("Screening profile version changed; reread candidate sourceDirectory and selected source before confirming again");
      }
      const saved = this.library.saveSource({ sourceKey: SOURCE_KEY, title: "User-confirmed screening profile",
        content: parsed.content, sourceUrl: null, reviewStatus: "CONFIRMED", expectedVersion: parsed.expectedProfileVersion });
      const source = this.library.snapshot().sources.find(item => item.id === saved.id);
      if (!source) throw new ValidationError("An identical curated source already exists; review the existing confirmed source instead");
      const receipt: ProfileReceipt = { sourceId: saved.id, recordVersion: saved.recordVersion,
        hash: canonicalHash(source), reviewStatus: "CONFIRMED", source,
        confirmation: { principalId: identity.principalId, channel: "MCP", authorityReference: parsed.authorityReference,
          confirmedAt: this.clock().toISOString() }, replayed: false };
      // Existing durable command receipts retain the confirmed content and attribution
      // atomically with the library write, including snapshots preceding later edits.
      this.db.prepare("INSERT INTO idempotency_records(workspace_id,operation,idempotency_key,request_hash,response_json,created_at) VALUES(?,?,?,?,?,?)")
        .run(identity.workspaceId, OPERATION, parsed.idempotencyKey, requestHash, canonicalJson(receipt), receipt.confirmation.confirmedAt);
      return receipt;
    })();
  }
}
