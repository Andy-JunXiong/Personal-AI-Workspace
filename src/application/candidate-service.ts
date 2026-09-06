import { randomUUID } from "node:crypto";
import { canonicalHash, canonicalJson } from "../domain/canonical-json.js";
import {
  AuthorizationError,
  ConcurrencyConflictError,
  IdempotencyConflictError,
  NotFoundError,
  ValidationError,
} from "../domain/errors.js";
import type {
  CandidateDecision,
  CandidateDecisionAction,
  ExplicitUserDevAuthority,
  FitUncertainty,
  IdentityContext,
  JobCandidateRecord,
  SourceAvailability,
} from "../domain/types.js";
import type { WorkspaceDatabase } from "../persistence/database.js";

export type Clock = () => Date;

interface CandidateCommandContext extends IdentityContext {
  channel: "WEB" | "MCP";
}

interface ExplicitUserWebAuthority {
  type: "EXPLICIT_USER_WEB";
  reference: string;
}

type CandidateMutationAuthority = ExplicitUserDevAuthority | ExplicitUserWebAuthority;

export interface CandidateRow {
  id: string;
  workspace_id: string;
  provider: string;
  posting_id: string | null;
  source_url: string | null;
  title: string;
  company: string;
  role: string;
  location: string | null;
  fit_reason: string | null;
  fit_uncertainty: FitUncertainty;
  source_availability: SourceAvailability;
  decision: CandidateDecision;
  record_version: number;
  decision_at: string | null;
  linked_project_id: string | null;
  linked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface IdempotencyRow {
  request_hash: string;
  response_json: string;
}

interface ReplayableResult {
  replayed: boolean;
}

export interface RecordCandidateInput {
  provider: string;
  postingId?: string | null;
  sourceUrl?: string | null;
  title: string;
  company: string;
  role: string;
  location?: string | null;
  fitReason?: string | null;
  fitUncertainty?: FitUncertainty;
  sourceAvailability?: SourceAvailability;
  authority: ExplicitUserDevAuthority;
  idempotencyKey: string;
}

export interface DecideCandidateInput {
  candidateId: string;
  action: CandidateDecisionAction;
  expectedRecordVersion: number;
  authority: CandidateMutationAuthority;
  idempotencyKey: string;
}

const FIT_UNCERTAINTIES: readonly FitUncertainty[] = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"];
const SOURCE_AVAILABILITIES: readonly SourceAvailability[] = ["AVAILABLE", "UNAVAILABLE", "UNKNOWN"];
const DECISION_ACTIONS: readonly CandidateDecisionAction[] = ["SAVE", "DISMISS", "RESTORE"];

const ACTION_TARGET: Record<CandidateDecisionAction, CandidateDecision> = {
  SAVE: "SAVED",
  DISMISS: "DISMISSED",
  RESTORE: "UNREVIEWED",
};

export class CandidateService {
  constructor(
    private readonly database: WorkspaceDatabase,
    private readonly resolveContext: () => CandidateCommandContext,
    private readonly clock: Clock = () => new Date(),
    private readonly assertMutationAllowed: () => void = () => {},
  ) {}

  recordCandidate(input: RecordCandidateInput): {
    candidate: JobCandidateRecord;
    created: boolean;
    changed: boolean;
    replayed: boolean;
  } {
    this.assertMutationAllowed();
    const context = this.resolveContext();
    const authorityReference = validateAuthority(input.authority, context.channel);
    const provider = input.provider.trim();
    if (!provider) throw new ValidationError("Candidate provider is required");
    if (provider.length > 100) {
      throw new ValidationError("Candidate provider must be at most 100 characters");
    }
    const postingId = normalizeNullableText(input.postingId, 500);
    const sourceUrl = normalizeNullableText(input.sourceUrl, 2_000);
    if (postingId === null && sourceUrl === null) {
      throw new ValidationError("Candidate postingId or sourceUrl is required");
    }
    if (sourceUrl !== null && !isHttpUrl(sourceUrl)) {
      throw new ValidationError("Candidate sourceUrl must be a valid http(s) URL");
    }
    const title = input.title.trim();
    if (!title) throw new ValidationError("Candidate title is required");
    if (title.length > 500) {
      throw new ValidationError("Candidate title must be at most 500 characters");
    }
    const company = input.company.trim();
    if (!company) throw new ValidationError("Candidate company is required");
    if (company.length > 500) {
      throw new ValidationError("Candidate company must be at most 500 characters");
    }
    const role = input.role.trim();
    if (!role) throw new ValidationError("Candidate role is required");
    if (role.length > 500) {
      throw new ValidationError("Candidate role must be at most 500 characters");
    }
    const location = normalizeNullableText(input.location, 500);
    const fitReason = normalizeNullableText(input.fitReason, 2_000);
    const fitUncertainty = input.fitUncertainty ?? "UNKNOWN";
    if (!FIT_UNCERTAINTIES.includes(fitUncertainty)) {
      throw new ValidationError(`Unsupported fitUncertainty: ${fitUncertainty}`);
    }
    const sourceAvailability = input.sourceAvailability ?? "UNKNOWN";
    if (!SOURCE_AVAILABILITIES.includes(sourceAvailability)) {
      throw new ValidationError(`Unsupported sourceAvailability: ${sourceAvailability}`);
    }

    const payload = {
      provider,
      postingId,
      sourceUrl,
      title,
      company,
      role,
      location,
      fitReason,
      fitUncertainty,
      sourceAvailability,
      authority: authorityPayload(input.authority, authorityReference),
    };

    return this.runIdempotent(
      context.workspaceId,
      "workspace_record_candidate",
      input.idempotencyKey,
      payload,
      () => {
        const existing = this.findMatchingCandidate(
          context.workspaceId,
          provider,
          postingId,
          sourceUrl,
        );
        if (existing) {
          const changed =
            existing.company !== company ||
            existing.role !== role ||
            existing.title !== title ||
            existing.location !== location ||
            existing.fitReason !== fitReason ||
            existing.fitUncertainty !== fitUncertainty ||
            existing.sourceAvailability !== sourceAvailability;
          if (!changed) {
            return { candidate: existing, created: false, changed: false, replayed: false };
          }
          const now = this.clock().toISOString();
          this.database
            .prepare(
              `UPDATE job_candidates
               SET title = ?, company = ?, role = ?, location = ?, fit_reason = ?,
                   fit_uncertainty = ?, source_availability = ?,
                   record_version = record_version + 1, updated_at = ?
               WHERE id = ? AND workspace_id = ?`,
            )
            .run(
              title,
              company,
              role,
              location,
              fitReason,
              fitUncertainty,
              sourceAvailability,
              now,
              existing.id,
              context.workspaceId,
            );
          return {
            candidate: this.getCandidate(existing.id, context.workspaceId),
            created: false,
            changed: true,
            replayed: false,
          };
        }

        const id = randomUUID();
        const now = this.clock().toISOString();
        this.database
          .prepare(
            `INSERT INTO job_candidates(
               id, workspace_id, provider, posting_id, source_url, title, company,
               role, location, fit_reason, fit_uncertainty, source_availability,
               decision, record_version, decision_at, linked_project_id, linked_at,
               created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNREVIEWED', 1,
                       NULL, NULL, NULL, ?, ?)`,
          )
          .run(
            id,
            context.workspaceId,
            provider,
            postingId,
            sourceUrl,
            title,
            company,
            role,
            location,
            fitReason,
            fitUncertainty,
            sourceAvailability,
            now,
            now,
          );
        return {
          candidate: this.getCandidate(id, context.workspaceId),
          created: true,
          changed: true,
          replayed: false,
        };
      },
    );
  }

  decideCandidate(input: DecideCandidateInput): {
    candidate: JobCandidateRecord;
    changed: boolean;
    replayed: boolean;
  } {
    const context = this.resolveContext();
    const authorityReference = validateAuthority(input.authority, context.channel);
    if (input.authority.type === "EXPLICIT_USER_DEV") this.assertMutationAllowed();
    if (!DECISION_ACTIONS.includes(input.action)) {
      throw new ValidationError(`Unsupported candidate action: ${input.action}`);
    }
    if (!Number.isInteger(input.expectedRecordVersion) || input.expectedRecordVersion < 1) {
      throw new ValidationError("expectedRecordVersion must be a positive integer");
    }

    const payload = {
      candidateId: input.candidateId,
      action: input.action,
      expectedRecordVersion: input.expectedRecordVersion,
      authority: authorityPayload(input.authority, authorityReference),
    };

    // Ownership is checked before idempotency lookup so a replay never bypasses
    // the current request identity.
    this.getCandidate(input.candidateId, context.workspaceId);

    return this.runIdempotent(
      context.workspaceId,
      "workspace_decide_candidate",
      input.idempotencyKey,
      payload,
      () => {
        const current = this.getCandidate(input.candidateId, context.workspaceId);
        if (current.recordVersion !== input.expectedRecordVersion) {
          throw new ConcurrencyConflictError(
            `Expected candidate record version ${input.expectedRecordVersion}, current version is ${current.recordVersion}`,
          );
        }

        const target = ACTION_TARGET[input.action];
        const changed = current.decision !== target;
        if (!changed) {
          const result = { candidate: current, changed: false, replayed: false };
          this.writeDecisionAudit({
            context,
            candidateId: current.id,
            action: input.action,
            from: current.decision,
            to: current.decision,
            authority: input.authority,
            authorityReference,
            recordVersion: current.recordVersion,
          });
          return result;
        }

        const now = this.clock().toISOString();
        const decisionAt = target === "UNREVIEWED" ? null : now;
        const update = this.database
          .prepare(
            `UPDATE job_candidates
             SET decision = ?, decision_at = ?, record_version = record_version + 1,
                 updated_at = ?
             WHERE id = ? AND workspace_id = ? AND record_version = ?`,
          )
          .run(
            target,
            decisionAt,
            now,
            input.candidateId,
            context.workspaceId,
            input.expectedRecordVersion,
          );
        if (update.changes !== 1) {
          throw new ConcurrencyConflictError(
            "Concurrent candidate decision prevented this change",
          );
        }

        const result = {
          candidate: this.getCandidate(input.candidateId, context.workspaceId),
          changed: true,
          replayed: false,
        };
        this.writeDecisionAudit({
          context,
          candidateId: current.id,
          action: input.action,
          from: current.decision,
          to: target,
          authority: input.authority,
          authorityReference,
          recordVersion: result.candidate.recordVersion,
        });
        return result;
      },
    );
  }

  private writeDecisionAudit(input: {
    context: CandidateCommandContext;
    candidateId: string;
    action: CandidateDecisionAction;
    from: CandidateDecision;
    to: CandidateDecision;
    authority: CandidateMutationAuthority;
    authorityReference: string;
    recordVersion: number;
  }): void {
    this.database
      .prepare(
        `INSERT INTO candidate_decisions(
           id, workspace_id, candidate_id, action, from_decision, to_decision,
           channel, principal_id, authority_type, authority_reference,
           record_version, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        input.context.workspaceId,
        input.candidateId,
        input.action,
        input.from,
        input.to,
        input.context.channel,
        input.context.principalId,
        input.authority.type,
        input.authorityReference,
        input.recordVersion,
        this.clock().toISOString(),
      );
  }

  private getCandidate(candidateId: string, workspaceId: string): JobCandidateRecord {
    const row = this.database
      .prepare("SELECT * FROM job_candidates WHERE id = ? AND workspace_id = ?")
      .get(candidateId, workspaceId) as CandidateRow | undefined;
    if (!row) throw new NotFoundError(`Candidate ${candidateId} was not found`);
    return mapCandidateRow(row);
  }

  private findMatchingCandidate(
    workspaceId: string,
    provider: string,
    postingId: string | null,
    sourceUrl: string | null,
  ): JobCandidateRecord | null {
    let byPosting: CandidateRow | undefined;
    let byUrl: CandidateRow | undefined;
    if (postingId !== null) {
      byPosting = this.database
        .prepare(
          "SELECT * FROM job_candidates WHERE workspace_id = ? AND provider = ? AND posting_id = ?",
        )
        .get(workspaceId, provider, postingId) as CandidateRow | undefined;
    }
    if (sourceUrl !== null) {
      byUrl = this.database
        .prepare("SELECT * FROM job_candidates WHERE workspace_id = ? AND source_url = ?")
        .get(workspaceId, sourceUrl) as CandidateRow | undefined;
    }
    if (byPosting && byUrl && byPosting.id !== byUrl.id) {
      throw new ValidationError(
        "Candidate identity matches two different records; resolve before re-recording",
      );
    }
    const row = byPosting ?? byUrl;
    return row ? mapCandidateRow(row) : null;
  }

  private runIdempotent<T extends ReplayableResult>(
    workspaceId: string,
    operation: string,
    idempotencyKey: string,
    payload: unknown,
    work: () => T,
  ): T {
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new ValidationError("idempotencyKey is required");

    return this.database.transaction(() => {
      const existing = this.database
        .prepare(
          `SELECT request_hash, response_json FROM idempotency_records
           WHERE workspace_id = ? AND operation = ? AND idempotency_key = ?`,
        )
        .get(workspaceId, operation, normalizedKey) as IdempotencyRow | undefined;
      const requestHash = canonicalHash(payload);
      if (existing) {
        if (existing.request_hash !== requestHash) {
          throw new IdempotencyConflictError(
            "The idempotency key was already used with a different payload",
          );
        }
        const replayed = JSON.parse(existing.response_json) as T;
        return { ...replayed, replayed: true };
      }

      const result = work();
      this.database
        .prepare(
          `INSERT INTO idempotency_records(
             workspace_id, operation, idempotency_key, request_hash,
             response_json, created_at
           ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          workspaceId,
          operation,
          normalizedKey,
          requestHash,
          canonicalJson(result),
          this.clock().toISOString(),
        );
      return result;
    })();
  }
}

export function mapCandidateRow(row: CandidateRow): JobCandidateRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    postingId: row.posting_id,
    sourceUrl: row.source_url,
    title: row.title,
    company: row.company,
    role: row.role,
    location: row.location,
    fitReason: row.fit_reason,
    fitUncertainty: row.fit_uncertainty,
    sourceAvailability: row.source_availability,
    decision: row.decision,
    recordVersion: row.record_version,
    decisionAt: row.decision_at,
    linkedProjectId: row.linked_project_id,
    linkedAt: row.linked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateAuthority(
  authority: CandidateMutationAuthority,
  channel: "WEB" | "MCP",
): string {
  const reference = authority.reference.trim();
  const validDevelopment =
    authority.type === "EXPLICIT_USER_DEV" && authority.confirmed && channel === "MCP";
  const validWeb = authority.type === "EXPLICIT_USER_WEB" && channel === "WEB";
  if ((!validDevelopment && !validWeb) || !reference) {
    throw new AuthorizationError("Candidate mutation requires explicit user authority");
  }
  return reference;
}

function authorityPayload(authority: CandidateMutationAuthority, reference: string) {
  return authority.type === "EXPLICIT_USER_DEV"
    ? { type: authority.type, confirmed: authority.confirmed, reference }
    : { type: authority.type, reference };
}

function normalizeNullableText(
  value: string | null | undefined,
  max: number,
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw new ValidationError(`Value must be at most ${max} characters`);
  }
  return trimmed;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
