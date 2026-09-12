import { randomUUID } from "node:crypto";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { IdentityContext, JobCandidateRecord } from "../domain/types.js";
import { canonicalHash, canonicalJson } from "../domain/canonical-json.js";
import { AuthorizationError, ConcurrencyConflictError, IdempotencyConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { parseAssessment, type AssessmentManifest } from "../domain/candidate-match-assessment.js";
import { SCREENING_RULE_VERSION, screenJob, type JobScreeningInput } from "../domain/job-screening.js";
import { recordScreeningSchema, overrideScreeningSchema, screeningReadSchema, type CandidateScreeningSummary } from "../domain/candidate-screening.js";
import type { CandidateAssessmentService } from "./candidate-assessment-service.js";
import type { JobSearchQueryService } from "./job-search-query-service.js";

type Result = ReturnType<typeof screenJob>;
type Row = { id: string; record_version: number; input_manifest_json: string; result_json: string; reason: string; created_at: string };
type Override = { record_version: number; mode: "KEEP" | "AUTOMATIC"; reason: string; created_at: string };
type WriteResult = { id: string; recordVersion: number; createdAt: string; replayed: boolean };
export class CandidateScreeningService {
  constructor(private db: WorkspaceDatabase,
    private identity: () => IdentityContext & { channel: "WEB" | "MCP" },
    private candidates: JobSearchQueryService, private assessments: CandidateAssessmentService,
    private clock = () => new Date()) {}

  private latest(candidateId: string): Row | undefined {
    return this.db.prepare(`SELECT id,record_version,input_manifest_json,result_json,reason,created_at
      FROM candidate_screenings WHERE workspace_id=? AND candidate_id=? ORDER BY record_version DESC LIMIT 1`)
      .get(this.identity().workspaceId, candidateId) as Row | undefined;
  }
  private override(candidateId: string): Override | undefined {
    return this.db.prepare(`SELECT record_version,mode,reason,created_at FROM candidate_screening_overrides
      WHERE workspace_id=? AND candidate_id=? ORDER BY record_version DESC LIMIT 1`)
      .get(this.identity().workspaceId, candidateId) as Override | undefined;
  }
  // Called inside the shared query's read transaction; does not read the candidate again.
  summary(candidate: JobCandidateRecord): CandidateScreeningSummary {
    const row = this.latest(candidate.id), override = this.override(candidate.id);
    const result = row ? JSON.parse(row.result_json) as Result : null;
    const staleReasons: string[] = [];
    if (row && result) {
      const manifest = JSON.parse(row.input_manifest_json) as AssessmentManifest;
      const current = this.assessments.inputs(candidate, manifest.selectedSourceIds).manifest;
      if (manifest.candidateHash !== current.candidateHash) staleReasons.push("CANDIDATE_CHANGED");
      if (manifest.jdHash !== current.jdHash) staleReasons.push("JD_CHANGED");
      if (canonicalHash(manifest.baseResume) !== canonicalHash(current.baseResume)) staleReasons.push("RESUME_CHANGED");
      if (manifest.libraryHash !== current.libraryHash || canonicalHash(manifest.sources) !== canonicalHash(current.sources)) staleReasons.push("PROFILE_OR_SOURCES_CHANGED");
      if (result.ruleVersion !== SCREENING_RULE_VERSION) staleReasons.push("RULES_CHANGED");
    }
    return { status: !row ? "UNSCREENED" : staleReasons.length ? "STALE" : "CURRENT",
      recordVersion: row?.record_version ?? 0, id: row?.id ?? null, decision: result?.decision ?? null,
      reason: row?.reason ?? null, staleReasons, overrideVersion: override?.record_version ?? 0,
      overrideMode: override?.mode ?? "AUTOMATIC", savedByUser: candidate.decision === "SAVED",
      hidden: !!result && !staleReasons.length && result.decision === "FILTER" && override?.mode !== "KEEP" && candidate.decision !== "SAVED" };
  }

  get(candidateId: string, input: unknown = {}) {
    const options = parseAssessment(screeningReadSchema, input);
    return this.db.transaction(() => {
      const candidate = this.candidates.getCandidate(candidateId), workspace = this.identity().workspaceId;
      const summary = this.summary(candidate);
      const history = this.db.prepare(`SELECT id,record_version AS recordVersion,reason,created_at AS createdAt,
        json_extract(result_json,'$.decision') AS decision FROM candidate_screenings WHERE workspace_id=? AND candidate_id=?
        AND record_version<? ORDER BY record_version DESC LIMIT 11`).all(workspace, candidateId, options.beforeVersion ?? Number.MAX_SAFE_INTEGER) as Array<{ recordVersion: number; reason: string; decision: string; id: string; createdAt: string }>;
      const overrides = this.db.prepare(`SELECT record_version AS recordVersion,mode,reason,channel,created_at AS createdAt
        FROM candidate_screening_overrides WHERE workspace_id=? AND candidate_id=? AND record_version<?
        ORDER BY record_version DESC LIMIT 11`).all(workspace, candidateId, options.overrideBeforeVersion ?? Number.MAX_SAFE_INTEGER) as Array<{ recordVersion: number; mode: string; reason: string; channel: string; createdAt: string }>;
      const selectedVersion = options.version ?? (summary.recordVersion || undefined);
      let record = null;
      if (selectedVersion !== undefined) {
        const saved = this.db.prepare(`SELECT * FROM candidate_screenings WHERE workspace_id=? AND candidate_id=? AND record_version=?`)
          .get(workspace, candidateId, selectedVersion) as (Row & { profile_source_id: string; screening_input_json: string; input_snapshot_json: string; provenance_reference: string; created_by: string; authority_reference: string }) | undefined;
        if (!saved) throw new NotFoundError("Screening version was not found");
        record = { id: saved.id, recordVersion: saved.record_version, reason: saved.reason, profileSourceId: saved.profile_source_id,
          inputManifest: JSON.parse(saved.input_manifest_json) as AssessmentManifest,
          input: JSON.parse(saved.screening_input_json) as JobScreeningInput,
          // Private source snapshots are available only on an explicit historical-version read.
          inputs: options.version !== undefined ? JSON.parse(saved.input_snapshot_json) : null,
          result: JSON.parse(saved.result_json) as Result, provenanceReference: saved.provenance_reference,
          createdBy: saved.created_by, authorityReference: saved.authority_reference, createdAt: saved.created_at };
      }
      return { summary, record, history: { items: history.slice(0, 10), nextBeforeVersion: history.length > 10 ? history[9]!.recordVersion : null },
        overrides: { items: overrides.slice(0, 10), nextBeforeVersion: overrides.length > 10 ? overrides[9]!.recordVersion : null } };
    })();
  }

  private replay(operation: string, input: { idempotencyKey: string }, hash: string): WriteResult | null {
    const row = this.db.prepare("SELECT request_hash,response_json FROM idempotency_records WHERE workspace_id=? AND operation=? AND idempotency_key=?")
      .get(this.identity().workspaceId, operation, input.idempotencyKey) as { request_hash: string; response_json: string } | undefined;
    if (!row) return null;
    if (row.request_hash !== hash) throw new IdempotencyConflictError("Screening idempotency conflict");
    return { ...JSON.parse(row.response_json), replayed: true } as WriteResult;
  }
  private saveReplay(operation: string, key: string, hash: string, result: WriteResult) {
    this.db.prepare("INSERT INTO idempotency_records(workspace_id,operation,idempotency_key,request_hash,response_json,created_at) VALUES(?,?,?,?,?,?)")
      .run(this.identity().workspaceId, operation, key, hash, canonicalJson(result), result.createdAt);
  }

  record(input: unknown) {
    const parsed = parseAssessment(recordScreeningSchema, input), identity = this.identity();
    if (identity.channel !== "MCP" || !parsed.userConfirmed) throw new AuthorizationError("Screening requires explicit interactive user authority through MCP");
    return this.db.transaction(() => {
      const candidate = this.candidates.getCandidate(parsed.candidateId), operation = "candidate.screening.record";
      const hash = canonicalHash({ ...parsed, principalId: identity.principalId });
      const replay = this.replay(operation, parsed, hash); if (replay) return replay;
      const latest = this.latest(candidate.id);
      if (candidate.recordVersion !== parsed.expectedCandidateVersion || (latest?.record_version ?? 0) !== parsed.expectedScreeningVersion) throw new ConcurrencyConflictError("Candidate or screening version changed");
      const current = this.assessments.inputs(candidate, parsed.inputManifest.selectedSourceIds);
      if (canonicalHash(current.manifest) !== canonicalHash(parsed.inputManifest)) throw new ConcurrencyConflictError("Screening inputs changed; read again");
      if (!current.snapshot.jd || current.unavailableSourceIds.length || current.selectedSourceIds.length > 100 || JSON.stringify(current.snapshot).length > 600_000) throw new ValidationError("Screening requires saved JD and available bounded sources");
      const profile = current.snapshot.sources.find(source => source.id === parsed.profileSourceId && source.review_status === "CONFIRMED");
      if (!profile || profile.record_version !== parsed.input.profileVersion) throw new ValidationError("Profile requires an explicitly confirmed source and its exact version");
      const citations = [...parsed.input.experience.map(item => item.evidence), ...parsed.input.tenureExclusions.map(item => item.evidence),
        ...parsed.input.requirements.flatMap(item => item.alternatives.flatMap(option => option.kind === "CONDITION" && option.evidence ? [option.evidence] : []))];
      for (const citation of citations) {
        // reference is a server-owned source ID, never arbitrary model provenance.
        if (!current.snapshot.sources.some(source => source.id === citation.reference && source.review_status === "CONFIRMED" && source.content.includes(citation.statement))) {
          throw new ValidationError("Screening evidence must quote a selected confirmed source by ID");
        }
      }
      const screeningInput = { ...parsed.input, jd: current.snapshot.jd.text };
      if (JSON.stringify(screeningInput).length > 600_000) throw new ValidationError("Screening report exceeds bounded input size");
      const result = screenJob(screeningInput);
      const saved = { id: randomUUID(), recordVersion: (latest?.record_version ?? 0) + 1, createdAt: this.clock().toISOString(), replayed: false };
      this.db.prepare(`INSERT INTO candidate_screenings(id,workspace_id,candidate_id,profile_source_id,record_version,input_manifest_json,input_snapshot_json,
        screening_input_json,result_json,reason,provenance_reference,created_by,authority_reference,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(saved.id, identity.workspaceId, candidate.id, parsed.profileSourceId, saved.recordVersion, canonicalJson(current.manifest), canonicalJson(current.snapshot),
          canonicalJson(screeningInput), canonicalJson(result), parsed.reason, parsed.provenanceReference, identity.principalId, parsed.authorityReference, saved.createdAt);
      this.saveReplay(operation, parsed.idempotencyKey, hash, saved);
      return saved;
    })();
  }

  setOverride(input: unknown) {
    const parsed = parseAssessment(overrideScreeningSchema, input), identity = this.identity();
    if (!parsed.userConfirmed) throw new AuthorizationError("Screening override requires explicit user authority");
    return this.db.transaction(() => {
      const candidate = this.candidates.getCandidate(parsed.candidateId), operation = "candidate.screening.override";
      const hash = canonicalHash({ ...parsed, principalId: identity.principalId, channel: identity.channel });
      const replay = this.replay(operation, parsed, hash); if (replay) return replay;
      const latest = this.latest(candidate.id), override = this.override(candidate.id);
      if (candidate.recordVersion !== parsed.expectedCandidateVersion || (latest?.record_version ?? 0) !== parsed.expectedScreeningVersion ||
        (override?.record_version ?? 0) !== parsed.expectedOverrideVersion) throw new ConcurrencyConflictError("Screening or override version changed");
      if (!latest) throw new ValidationError("Screen the candidate before overriding screening");
      const result = { id: randomUUID(), recordVersion: (override?.record_version ?? 0) + 1, createdAt: this.clock().toISOString(), replayed: false };
      this.db.prepare(`INSERT INTO candidate_screening_overrides(id,workspace_id,candidate_id,record_version,mode,reason,created_by,channel,authority_reference,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run(result.id, identity.workspaceId, candidate.id, result.recordVersion, parsed.mode, parsed.reason,
          identity.principalId, identity.channel, parsed.authorityReference, result.createdAt);
      this.saveReplay(operation, parsed.idempotencyKey, hash, result);
      return result;
    })();
  }
}
