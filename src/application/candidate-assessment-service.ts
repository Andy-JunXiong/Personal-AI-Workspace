import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { IdentityContext, JobCandidateRecord } from "../domain/types.js";
import { canonicalHash, canonicalJson } from "../domain/canonical-json.js";
import { AuthorizationError, ConcurrencyConflictError, IdempotencyConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import {
  candidateAssessmentReadSchema, parseAssessment, recordCandidateAssessmentSchema,
  validateAssessmentEvidence, type AssessmentManifest, type CandidateAssessmentReport,
} from "../domain/candidate-match-assessment.js";
import type { JobLibraryService } from "./job-library-service.js";
import type { ResumeService } from "./resume-service.js";
import type { JobSearchQueryService } from "./job-search-query-service.js";

interface AssessmentRow {
  id: string; record_version: number; supersedes_id: string | null;
  input_manifest_json: string; report_json: string; correction_json: string | null;
  created_by: string; channel: "MCP"; authority_reference: string; created_at: string;
}
const rowColumns = "id,record_version,supersedes_id,input_manifest_json,report_json,correction_json,created_by,channel,authority_reference,created_at";
const MAX_INPUT_CHARACTERS = 600_000;

export class CandidateAssessmentService {
  constructor(
    private db: WorkspaceDatabase,
    private identity: () => IdentityContext & { channel: "WEB" | "MCP" },
    private candidates: JobSearchQueryService,
    private library: JobLibraryService,
    private resume: ResumeService,
    private clock = () => new Date(),
  ) {}

  private latest(candidateId: string): AssessmentRow | undefined {
    return this.db.prepare(`SELECT ${rowColumns} FROM candidate_match_assessments
      WHERE workspace_id=? AND candidate_id=? ORDER BY record_version DESC LIMIT 1`)
      .get(this.identity().workspaceId, candidateId) as AssessmentRow | undefined;
  }

  inputs(candidate: JobCandidateRecord, requestedIds: string[]) {
    const library = this.library.snapshot();
    // Authored confirmations are always visible alongside selected experience.
    const ids = [...new Set([...requestedIds, ...library.sources.filter(s => s.review_status === "CONFIRMED").map(s => s.id)])].sort();
    const sources = library.sources.filter(s => ids.includes(s.id)).sort((a, b) => a.id.localeCompare(b.id));
    const unavailableSourceIds = ids.filter(id => !sources.some(source => source.id === id));
    const description = this.library.description(candidate.id);
    const jd = description?.jd_text.trim() ? { text: description.jd_text, sourceUrl: description.source_url } : null;
    const baseResume = this.resume.get();
    const candidateIdentity = {
      provider: candidate.provider, postingId: candidate.postingId, sourceUrl: candidate.sourceUrl,
      company: candidate.company, role: candidate.role, title: candidate.title, location: candidate.location,
    };
    const manifest: AssessmentManifest = {
      candidateHash: canonicalHash(candidateIdentity), jdHash: jd ? canonicalHash(jd) : null,
      baseResume: baseResume ? { recordVersion: baseResume.recordVersion, hash: canonicalHash({ content: baseResume.content, sourceUrl: baseResume.sourceUrl }) } : null,
      libraryHash: library.hash,
      selectedSourceIds: ids,
      sources: sources.map(s => ({ id: s.id, recordVersion: s.record_version, hash: canonicalHash(s) })),
    };
    const missingMaterials = [
      ...(!jd ? ["JOB_DESCRIPTION"] : []), ...(!baseResume ? ["BASE_RESUME"] : []),
      ...unavailableSourceIds.map(id => `SOURCE_UNAVAILABLE:${id}`),
      ...(ids.length > 100 ? ["SOURCE_SELECTION_LIMIT"] : []),
    ];
    const snapshot = { candidateIdentity, jd, baseResume, sources, missingMaterials };
    return { manifest, snapshot, library, selectedSourceIds: ids, unavailableSourceIds };
  }

  private summary(candidate: JobCandidateRecord, row: AssessmentRow | undefined) {
    if (!row) return {
      status: this.library.description(candidate.id)?.jd_text.trim() ? "UNASSESSED" as const : "MISSING_JD" as const,
      id: null, recordVersion: 0, grade: null, previousGrade: null, reason: null, createdAt: null,
      staleReasons: [] as string[], missingMaterials: [
        ...(!this.library.description(candidate.id)?.jd_text.trim() ? ["JOB_DESCRIPTION"] : []),
        ...(!this.resume.get() ? ["BASE_RESUME"] : []),
      ],
    };
    const saved = JSON.parse(row.input_manifest_json) as AssessmentManifest;
    const report = JSON.parse(row.report_json) as CandidateAssessmentReport;
    const current = this.inputs(candidate, saved.selectedSourceIds);
    const staleReasons = [
      ...(saved.candidateHash !== current.manifest.candidateHash ? ["CANDIDATE_CHANGED"] : []),
      ...(saved.jdHash !== current.manifest.jdHash ? ["JD_CHANGED"] : []),
      ...(canonicalHash(saved.baseResume) !== canonicalHash(current.manifest.baseResume) ? ["BASE_RESUME_CHANGED"] : []),
      ...(saved.libraryHash !== current.manifest.libraryHash ? ["LIBRARY_CHANGED"] : []),
      ...(canonicalHash(saved.sources) !== canonicalHash(current.manifest.sources) ? ["SOURCES_CHANGED"] : []),
    ];
    const status = !current.snapshot.jd ? "MISSING_JD" as const : staleReasons.length ? "STALE" as const
      : report.grade === null ? "UNASSESSED" as const : "CURRENT" as const;
    return {
      status, id: row.id, recordVersion: row.record_version,
      grade: status === "CURRENT" ? report.grade : null,
      previousGrade: status === "CURRENT" ? null : report.grade,
      reason: report.reason, createdAt: row.created_at, staleReasons,
      missingMaterials: [...new Set([...current.snapshot.missingMaterials, ...report.completeness.missingMaterials])],
    };
  }

  listCandidates(input: unknown = {}) {
    return this.db.transaction(() => {
      const page = this.candidates.listCandidates(input);
      return { ...page, items: page.items.map(candidate => ({ ...candidate, matchAssessment: this.summary(candidate, this.latest(candidate.id)) })) };
    })();
  }

  getCandidate(candidateId: string, input: unknown = {}) {
    parseAssessment(z.uuid(), candidateId);
    const options = parseAssessment(candidateAssessmentReadSchema, input);
    if (!options.includeAssessmentContext && (options.sourceIds.length || options.sourceOffset)) {
      throw new ValidationError("Source selection requires includeAssessmentContext");
    }
    return this.db.transaction(() => {
      const candidate = this.candidates.getCandidate(candidateId);
      const latest = this.latest(candidateId);
      const history = this.db.prepare(`SELECT id,record_version AS recordVersion,supersedes_id AS supersedesAssessmentId,
        created_at AS createdAt,json_extract(report_json,'$.grade') AS grade,
        json_extract(report_json,'$.reason') AS reason FROM candidate_match_assessments
        WHERE workspace_id=? AND candidate_id=? AND record_version<? ORDER BY record_version DESC LIMIT 11`)
        .all(this.identity().workspaceId, candidateId, options.historyBeforeVersion ?? Number.MAX_SAFE_INTEGER) as Array<{
          id: string; recordVersion: number; supersedesAssessmentId: string | null; createdAt: string; grade: string | null; reason: string;
        }>;
      let assessment: ReturnType<CandidateAssessmentService["readAssessment"]> | null = null;
      if (options.assessmentVersion !== undefined) assessment = this.readAssessment(candidateId, options.assessmentVersion);
      let assessmentContext = null;
      if (options.includeAssessmentContext) {
        const current = this.inputs(candidate, options.sourceIds);
        const characterCount = JSON.stringify(current.snapshot).length;
        if (characterCount > MAX_INPUT_CHARACTERS || current.selectedSourceIds.length > 100) {
          throw new ValidationError("Assessment input exceeds limits; select fewer sources (maximum 100 sources, 600000 characters)");
        }
        const directory = current.library.sources.slice(options.sourceOffset, options.sourceOffset + 50).map(s => ({
          id: s.id, sourceKey: s.source_key, title: s.title, sourceUrl: s.source_url, recordVersion: s.record_version, reviewStatus: s.review_status,
        }));
        assessmentContext = {
          contractVersion: "candidate-assessment-context-v1", readAt: this.clock().toISOString(),
          inputManifest: current.manifest, ...current.snapshot, characterCount,
          selection: { requestedSourceIds: options.sourceIds, selectedSourceIds: current.selectedSourceIds,
            unavailableSourceIds: current.unavailableSourceIds, confirmedSourcesIncluded: true, fullLibraryReviewed: false },
          sourceDirectory: { items: directory, total: current.library.sources.length,
            nextOffset: options.sourceOffset + directory.length < current.library.sources.length ? options.sourceOffset + directory.length : null },
        };
      }
      return { ...candidate, matchAssessment: this.summary(candidate, latest), assessmentContext, assessment,
        assessmentHistory: { items: history.slice(0, 10), nextBeforeVersion: history.length > 10 ? history[9]!.recordVersion : null,
          total: latest?.record_version ?? 0 } };
    })();
  }

  private readAssessment(candidateId: string, recordVersion: number) {
    const row = this.db.prepare(`SELECT ${rowColumns},input_snapshot_json FROM candidate_match_assessments
      WHERE workspace_id=? AND candidate_id=? AND record_version=?`)
      .get(this.identity().workspaceId, candidateId, recordVersion) as (AssessmentRow & { input_snapshot_json: string }) | undefined;
    if (!row) throw new NotFoundError("Candidate assessment version was not found");
    return { id: row.id, recordVersion: row.record_version, supersedesAssessmentId: row.supersedes_id,
      inputManifest: JSON.parse(row.input_manifest_json) as AssessmentManifest,
      inputs: JSON.parse(row.input_snapshot_json) as ReturnType<CandidateAssessmentService["inputs"]>["snapshot"],
      report: JSON.parse(row.report_json) as CandidateAssessmentReport,
      correction: row.correction_json ? JSON.parse(row.correction_json) as { kind: "USER_STATEMENT"; statement: string; reference: string } : null,
      createdBy: row.created_by, channel: row.channel, authorityReference: row.authority_reference, createdAt: row.created_at };
  }

  record(input: unknown) {
    const parsed = parseAssessment(recordCandidateAssessmentSchema, input);
    const identity = this.identity();
    if (identity.channel !== "MCP" || !parsed.userConfirmed) throw new AuthorizationError("Assessment recording requires explicit interactive user authority through MCP");
    return this.db.transaction(() => {
      const candidate = this.candidates.getCandidate(parsed.candidateId);
      const operation = "candidate.match-assessment.record";
      const requestHash = canonicalHash({ ...parsed, principalId: identity.principalId });
      const prior = this.db.prepare("SELECT request_hash,response_json FROM idempotency_records WHERE workspace_id=? AND operation=? AND idempotency_key=?")
        .get(identity.workspaceId, operation, parsed.idempotencyKey) as { request_hash: string; response_json: string } | undefined;
      if (prior) {
        if (prior.request_hash !== requestHash) throw new IdempotencyConflictError("Assessment idempotency key already has a different request");
        return { ...JSON.parse(prior.response_json) as { id: string; recordVersion: number; createdAt: string }, replayed: true };
      }
      const latest = this.latest(candidate.id);
      if (candidate.recordVersion !== parsed.expectedCandidateVersion || (latest?.record_version ?? 0) !== parsed.expectedAssessmentVersion ||
          (latest?.id ?? null) !== parsed.supersedesAssessmentId) throw new ConcurrencyConflictError("Candidate or assessment version changed; read again");
      if (parsed.correction && !latest) throw new ValidationError("A correction requires a previous assessment");
      const current = this.inputs(candidate, parsed.inputManifest.selectedSourceIds);
      if (canonicalHash(current.manifest) !== canonicalHash(parsed.inputManifest)) throw new ConcurrencyConflictError("Assessment source versions changed; read again");
      if (JSON.stringify(current.snapshot).length > MAX_INPUT_CHARACTERS || current.selectedSourceIds.length > 100) {
        throw new ValidationError("Assessment input exceeds limits");
      }
      validateAssessmentEvidence(parsed.report, current.snapshot);
      // Preserve server-observed omissions even when the model omits them.
      const report = { ...parsed.report, completeness: { ...parsed.report.completeness,
        missingMaterials: [...new Set([...parsed.report.completeness.missingMaterials, ...current.snapshot.missingMaterials])] } };
      const result = { id: randomUUID(), recordVersion: (latest?.record_version ?? 0) + 1, createdAt: this.clock().toISOString(), replayed: false };
      this.db.prepare(`INSERT INTO candidate_match_assessments
        (id,workspace_id,candidate_id,record_version,supersedes_id,input_manifest_json,input_snapshot_json,report_json,correction_json,created_by,channel,authority_reference,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(result.id, identity.workspaceId, candidate.id, result.recordVersion,
          latest?.id ?? null, canonicalJson(current.manifest), canonicalJson(current.snapshot), canonicalJson(report),
          parsed.correction ? canonicalJson(parsed.correction) : null, identity.principalId, identity.channel, parsed.authorityReference, result.createdAt);
      this.db.prepare("INSERT INTO idempotency_records(workspace_id,operation,idempotency_key,request_hash,response_json,created_at) VALUES(?,?,?,?,?,?)")
        .run(identity.workspaceId, operation, parsed.idempotencyKey, requestHash, canonicalJson(result), result.createdAt);
      return result;
    })();
  }
}
