import { z } from "zod";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { CoverageStatus, DeliveryStatus, FitUncertainty, IdentityContext, JobCandidateRecord, ProjectRecord, RecommendationRunDetails, RecommendationRunItem, RecommendationRunRecord, ResourceRecord, SourceAvailability, TaskRecord, TransitionRecord } from "../domain/types.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import { isLifecycleState } from "../domain/job-application-lifecycle.js";
import type { Clock } from "./task-service.js";
import { readPage } from "./read-pagination.js";
import { mapCandidateRow, type CandidateRow } from "./candidate-service.js";
import type { JobApplicationSummary } from "./workspace-service.js";

const pageFields = {
  pageSize: z.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).max(2048).optional(),
};
const applicationSchema = z.object({
  ...pageFields,
  status: z.enum(["OPEN", "CLOSED", "ALL"]).default("OPEN"),
  lifecycle: z.enum(["APPLIED", "RECRUITER_CONTACT", "INTERVIEWING", "OFFER", "ACCEPTED", "REJECTED", "WITHDRAWN"]).optional(),
  q: z.string().trim().max(500).default(""),
  sort: z.enum(["UPDATED_DESC", "COMPANY_ASC", "NEXT_DUE_ASC"]).default("UPDATED_DESC"),
}).strict();
const taskSchema = z.object({ ...pageFields,
  status: z.enum(["OPEN", "ALL", "TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]).default("OPEN"),
}).strict();
const historySchema = z.object({ ...pageFields,
  status: z.enum(["ADMITTED", "PROPOSED", "REJECTED", "ALL"]).default("ADMITTED"),
}).strict();
const resourceSchema = z.object(pageFields).strict();
const candidateSchema = z.object({
  ...pageFields,
  decision: z.enum(["UNREVIEWED", "SAVED", "DISMISSED", "ALL"]).default("ALL"),
  linked: z.enum(["ALL", "LINKED", "UNLINKED"]).default("ALL"),
  q: z.string().trim().max(500).default(""),
}).strict();
const recommendationRunSchema = z.object(pageFields).strict();
const idSchema = z.string().uuid();

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError("Invalid Job Search query");
  return result.data;
}

const TASK_FIELDS = `t.id, t.project_id AS projectId, t.title, t.task_kind AS taskKind,
  t.status, t.priority, t.due_at AS dueAt, t.record_version AS recordVersion,
  t.created_by AS createdBy, t.updated_by AS updatedBy,
  t.source_transition_id AS sourceTransitionId, t.created_at AS createdAt,
  t.updated_at AS updatedAt, t.completed_at AS completedAt`;
const PROJECT_FIELDS = `p.id, p.workspace_id AS workspaceId, p.project_type AS projectType,
  p.title, p.status, p.lifecycle_state AS lifecycleState, p.lifecycle_version AS lifecycleVersion,
  p.record_version AS recordVersion, p.metadata_json AS metadata,
  p.created_at AS createdAt, p.updated_at AS updatedAt`;

export interface ApplicationListItem extends JobApplicationSummary {
  openTaskCount: number;
  nextDueTask: { id: string; title: string; dueAt: string } | null;
}
type ApplicationRow = Omit<ApplicationListItem, "nextDueTask"> & {
  nextDueTaskId: string | null; nextDueTaskTitle: string | null; nextDueAt: string | null;
};

interface RecommendationRunRow {
  id: string;
  workspace_id: string;
  provider: string;
  run_reference: string | null;
  run_at: string;
  coverage_status: CoverageStatus;
  delivery_status: DeliveryStatus;
  coverage_note: string | null;
  item_count: number;
  retention_until: string | null;
  recorded_at: string;
}

interface RecommendationRunItemRow {
  candidate_id: string;
  position: number;
  fit_reason: string | null;
  fit_uncertainty: FitUncertainty | null;
  source_availability: SourceAvailability | null;
}

function mapRecommendationRun(row: RecommendationRunRow): RecommendationRunRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    runReference: row.run_reference,
    runAt: row.run_at,
    coverageStatus: row.coverage_status,
    deliveryStatus: row.delivery_status,
    coverageNote: row.coverage_note,
    itemCount: row.item_count,
    retentionUntil: row.retention_until,
    recordedAt: row.recorded_at,
  };
}

const searchText = (value: string): string => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();

export class JobSearchQueryService {
  constructor(private readonly database: WorkspaceDatabase,
    private readonly resolveIdentity: () => IdentityContext,
    private readonly clock: Clock = () => new Date()) {}

  listApplications(input: unknown = {}) {
    const options = parse(applicationSchema, input);
    const q = searchText(options.q);
    return this.database.transaction(() => {
      const identity = this.resolveIdentity();
      const order = {
        UPDATED_DESC: "p.updated_at DESC, p.id ASC",
        COMPANY_ASC: "company COLLATE NOCASE ASC, role COLLATE NOCASE ASC, p.id ASC",
        NEXT_DUE_ASC: "n.due_at IS NULL ASC, n.due_at ASC, p.id ASC",
      }[options.sort];
      // One query supplies every row's task summary. The ranked CTE is scoped
      // to this Workspace/domain; no per-application service/SQL detail calls.
      const rows = () => this.database.prepare(`
        WITH ranked_open AS (
          SELECT t.id, t.title, t.due_at, t.project_id,
            COUNT(*) OVER (PARTITION BY t.project_id) AS open_count,
            ROW_NUMBER() OVER (PARTITION BY t.project_id
              ORDER BY t.due_at IS NULL, t.due_at, t.id) AS position
          FROM tasks t JOIN projects owner ON owner.id = t.project_id
          WHERE owner.workspace_id = @workspace AND owner.project_type = 'job_application'
            AND t.status NOT IN ('DONE', 'CANCELLED')
        )
        SELECT p.id AS projectId, p.title,
          json_extract(p.metadata_json, '$.company') AS company,
          json_extract(p.metadata_json, '$.role') AS role,
          json_extract(p.metadata_json, '$.appliedDate') AS appliedDate,
          json_extract(p.metadata_json, '$.location') AS location,
          json_extract(p.metadata_json, '$.postingReference') AS postingReference,
          p.status AS projectStatus, p.lifecycle_state AS lifecycleState,
          p.lifecycle_version AS lifecycleVersion, p.record_version AS recordVersion,
          p.updated_at AS updatedAt, COALESCE(n.open_count, 0) AS openTaskCount,
          n.id AS nextDueTaskId, n.title AS nextDueTaskTitle, n.due_at AS nextDueAt
        FROM projects p LEFT JOIN ranked_open n ON n.project_id = p.id AND n.position = 1
        WHERE p.workspace_id = @workspace AND p.project_type = 'job_application'
          AND (@status = 'ALL' OR (@status = 'OPEN' AND p.status <> 'CLOSED')
            OR (@status = 'CLOSED' AND p.status = 'CLOSED'))
          AND (@lifecycle IS NULL OR p.lifecycle_state = @lifecycle)
        ORDER BY ${order}`).iterate({ workspace: identity.workspaceId,
        status: options.status, lifecycle: options.lifecycle ?? null }) as Iterable<ApplicationRow>;
      function* projectRows(): Generator<ApplicationListItem> {
        for (const row of rows()) {
          if (typeof row.company !== "string" || typeof row.role !== "string" || !isLifecycleState(row.lifecycleState)) {
            throw new ValidationError("Invalid persisted Job Application");
          }
          if (q && !searchText(row.company).includes(q) && !searchText(row.role).includes(q)) continue;
          const { nextDueTaskId, nextDueTaskTitle, nextDueAt, ...summary } = row;
          yield { ...summary, nextDueTask: nextDueAt !== null && nextDueTaskId !== null
            ? { id: nextDueTaskId, title: nextDueTaskTitle!, dueAt: nextDueAt } : null };
        }
      }
      return readPage(projectRows, { kind: "applications", principalId: identity.principalId, workspaceId: identity.workspaceId,
        status: options.status, lifecycle: options.lifecycle, q, sort: options.sort, pageSize: options.pageSize },
      options.pageSize, options.cursor, this.clock().valueOf());
    })();
  }

  getApplication(projectId: string) {
    parse(idSchema, projectId);
    return this.database.transaction(() => {
      const identity = this.resolveIdentity();
      const project = this.authorizedApplication(projectId, identity.workspaceId);
      const counts = this.database.prepare(`SELECT
        (SELECT COUNT(*) FROM resources WHERE project_id = @id) AS resources,
        (SELECT COUNT(*) FROM state_transitions WHERE project_id = @id) AS history,
        (SELECT COUNT(*) FROM tasks WHERE project_id = @id AND status NOT IN ('DONE', 'CANCELLED')) AS openTasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = @id AND status = 'DONE') AS completedTasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = @id AND status = 'CANCELLED') AS cancelledTasks`
      ).get({ id: projectId }) as { resources: number; history: number; openTasks: number; completedTasks: number; cancelledTasks: number };
      const latestGmailCheck = this.database.prepare(`SELECT observed_at AS checkedAt,
        observed_facts_json AS facts FROM resources WHERE project_id = ?
        AND provider = 'workspace-gmail-check' AND resource_type = 'NOTE'
        ORDER BY observed_at DESC, created_at DESC, id DESC LIMIT 1`).get(projectId) as
        { checkedAt: string; facts: string } | undefined;
      return { project, totalCounts: counts, latestGmailCheck: latestGmailCheck
        ? { checkedAt: latestGmailCheck.checkedAt, facts: JSON.parse(latestGmailCheck.facts) as unknown } : null,
        asOf: this.clock().toISOString() };
    })();
  }

  getTask(taskId: string): TaskRecord {
    parse(idSchema, taskId);
    return this.database.transaction(() => {
      const identity = this.resolveIdentity();
      const task = this.database.prepare(`SELECT ${TASK_FIELDS} FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.id = ? AND p.workspace_id = ? AND p.project_type = 'job_application'`
      ).get(taskId, identity.workspaceId) as TaskRecord | undefined;
      if (!task) throw new NotFoundError("Task was not found");
      return task;
    })();
  }

  listTasks(projectId: string, input: unknown = {}) {
    parse(idSchema, projectId);
    const options = parse(taskSchema, input);
    return this.database.transaction(() => {
      const identity = this.resolveIdentity();
      this.authorizedApplication(projectId, identity.workspaceId);
      const rows = () => this.database.prepare(`SELECT ${TASK_FIELDS} FROM tasks t
        WHERE t.project_id = @project AND (@status = 'ALL' OR t.status = @status
          OR (@status = 'OPEN' AND t.status NOT IN ('DONE', 'CANCELLED')))
        ORDER BY t.updated_at DESC, t.id ASC`).iterate({ project: projectId, status: options.status }) as Iterable<TaskRecord>;
      return readPage(rows, { kind: "tasks", principalId: identity.principalId, workspaceId: identity.workspaceId, projectId, status: options.status, pageSize: options.pageSize },
        options.pageSize, options.cursor, this.clock().valueOf());
    })();
  }

  listHistory(projectId: string, input: unknown = {}) {
    parse(idSchema, projectId);
    const options = parse(historySchema, input);
    return this.database.transaction(() => {
      const identity = this.resolveIdentity();
      this.authorizedApplication(projectId, identity.workspaceId);
      const rows = () => this.database.prepare(`SELECT t.id, t.project_id AS projectId,
        t.from_state AS fromState, t.to_state AS toState, t.from_version AS fromVersion,
        t.to_version AS toVersion, t.trigger_type AS triggerType, t.status,
        t.proposed_by AS proposedBy, t.proposal_rationale AS proposalRationale,
        t.admitted_by AS admittedBy, t.admission_authority_type AS admissionAuthorityType,
        t.admission_authority_reference AS admissionAuthorityReference,
        t.proposed_at AS proposedAt, t.admitted_at AS admittedAt, t.rejection_reason AS rejectionReason,
        (SELECT json_group_array(resource_id) FROM (
          SELECT e.resource_id FROM transition_evidence e JOIN resources r ON r.id = e.resource_id
          WHERE e.transition_id = t.id AND r.project_id = t.project_id ORDER BY e.resource_id
        )) AS evidenceResourceIds
        FROM state_transitions t WHERE t.project_id = @project AND (@status = 'ALL' OR t.status = @status)
        ORDER BY COALESCE(t.admitted_at, t.proposed_at) DESC, t.id ASC`
      ).iterate({ project: projectId, status: options.status }) as Iterable<Omit<TransitionRecord, "evidenceResourceIds"> & { evidenceResourceIds: string }>;
      function* transitions(): Generator<TransitionRecord> {
        for (const row of rows()) yield { ...row, evidenceResourceIds: JSON.parse(row.evidenceResourceIds) as string[] };
      }
      return readPage(transitions, { kind: "history", principalId: identity.principalId, workspaceId: identity.workspaceId, projectId, status: options.status, pageSize: options.pageSize },
        options.pageSize, options.cursor, this.clock().valueOf());
    })();
  }

  listResources(projectId: string, input: unknown = {}) {
    parse(idSchema, projectId);
    const options = parse(resourceSchema, input);
    return this.database.transaction(() => {
      const identity = this.resolveIdentity();
      this.authorizedApplication(projectId, identity.workspaceId);
      const rows = () => this.database.prepare(`SELECT id, project_id AS projectId,
        resource_type AS resourceType, provider, external_id AS externalId,
        external_uri AS externalUri, title, observed_facts_json AS observedFacts,
        observed_at AS observedAt, created_at AS createdAt
        FROM resources WHERE project_id = ? ORDER BY observed_at DESC, id ASC`
      ).iterate(projectId) as Iterable<Omit<ResourceRecord, "observedFacts"> & { observedFacts: string }>;
      function* resources(): Generator<ResourceRecord> {
        for (const row of rows()) yield { ...row, observedFacts: JSON.parse(row.observedFacts) as ResourceRecord["observedFacts"] };
      }
      return readPage(resources, { kind: "resources", principalId: identity.principalId, workspaceId: identity.workspaceId, projectId, pageSize: options.pageSize },
        options.pageSize, options.cursor, this.clock().valueOf());
    })();
  }

  listCandidates(input: unknown = {}) {
    const options = parse(candidateSchema, input);
    const q = searchText(options.q);
    return this.database.transaction(() => {
      const identity = this.resolveIdentity();
      const rows = () => this.database.prepare(`SELECT * FROM job_candidates
        WHERE workspace_id = @workspace
          AND (@decision = 'ALL' OR decision = @decision)
          AND (@linked = 'ALL'
            OR (@linked = 'LINKED' AND linked_project_id IS NOT NULL)
            OR (@linked = 'UNLINKED' AND linked_project_id IS NULL))
        ORDER BY updated_at DESC, id ASC`
      ).iterate({ workspace: identity.workspaceId, decision: options.decision, linked: options.linked }) as Iterable<CandidateRow>;
      function* candidates(): Generator<JobCandidateRecord> {
        for (const row of rows()) {
          const candidate = mapCandidateRow(row);
          if (q && !searchText(candidate.company).includes(q) &&
            !searchText(candidate.role).includes(q) &&
            !searchText(candidate.title).includes(q)) continue;
          yield candidate;
        }
      }
      return readPage(candidates, { kind: "candidates", principalId: identity.principalId, workspaceId: identity.workspaceId,
        decision: options.decision, linked: options.linked, q, pageSize: options.pageSize },
      options.pageSize, options.cursor, this.clock().valueOf());
    })();
  }

  getCandidate(candidateId: string): JobCandidateRecord {
    parse(idSchema, candidateId);
    return this.database.transaction(() => {
      const identity = this.resolveIdentity();
      const row = this.database.prepare("SELECT * FROM job_candidates WHERE id = ? AND workspace_id = ?"
      ).get(candidateId, identity.workspaceId) as CandidateRow | undefined;
      if (!row) throw new NotFoundError("Candidate was not found");
      return mapCandidateRow(row);
    })();
  }

  listRecommendationRuns(input: unknown = {}) {
    const options = parse(recommendationRunSchema, input);
    return this.database.transaction(() => {
      const identity = this.resolveIdentity();
      const rows = () => this.database.prepare(`SELECT * FROM recommendation_runs
        WHERE workspace_id = @workspace ORDER BY run_at DESC, id ASC`
      ).iterate({ workspace: identity.workspaceId }) as Iterable<RecommendationRunRow>;
      function* runs(): Generator<RecommendationRunRecord> {
        for (const row of rows()) yield mapRecommendationRun(row);
      }
      return readPage(runs, { kind: "recommendationRuns", principalId: identity.principalId,
        workspaceId: identity.workspaceId, pageSize: options.pageSize },
      options.pageSize, options.cursor, this.clock().valueOf());
    })();
  }

  getRecommendationRun(runId: string): RecommendationRunDetails {
    parse(idSchema, runId);
    return this.database.transaction(() => {
      const identity = this.resolveIdentity();
      const row = this.database.prepare(
        "SELECT * FROM recommendation_runs WHERE id = ? AND workspace_id = ?",
      ).get(runId, identity.workspaceId) as RecommendationRunRow | undefined;
      if (!row) throw new NotFoundError("Recommendation run was not found");
      const itemRows = this.database.prepare(
        `SELECT candidate_id, position, fit_reason, fit_uncertainty, source_availability
         FROM recommendation_run_items WHERE run_id = ? ORDER BY position ASC, candidate_id ASC`,
      ).all(runId) as unknown as RecommendationRunItemRow[];
      const items: RecommendationRunItem[] = itemRows.map((item) => ({
        candidateId: item.candidate_id,
        position: item.position,
        fitReason: item.fit_reason,
        fitUncertainty: item.fit_uncertainty ?? "UNKNOWN",
        sourceAvailability: item.source_availability ?? "UNKNOWN",
      }));
      return { ...mapRecommendationRun(row), items };
    })();
  }

  private authorizedApplication(projectId: string, workspaceId: string): ProjectRecord {
    const row = this.database.prepare(`SELECT ${PROJECT_FIELDS} FROM projects p
      WHERE p.id = ? AND p.workspace_id = ? AND p.project_type = 'job_application'`
    ).get(projectId, workspaceId) as (Omit<ProjectRecord, "metadata"> & { metadata: string }) | undefined;
    if (!row) throw new NotFoundError("Application was not found");
    if (!isLifecycleState(row.lifecycleState)) throw new ValidationError("Invalid persisted Job Application");
    return { ...row, metadata: JSON.parse(row.metadata) as ProjectRecord["metadata"] };
  }
}
