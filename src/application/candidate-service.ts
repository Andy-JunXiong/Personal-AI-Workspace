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
  CoverageStatus,
  DeliveryStatus,
  ExplicitUserDevAuthority,
  FitUncertainty,
  IdentityContext,
  JobCandidateRecord,
  RecommendationRunDetails,
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

export interface LinkCandidateApplicationInput {
  candidateId: string;
  projectId: string;
  authority: CandidateMutationAuthority;
  idempotencyKey: string;
}

export interface DecideCandidateFromWebInput {
  candidateId: string;
  action: CandidateDecisionAction;
  expectedRecordVersion: number;
  intentKey: string;
}

export interface LinkCandidateFromWebInput {
  candidateId: string;
  projectId: string;
  intentKey: string;
}

export interface RecommendationRunItemInput {
  position?: number;
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
}

export interface RecordRecommendationRunInput {
  provider: string;
  runAt?: string;
  runReference?: string | null;
  coverageStatus: CoverageStatus;
  deliveryStatus: DeliveryStatus;
  coverageNote?: string | null;
  retentionUntil?: string | null;
  items: RecommendationRunItemInput[];
  authority: ExplicitUserDevAuthority;
  idempotencyKey: string;
}

interface NormalizedCandidateFields {
  provider: string;
  postingId: string | null;
  sourceUrl: string | null;
  title: string;
  company: string;
  role: string;
  location: string | null;
  fitReason: string | null;
  fitUncertainty: FitUncertainty;
  sourceAvailability: SourceAvailability;
}

const FIT_UNCERTAINTIES: readonly FitUncertainty[] = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"];
const SOURCE_AVAILABILITIES: readonly SourceAvailability[] = ["AVAILABLE", "UNAVAILABLE", "UNKNOWN"];
const DECISION_ACTIONS: readonly CandidateDecisionAction[] = ["SAVE", "DISMISS", "RESTORE"];
const COVERAGE_STATUSES: readonly CoverageStatus[] = ["COMPLETE", "PARTIAL", "FAILED", "UNKNOWN"];
const DELIVERY_STATUSES: readonly DeliveryStatus[] = ["DELIVERED", "ATTEMPTED", "UNKNOWN"];
const MAX_RUN_ITEMS = 100;
const RECOMMENDATION_RUN_RETENTION_DAYS = 90;

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
    const fields = this.normalizeCandidateFields(input);

    const payload = {
      ...fields,
      authority: authorityPayload(input.authority, authorityReference),
    };

    return this.runIdempotent(
      context.workspaceId,
      "workspace_record_candidate",
      input.idempotencyKey,
      payload,
      () => ({ ...this.upsertCandidateRecord(context.workspaceId, fields), replayed: false }),
    );
  }

  recordRecommendationRun(input: RecordRecommendationRunInput): {
    run: RecommendationRunDetails;
    replayed: boolean;
  } {
    this.assertMutationAllowed();
    const context = this.resolveContext();
    const authorityReference = validateAuthority(input.authority, context.channel);
    const provider = input.provider.trim();
    if (!provider) throw new ValidationError("Recommendation provider is required");
    if (provider.length > 100) {
      throw new ValidationError("Recommendation provider must be at most 100 characters");
    }
    if (!COVERAGE_STATUSES.includes(input.coverageStatus)) {
      throw new ValidationError(`Unsupported coverageStatus: ${input.coverageStatus}`);
    }
    if (!DELIVERY_STATUSES.includes(input.deliveryStatus)) {
      throw new ValidationError(`Unsupported deliveryStatus: ${input.deliveryStatus}`);
    }
    if (input.items.length > MAX_RUN_ITEMS) {
      throw new ValidationError(`Recommendation run supports at most ${MAX_RUN_ITEMS} items`);
    }
    const runAt = normalizeRunAt(input.runAt ?? this.clock().toISOString());
    const runReference = normalizeNullableText(input.runReference, 500);
    const coverageNote = normalizeNullableText(input.coverageNote, 2_000);
    const retentionUntil = normalizeRetentionUntil(input.retentionUntil, runAt);
    const items = input.items.map((item, index) => ({
      position: item.position ?? index,
      fields: this.normalizeCandidateFields(item),
    }));

    const payload = {
      provider,
      runAt,
      runReference,
      coverageStatus: input.coverageStatus,
      deliveryStatus: input.deliveryStatus,
      coverageNote,
      retentionUntil,
      items: items.map((item) => ({ position: item.position, ...item.fields })),
      authority: authorityPayload(input.authority, authorityReference),
    };

    return this.runIdempotent(
      context.workspaceId,
      "workspace_record_recommendation_run",
      input.idempotencyKey,
      payload,
      () => {
        const runId = randomUUID();
        const recordedAt = this.clock().toISOString();
        // Upsert candidates first, deduplicating to a stable run-item set. The
        // candidate upsert never changes a decision or an application link.
        const runItems: Array<{
          candidateId: string;
          position: number;
          fitReason: string | null;
          fitUncertainty: FitUncertainty;
          sourceAvailability: SourceAvailability;
        }> = [];
        const seenCandidateIds = new Set<string>();
        for (const item of items) {
          const { candidate } = this.upsertCandidateRecord(context.workspaceId, item.fields);
          if (seenCandidateIds.has(candidate.id)) continue;
          seenCandidateIds.add(candidate.id);
          runItems.push({
            candidateId: candidate.id,
            position: item.position,
            fitReason: candidate.fitReason,
            fitUncertainty: candidate.fitUncertainty,
            sourceAvailability: candidate.sourceAvailability,
          });
        }

        this.database
          .prepare(
            `INSERT INTO recommendation_runs(
               id, workspace_id, provider, run_reference, run_at, coverage_status,
               delivery_status, coverage_note, item_count, retention_until, recorded_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            runId,
            context.workspaceId,
            provider,
            runReference,
            runAt,
            input.coverageStatus,
            input.deliveryStatus,
            coverageNote,
            runItems.length,
            retentionUntil,
            recordedAt,
          );

        const insertItem = this.database.prepare(
          `INSERT INTO recommendation_run_items(
             run_id, candidate_id, position, fit_reason, fit_uncertainty, source_availability
           ) VALUES (?, ?, ?, ?, ?, ?)`,
        );
        for (const item of runItems) {
          insertItem.run(
            runId,
            item.candidateId,
            item.position,
            item.fitReason,
            item.fitUncertainty,
            item.sourceAvailability,
          );
        }

        return {
          run: {
            id: runId,
            workspaceId: context.workspaceId,
            provider,
            runReference,
            runAt,
            coverageStatus: input.coverageStatus,
            deliveryStatus: input.deliveryStatus,
            coverageNote,
            itemCount: runItems.length,
            retentionUntil,
            recordedAt,
            items: runItems.map((item) => ({
              candidateId: item.candidateId,
              position: item.position,
              fitReason: item.fitReason,
              fitUncertainty: item.fitUncertainty,
              sourceAvailability: item.sourceAvailability,
            })),
          },
          replayed: false,
        };
      },
    );
  }

  private normalizeCandidateFields(input: {
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
  }): NormalizedCandidateFields {
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
    return {
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
    };
  }

  private upsertCandidateRecord(
    workspaceId: string,
    fields: NormalizedCandidateFields,
  ): { candidate: JobCandidateRecord; created: boolean; changed: boolean } {
    const { provider, postingId, sourceUrl, title, company, role, location, fitReason, fitUncertainty, sourceAvailability } = fields;
    const existing = this.findMatchingCandidate(workspaceId, provider, postingId, sourceUrl);
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
        return { candidate: existing, created: false, changed: false };
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
          workspaceId,
        );
      return {
        candidate: this.getCandidate(existing.id, workspaceId),
        created: false,
        changed: true,
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
        workspaceId,
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
      candidate: this.getCandidate(id, workspaceId),
      created: true,
      changed: true,
    };
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

  linkCandidateToApplication(input: LinkCandidateApplicationInput): {
    candidate: JobCandidateRecord;
    changed: boolean;
    replayed: boolean;
  } {
    const context = this.resolveContext();
    const authorityReference = validateAuthority(input.authority, context.channel);
    if (input.authority.type === "EXPLICIT_USER_DEV") this.assertMutationAllowed();

    const payload = {
      candidateId: input.candidateId,
      projectId: input.projectId,
      authority: authorityPayload(input.authority, authorityReference),
    };

    // Ownership of both objects is checked before idempotency lookup so a
    // replay never bypasses the current request identity.
    this.getCandidate(input.candidateId, context.workspaceId);
    this.assertLinkableProject(input.projectId, context.workspaceId);

    return this.runIdempotent(
      context.workspaceId,
      "workspace_link_job_candidate",
      input.idempotencyKey,
      payload,
      () => {
        const current = this.getCandidate(input.candidateId, context.workspaceId);
        if (current.linkedProjectId === input.projectId) {
          return { candidate: current, changed: false, replayed: false };
        }
        if (current.linkedProjectId !== null) {
          throw new ValidationError(
            "Candidate is already linked to a different application",
          );
        }

        const now = this.clock().toISOString();
        const update = this.database
          .prepare(
            `UPDATE job_candidates
             SET linked_project_id = ?, linked_at = ?,
                 record_version = record_version + 1, updated_at = ?
             WHERE id = ? AND workspace_id = ? AND linked_project_id IS NULL`,
          )
          .run(input.projectId, now, now, input.candidateId, context.workspaceId);
        if (update.changes !== 1) {
          throw new ConcurrencyConflictError(
            "Concurrent candidate update prevented this link",
          );
        }

        const linked = this.getCandidate(input.candidateId, context.workspaceId);
        this.writeLinkAudit({
          context,
          candidateId: input.candidateId,
          projectId: input.projectId,
          authority: input.authority,
          authorityReference,
        });
        return { candidate: linked, changed: true, replayed: false };
      },
    );
  }

  decideCandidateFromWeb(input: DecideCandidateFromWebInput): {
    candidate: JobCandidateRecord;
    changed: boolean;
    replayed: boolean;
  } {
    const context = this.resolveContext();
    if (context.channel !== "WEB") {
      throw new AuthorizationError("Web candidate decision requires a verified web request");
    }
    return this.decideCandidate({
      candidateId: input.candidateId,
      action: input.action,
      expectedRecordVersion: input.expectedRecordVersion,
      authority: {
        type: "EXPLICIT_USER_WEB",
        reference: `candidate-decision:${context.principalId}:${input.intentKey}`,
      },
      idempotencyKey: input.intentKey,
    });
  }

  linkCandidateFromWeb(input: LinkCandidateFromWebInput): {
    candidate: JobCandidateRecord;
    changed: boolean;
    replayed: boolean;
  } {
    const context = this.resolveContext();
    if (context.channel !== "WEB") {
      throw new AuthorizationError("Web candidate linking requires a verified web request");
    }
    return this.linkCandidateToApplication({
      candidateId: input.candidateId,
      projectId: input.projectId,
      authority: {
        type: "EXPLICIT_USER_WEB",
        reference: `candidate-link:${context.principalId}:${input.intentKey}`,
      },
      idempotencyKey: input.intentKey,
    });
  }

  private assertLinkableProject(projectId: string, workspaceId: string): void {
    const row = this.database
      .prepare(
        `SELECT id FROM projects
         WHERE id = ? AND workspace_id = ? AND project_type = 'job_application'`,
      )
      .get(projectId, workspaceId) as { id: string } | undefined;
    if (!row) throw new NotFoundError(`Application ${projectId} was not found`);
  }

  private writeLinkAudit(input: {
    context: CandidateCommandContext;
    candidateId: string;
    projectId: string;
    authority: CandidateMutationAuthority;
    authorityReference: string;
  }): void {
    this.database
      .prepare(
        `INSERT INTO candidate_links(
           id, workspace_id, candidate_id, project_id, channel, principal_id,
           authority_type, authority_reference, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        input.context.workspaceId,
        input.candidateId,
        input.projectId,
        input.context.channel,
        input.context.principalId,
        input.authority.type,
        input.authorityReference,
        this.clock().toISOString(),
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

function normalizeRunAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new ValidationError("runAt must be a valid ISO datetime");
  }
  return parsed.toISOString();
}

function normalizeRetentionUntil(
  value: string | null | undefined,
  runAt: string,
): string | null {
  if (value === undefined) {
    const until = new Date(new Date(runAt).valueOf() + RECOMMENDATION_RUN_RETENTION_DAYS * 86_400_000);
    return until.toISOString();
  }
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) {
    throw new ValidationError("retentionUntil must be a valid ISO datetime");
  }
  return parsed.toISOString();
}
