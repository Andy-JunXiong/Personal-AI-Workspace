import { randomUUID } from "node:crypto";
import { z } from "zod";
import { canonicalHash, canonicalJson } from "../domain/canonical-json.js";
import {
  AuthorizationError,
  ConcurrencyConflictError,
  IdempotencyConflictError,
  NotFoundError,
  ValidationError,
} from "../domain/errors.js";
import type { IdentityContext } from "../domain/types.js";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { Clock } from "./task-service.js";

const httpUrl = z.string().trim().url().max(2_000).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "URL must use http(s)");

export const platformWatchEvidenceSchema = z.object({
  label: z.string().trim().min(1).max(500),
  url: httpUrl,
}).strict();

export const platformWatchFindingKeySchema = z.string().trim().min(1).max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);

export const platformWatchFindingInputSchema = z.object({
  key: platformWatchFindingKeySchema,
  title: z.string().trim().min(1).max(500),
  direction: z.enum(["IGNORE", "ADOPT", "REMOVE", "DOUBLE_DOWN"]),
  verification: z.enum(["NOT_TESTED", "LIVE_VERIFIED", "BLOCKED", "UNRESOLVED", "NOT_APPLICABLE"]),
  recommendation: z.string().trim().min(1).max(5_000),
  nextStep: z.string().trim().min(1).max(5_000),
  evidence: z.array(platformWatchEvidenceSchema).max(12),
}).strict();

export const platformWatchReportInputSchema = z.object({
  externalId: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:+-]*$/u),
  title: z.string().trim().min(1).max(500),
  generatedAt: z.string().datetime({ offset: true }),
  sourceUrl: httpUrl,
  evidenceCutoff: z.string().datetime({ offset: true }).nullable().optional(),
  repositorySha: z.string().trim().regex(/^[a-fA-F0-9]{40}$/u).nullable().optional(),
  directionalJudgment: z.enum(["NO_DRIFT", "NARROW", "EXPAND", "REPOSITION"]),
  summary: z.string().trim().min(1).max(5_000),
  body: z.string().trim().min(1).max(100_000),
  findings: z.array(platformWatchFindingInputSchema).min(1).max(20),
  intentKey: z.string().uuid(),
}).strict().superRefine((value, context) => {
  const keys = new Set<string>();
  value.findings.forEach((finding, index) => {
    if (keys.has(finding.key)) {
      context.addIssue({
        code: "custom",
        message: "Finding keys must be unique within a report",
        path: ["findings", index, "key"],
      });
    }
    keys.add(finding.key);
  });
});

export const platformWatchDecisionInputSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT", "DEFER", "REOPEN"]),
  expectedRecordVersion: z.number().int().min(1),
  note: z.string().trim().min(1).max(2_000),
  intentKey: z.string().uuid(),
}).strict();

export type PlatformWatchReportInput = z.infer<typeof platformWatchReportInputSchema>;
export type PlatformWatchDecisionInput = z.infer<typeof platformWatchDecisionInputSchema>;
export type PlatformWatchDecision = "PENDING" | "ACCEPTED" | "REJECTED" | "DEFERRED";

export interface PlatformWatchFinding {
  id: string;
  key: string;
  title: string;
  direction: "IGNORE" | "ADOPT" | "REMOVE" | "DOUBLE_DOWN";
  verification: "NOT_TESTED" | "LIVE_VERIFIED" | "BLOCKED" | "UNRESOLVED" | "NOT_APPLICABLE";
  recommendation: string;
  nextStep: string;
  evidence: Array<{ label: string; url: string }>;
  decision: PlatformWatchDecision;
  decisionNote: string | null;
  decisionAt: string | null;
  recordVersion: number;
  decisionHistory: PlatformWatchDecisionRecord[];
}

export interface PlatformWatchDecisionRecord {
  id: string;
  action: PlatformWatchDecisionInput["action"];
  fromDecision: PlatformWatchDecision;
  toDecision: PlatformWatchDecision;
  note: string;
  channel: "WEB";
  principalId: string;
  authorityType: "EXPLICIT_USER_WEB";
  authorityReference: string;
  recordVersion: number;
  createdAt: string;
}

export interface PlatformWatchReport {
  id: string;
  workspaceId: string;
  externalId: string;
  title: string;
  generatedAt: string;
  sourceUrl: string;
  evidenceCutoff: string | null;
  repositorySha: string | null;
  directionalJudgment: "NO_DRIFT" | "NARROW" | "EXPAND" | "REPOSITION";
  summary: string;
  body: string;
  createdByPrincipalId: string;
  recordedAt: string;
  findings: PlatformWatchFinding[];
  pendingFindingCount: number;
}

interface CommandContext extends IdentityContext {
  channel: "WEB" | "MCP";
}

interface ReportRow {
  id: string;
  workspace_id: string;
  external_id: string;
  title: string;
  generated_at: string;
  source_url: string;
  evidence_cutoff: string | null;
  repository_sha: string | null;
  directional_judgment: PlatformWatchReport["directionalJudgment"];
  summary: string;
  body: string;
  canonical_hash: string;
  created_by_principal_id: string;
  recorded_at: string;
}

interface FindingRow {
  id: string;
  report_id: string;
  finding_key: string;
  title: string;
  direction: PlatformWatchFinding["direction"];
  verification: PlatformWatchFinding["verification"];
  recommendation: string;
  next_step: string;
  evidence_json: string;
  decision: PlatformWatchDecision;
  decision_note: string | null;
  decision_at: string | null;
  record_version: number;
}

interface IdempotencyRow {
  request_hash: string;
  response_json: string;
}

interface DecisionRow {
  id: string;
  action: PlatformWatchDecisionRecord["action"];
  from_decision: PlatformWatchDecision;
  to_decision: PlatformWatchDecision;
  note: string;
  channel: "WEB";
  principal_id: string;
  authority_type: "EXPLICIT_USER_WEB";
  authority_reference: string;
  record_version: number;
  created_at: string;
}

const decisionTargets: Record<PlatformWatchDecisionInput["action"], PlatformWatchDecision> = {
  ACCEPT: "ACCEPTED",
  REJECT: "REJECTED",
  DEFER: "DEFERRED",
  REOPEN: "PENDING",
};

export class PlatformWatchService {
  constructor(
    private readonly database: WorkspaceDatabase,
    private readonly resolveContext: () => CommandContext,
    private readonly clock: Clock = () => new Date(),
  ) {}

  recordReportFromWeb(raw: unknown): { report: PlatformWatchReport; created: boolean; replayed: boolean } {
    const context = this.webContext();
    const input = platformWatchReportInputSchema.parse(raw);
    const payload = normalizedReportPayload(input);
    return this.runIdempotent(context.workspaceId, "web_record_platform_watch_report", input.intentKey, payload, () => {
      const hash = canonicalHash({ ...payload, externalId: undefined });
      const byExternal = this.reportRowByExternalId(context.workspaceId, input.externalId);
      if (byExternal) {
        if (byExternal.canonical_hash !== hash) {
          throw new IdempotencyConflictError("Report externalId already exists with different content");
        }
        return { report: this.reportFromRow(byExternal), created: false, replayed: false };
      }
      const byContent = this.database.prepare(
        "SELECT * FROM platform_watch_reports WHERE workspace_id = ? AND canonical_hash = ?",
      ).get(context.workspaceId, hash) as ReportRow | undefined;
      if (byContent) return { report: this.reportFromRow(byContent), created: false, replayed: false };

      const reportId = randomUUID();
      const recordedAt = this.clock().toISOString();
      this.database.prepare(`INSERT INTO platform_watch_reports(
        id, workspace_id, external_id, title, generated_at, source_url,
        evidence_cutoff, repository_sha, directional_judgment, summary, body,
        canonical_hash, created_by_principal_id, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(reportId, context.workspaceId, input.externalId, input.title.trim(), input.generatedAt,
          input.sourceUrl, input.evidenceCutoff ?? null, input.repositorySha?.toLowerCase() ?? null,
          input.directionalJudgment, input.summary.trim(), input.body.trim(), hash,
          context.principalId, recordedAt);

      const insertFinding = this.database.prepare(`INSERT INTO platform_watch_findings(
        id, report_id, finding_key, title, direction, verification,
        recommendation, next_step, evidence_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const finding of input.findings) {
        insertFinding.run(randomUUID(), reportId, finding.key, finding.title, finding.direction,
          finding.verification, finding.recommendation, finding.nextStep,
          canonicalJson(finding.evidence));
      }
      return { report: this.getReport(reportId), created: true, replayed: false };
    });
  }

  decideFindingFromWeb(reportId: string, findingKey: string, raw: unknown): {
    report: PlatformWatchReport;
    finding: PlatformWatchFinding;
    changed: boolean;
    replayed: boolean;
  } {
    const context = this.webContext();
    const input = platformWatchDecisionInputSchema.parse(raw);
    const report = this.getReport(reportId);
    const finding = report.findings.find((item) => item.key === findingKey);
    if (!finding) throw new NotFoundError(`Platform Watch finding ${findingKey} was not found`);
    const payload = { reportId, findingKey, ...input };
    return this.runIdempotent(context.workspaceId, "web_decide_platform_watch_finding", input.intentKey, payload, () => {
      const currentReport = this.getReport(reportId);
      const current = currentReport.findings.find((item) => item.key === findingKey);
      if (!current) throw new NotFoundError(`Platform Watch finding ${findingKey} was not found`);
      if (current.recordVersion !== input.expectedRecordVersion) {
        throw new ConcurrencyConflictError(
          `Expected finding record version ${input.expectedRecordVersion}, current version is ${current.recordVersion}`,
        );
      }
      if (input.action === "REOPEN" && current.decision === "PENDING") {
        throw new ValidationError("A pending finding cannot be reopened");
      }
      if (input.action !== "REOPEN" && current.decision !== "PENDING") {
        throw new ValidationError("Reopen the finding before recording a different decision");
      }
      const target = decisionTargets[input.action];
      const changed = current.decision !== target || current.decisionNote !== input.note;
      const now = this.clock().toISOString();
      let nextVersion = current.recordVersion;
      if (changed) {
        const update = this.database.prepare(`UPDATE platform_watch_findings
          SET decision = ?, decision_note = ?, decision_at = ?,
              record_version = record_version + 1
          WHERE id = ? AND report_id = ? AND record_version = ?`)
          .run(target, input.note, target === "PENDING" ? null : now,
            current.id, reportId, input.expectedRecordVersion);
        if (update.changes !== 1) {
          throw new ConcurrencyConflictError("Concurrent finding decision prevented this change");
        }
        nextVersion += 1;
      }
      this.database.prepare(`INSERT INTO platform_watch_decisions(
        id, workspace_id, report_id, finding_id, action, from_decision,
        to_decision, note, channel, principal_id, authority_type,
        authority_reference, record_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'WEB', ?, 'EXPLICIT_USER_WEB', ?, ?, ?)`)
        .run(randomUUID(), context.workspaceId, reportId, current.id, input.action,
          current.decision, changed ? target : current.decision, input.note,
          context.principalId, `platform-watch-decision:${context.principalId}:${input.intentKey}`,
          nextVersion, now);
      const updatedReport = this.getReport(reportId);
      const updatedFinding = updatedReport.findings.find((item) => item.key === findingKey)!;
      return { report: updatedReport, finding: updatedFinding, changed, replayed: false };
    });
  }

  listReports(): PlatformWatchReport[] {
    const context = this.resolveContext();
    const rows = this.database.prepare(`SELECT * FROM platform_watch_reports
      WHERE workspace_id = ? ORDER BY generated_at DESC, id ASC LIMIT 50`)
      .all(context.workspaceId) as ReportRow[];
    return rows.map((row) => this.reportFromRow(row));
  }

  getReport(reportId: string): PlatformWatchReport {
    const context = this.resolveContext();
    const row = this.database.prepare(
      "SELECT * FROM platform_watch_reports WHERE id = ? AND workspace_id = ?",
    ).get(reportId, context.workspaceId) as ReportRow | undefined;
    if (!row) throw new NotFoundError(`Platform Watch report ${reportId} was not found`);
    return this.reportFromRow(row, true);
  }

  pendingReports(limit = 5): PlatformWatchReport[] {
    const context = this.resolveContext();
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new ValidationError("Invalid pending report limit");
    const rows = this.database.prepare(`SELECT r.* FROM platform_watch_reports r
      WHERE r.workspace_id = ? AND EXISTS (
        SELECT 1 FROM platform_watch_findings f WHERE f.report_id = r.id AND f.decision = 'PENDING'
      ) ORDER BY r.generated_at DESC, r.id ASC LIMIT ?`).all(context.workspaceId, limit) as ReportRow[];
    return rows.map((row) => this.reportFromRow(row));
  }

  private webContext(): CommandContext {
    const context = this.resolveContext();
    if (context.channel !== "WEB") {
      throw new AuthorizationError("Platform Watch report actions require a verified browser request");
    }
    return context;
  }

  private reportRowByExternalId(workspaceId: string, externalId: string): ReportRow | undefined {
    return this.database.prepare(
      "SELECT * FROM platform_watch_reports WHERE workspace_id = ? AND external_id = ?",
    ).get(workspaceId, externalId) as ReportRow | undefined;
  }

  private reportFromRow(row: ReportRow, includeDecisionHistory = false): PlatformWatchReport {
    const findings = (this.database.prepare(
      "SELECT * FROM platform_watch_findings WHERE report_id = ? ORDER BY finding_key ASC, id ASC",
    ).all(row.id) as FindingRow[]).map((finding) => ({
      ...mapFinding(finding),
      decisionHistory: includeDecisionHistory ? this.decisionHistory(row.workspace_id, finding.id) : [],
    }));
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      externalId: row.external_id,
      title: row.title,
      generatedAt: row.generated_at,
      sourceUrl: row.source_url,
      evidenceCutoff: row.evidence_cutoff,
      repositorySha: row.repository_sha,
      directionalJudgment: row.directional_judgment,
      summary: row.summary,
      body: row.body,
      createdByPrincipalId: row.created_by_principal_id,
      recordedAt: row.recorded_at,
      findings,
      pendingFindingCount: findings.filter((finding) => finding.decision === "PENDING").length,
    };
  }

  private decisionHistory(workspaceId: string, findingId: string): PlatformWatchDecisionRecord[] {
    return (this.database.prepare(`SELECT id, action, from_decision, to_decision, note,
      channel, principal_id, authority_type, authority_reference, record_version, created_at
      FROM platform_watch_decisions WHERE workspace_id = ? AND finding_id = ?
      ORDER BY record_version DESC, created_at DESC, id DESC`).all(workspaceId, findingId) as DecisionRow[]).map((row) => ({
      id: row.id,
      action: row.action,
      fromDecision: row.from_decision,
      toDecision: row.to_decision,
      note: row.note,
      channel: row.channel,
      principalId: row.principal_id,
      authorityType: row.authority_type,
      authorityReference: row.authority_reference,
      recordVersion: row.record_version,
      createdAt: row.created_at,
    }));
  }

  private runIdempotent<T extends { replayed: boolean }>(
    workspaceId: string,
    operation: string,
    intentKey: string,
    payload: unknown,
    work: () => T,
  ): T {
    return this.database.transaction(() => {
      const existing = this.database.prepare(`SELECT request_hash, response_json
        FROM idempotency_records WHERE workspace_id = ? AND operation = ? AND idempotency_key = ?`)
        .get(workspaceId, operation, intentKey) as IdempotencyRow | undefined;
      const requestHash = canonicalHash(payload);
      if (existing) {
        if (existing.request_hash !== requestHash) {
          throw new IdempotencyConflictError("The intent key was already used with a different payload");
        }
        return { ...(JSON.parse(existing.response_json) as T), replayed: true };
      }
      const result = work();
      this.database.prepare(`INSERT INTO idempotency_records(
        workspace_id, operation, idempotency_key, request_hash, response_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(workspaceId, operation, intentKey, requestHash, canonicalJson(result), this.clock().toISOString());
      return result;
    })();
  }
}

function normalizedReportPayload(input: PlatformWatchReportInput) {
  return {
    externalId: input.externalId.trim(),
    title: input.title.trim(),
    generatedAt: input.generatedAt,
    sourceUrl: input.sourceUrl,
    evidenceCutoff: input.evidenceCutoff ?? null,
    repositorySha: input.repositorySha?.toLowerCase() ?? null,
    directionalJudgment: input.directionalJudgment,
    summary: input.summary.trim(),
    body: input.body.trim(),
    findings: input.findings.map((finding) => ({
      ...finding,
      key: finding.key.trim(),
      title: finding.title.trim(),
      recommendation: finding.recommendation.trim(),
      nextStep: finding.nextStep.trim(),
      evidence: finding.evidence.map((item) => ({ label: item.label.trim(), url: item.url })),
    })),
  };
}

function mapFinding(row: FindingRow): PlatformWatchFinding {
  return {
    id: row.id,
    key: row.finding_key,
    title: row.title,
    direction: row.direction,
    verification: row.verification,
    recommendation: row.recommendation,
    nextStep: row.next_step,
    evidence: JSON.parse(row.evidence_json) as Array<{ label: string; url: string }>,
    decision: row.decision,
    decisionNote: row.decision_note,
    decisionAt: row.decision_at,
    recordVersion: row.record_version,
    decisionHistory: [],
  };
}
