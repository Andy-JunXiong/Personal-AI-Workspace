import { randomUUID } from "node:crypto";
import type { WorkspaceDatabase } from "../persistence/database.js";
import { TaskService, type Clock, mapTask } from "./task-service.js";
import { TodayQueryService } from "./today-query-service.js";
import { canonicalHash, canonicalJson } from "../domain/canonical-json.js";
import {
  AuthorizationError,
  ConcurrencyConflictError,
  IdempotencyConflictError,
  NotFoundError,
  ValidationError,
} from "../domain/errors.js";
import {
  derivedTaskForTransition,
  isAllowedTransition,
  isLifecycleState,
} from "../domain/job-application-lifecycle.js";
import type {
  ExplicitUserDevAuthority,
  IdentityContext,
  JsonValue,
  LifecycleState,
  ProjectRecord,
  ResourceRecord,
  TaskRecord,
  TransitionRecord,
  TriggerType,
} from "../domain/types.js";

interface DevelopmentPrincipalConfig {
  issuer: string;
  subject: string;
  workspaceName: string;
}

interface ProjectRow {
  id: string;
  workspace_id: string;
  project_type: string;
  title: string;
  status: "ACTIVE" | "PAUSED" | "CLOSED";
  lifecycle_state: string;
  lifecycle_version: number;
  record_version: number;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

interface ResourceRow {
  id: string;
  project_id: string;
  resource_type: string;
  provider: string;
  external_id: string | null;
  external_uri: string | null;
  title: string | null;
  observed_facts_json: string;
  observed_at: string;
  created_at: string;
}

interface TransitionRow {
  id: string;
  project_id: string;
  from_state: string;
  to_state: string;
  from_version: number;
  to_version: number | null;
  trigger_type: TriggerType;
  status: "PROPOSED" | "ADMITTED" | "REJECTED";
  proposed_by: "USER" | "CHATGPT" | "SYSTEM";
  proposal_rationale: string | null;
  admitted_by: "USER" | "RULE" | "SYSTEM" | null;
  admission_authority_type:
    | "EXPLICIT_USER_DEV"
    | "DETERMINISTIC_RULE"
    | null;
  admission_authority_reference: string | null;
  proposed_at: string;
  admitted_at: string | null;
  rejection_reason: string | null;
}

interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  task_kind: "FOLLOW_UP" | "PREPARE_FOR_INTERVIEW" | "RESPOND_TO_RECRUITER" | "OTHER";
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  due_at: string | null;
  record_version: number;
  created_by: "USER" | "CHATGPT" | "SYSTEM";
  updated_by: "USER" | "CHATGPT" | "SYSTEM";
  source_transition_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface IdempotencyRow {
  request_hash: string;
  response_json: string;
}

export interface ProjectDetails {
  project: ProjectRecord;
  resources: ResourceRecord[];
  transitions: TransitionRecord[];
  openTasks: TaskRecord[];
  totalCounts: {
    resources: number;
    transitions: number;
    openTasks: number;
  };
}

export interface JobApplicationMatch {
  projectId: string;
  title: string;
  company: string;
  role: string;
  projectStatus: "ACTIVE" | "PAUSED" | "CLOSED";
  lifecycleState: string;
  lifecycleVersion: number;
  recordVersion: number;
  updatedAt: string;
}

export interface FindJobApplicationResult {
  matchStatus: "EXACT" | "NOT_FOUND" | "AMBIGUOUS";
  matches: JobApplicationMatch[];
}

export interface CreateJobApplicationInput {
  company: string;
  role: string;
  appliedDate?: string | null;
  location?: string | null;
  postingReference?: string | null;
  allowDistinctDuplicate?: true;
  authority: ExplicitUserDevAuthority;
  idempotencyKey: string;
}

export type CreateJobApplicationResult =
  | {
      creationStatus: "CREATED";
      project: ProjectRecord;
      initialTransition: TransitionRecord;
      replayed: boolean;
    }
  | {
      creationStatus: "POSSIBLE_DUPLICATE";
      matches: JobApplicationSummary[];
      replayed: false;
    };

export interface UpdateJobApplicationInput {
  projectId: string;
  expectedRecordVersion: number;
  company?: string;
  role?: string;
  appliedDate?: string | null;
  location?: string | null;
  postingReference?: string | null;
  idempotencyKey: string;
}

export interface JobApplicationSummary extends JobApplicationMatch {
  appliedDate: string | null;
  location: string | null;
  postingReference: string | null;
}

export interface ListJobApplicationsResult {
  applications: JobApplicationSummary[];
  totalCount: number;
  truncated: boolean;
  includeClosed: boolean;
}

export interface RecordObservationInput {
  projectId: string;
  resourceType: string;
  provider: string;
  externalId: string | null;
  externalUri: string | null;
  title: string | null;
  observedFacts: Record<string, JsonValue>;
  observedAt: string;
  idempotencyKey: string;
}

export interface ProposeTransitionInput {
  projectId: string;
  expectedLifecycleVersion: number;
  toState: LifecycleState;
  triggerType: TriggerType;
  evidenceResourceIds: string[];
  rationale: string;
  idempotencyKey: string;
}

export interface AdmitTransitionInput {
  transitionId: string;
  expectedLifecycleVersion: number;
  authority: ExplicitUserDevAuthority;
  idempotencyKey: string;
}

interface ReplayableResult {
  replayed: boolean;
}

const PROJECT_HISTORY_LIMIT = 10;
const JOB_APPLICATION_LIST_LIMIT = 100;

class PossibleDuplicateDetected extends Error {
  constructor(readonly matches: JobApplicationSummary[]) {
    super("An exact active Job Application already exists");
  }
}

export class WorkspaceService {
  readonly taskService: TaskService;
  readonly todayQueryService: TodayQueryService;

  constructor(
    private readonly database: WorkspaceDatabase,
    private readonly developmentPrincipal: DevelopmentPrincipalConfig,
    options: { timeZone?: string; clock?: Clock } = {},
  ) {
    const resolveIdentity = () => this.resolveDevelopmentIdentity();
    const assertProjectVisible = (projectId: string, workspaceId: string) => {
      this.getAuthorizedProject(projectId, workspaceId);
    };
    this.taskService = new TaskService(
      database,
      resolveIdentity,
      assertProjectVisible,
      options.clock,
    );
    this.todayQueryService = new TodayQueryService(
      database,
      resolveIdentity,
      options.timeZone,
      options.clock,
    );
  }

  ensureDevelopmentIdentity(): IdentityContext {
    return this.database.transaction(() => {
      const now = new Date().toISOString();
      let principal = this.database
        .prepare("SELECT id FROM principals WHERE issuer = ? AND subject = ?")
        .get(
          this.developmentPrincipal.issuer,
          this.developmentPrincipal.subject,
        ) as { id: string } | undefined;

      if (!principal) {
        principal = { id: randomUUID() };
        this.database
          .prepare(
            `INSERT INTO principals(id, issuer, subject, display_name, created_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            principal.id,
            this.developmentPrincipal.issuer,
            this.developmentPrincipal.subject,
            this.developmentPrincipal.subject,
            now,
          );
      }

      let workspace = this.database
        .prepare("SELECT id FROM workspaces WHERE owner_principal_id = ?")
        .get(principal.id) as { id: string } | undefined;

      if (!workspace) {
        workspace = { id: randomUUID() };
        this.database
          .prepare(
            `INSERT INTO workspaces(id, owner_principal_id, name, created_at)
             VALUES (?, ?, ?, ?)`,
          )
          .run(
            workspace.id,
            principal.id,
            this.developmentPrincipal.workspaceName,
            now,
          );
      }

      return {
        principalId: principal.id,
        workspaceId: workspace.id,
      };
    })();
  }

  resolveDevelopmentIdentity(): IdentityContext {
    const row = this.database
      .prepare(
        `SELECT p.id AS principal_id, w.id AS workspace_id
         FROM principals p
         JOIN workspaces w ON w.owner_principal_id = p.id
         WHERE p.issuer = ? AND p.subject = ?`,
      )
      .get(
        this.developmentPrincipal.issuer,
        this.developmentPrincipal.subject,
      ) as { principal_id: string; workspace_id: string } | undefined;

    if (!row) {
      throw new AuthorizationError(
        "Configured development principal is not mapped to a Workspace",
      );
    }

    return {
      principalId: row.principal_id,
      workspaceId: row.workspace_id,
    };
  }

  ping(): {
    service: string;
    version: string;
    database: "available";
    workspaceId: string;
  } {
    this.database.prepare("SELECT 1").get();
    const identity = this.resolveDevelopmentIdentity();
    return {
      service: "personal-ai-workspace",
      version: "0.1.0",
      database: "available",
      workspaceId: identity.workspaceId,
    };
  }

  seedJobApplication(input: {
    projectId: string;
    initialTransitionId: string;
    title: string;
    company: string;
    role: string;
  }): ProjectDetails {
    const identity = this.resolveDevelopmentIdentity();

    this.database.transaction(() => {
      const existing = this.database
        .prepare("SELECT id FROM projects WHERE id = ?")
        .get(input.projectId);
      if (existing) {
        return;
      }

      const now = new Date().toISOString();
      this.database
        .prepare(
          `INSERT INTO projects(
             id, workspace_id, project_type, title, status,
             lifecycle_state, lifecycle_version, metadata_json,
             created_at, updated_at
           ) VALUES (?, ?, 'job_application', ?, 'ACTIVE', 'APPLIED', 1, ?, ?, ?)`,
        )
        .run(
          input.projectId,
          identity.workspaceId,
          input.title,
          canonicalJson({ company: input.company, role: input.role }),
          now,
          now,
        );

      this.database
        .prepare(
          `INSERT INTO state_transitions(
             id, project_id, from_state, to_state, from_version, to_version,
             trigger_type, status, proposed_by, proposal_rationale,
             canonical_hash, admitted_by, admission_authority_type,
             admission_authority_reference, proposed_at, admitted_at
           ) VALUES (?, ?, 'NONE', 'APPLIED', 0, 1, 'IMPORT', 'ADMITTED',
                     'SYSTEM', 'Spike fixture import', ?, 'SYSTEM',
                     'DETERMINISTIC_RULE', 'SPIKE_FIXTURE_IMPORT', ?, ?)`,
        )
        .run(
          input.initialTransitionId,
          input.projectId,
          canonicalHash({
            projectId: input.projectId,
            fromState: "NONE",
            toState: "APPLIED",
            triggerType: "IMPORT",
            source: "SPIKE_FIXTURE_IMPORT",
          }),
          now,
          now,
        );
    })();

    return this.getProject(input.projectId);
  }

  createJobApplication(input: CreateJobApplicationInput): CreateJobApplicationResult {
    const identity = this.resolveDevelopmentIdentity();
    const authorityReference = input.authority.reference.trim();
    if (
      input.authority.type !== "EXPLICIT_USER_DEV" ||
      !input.authority.confirmed ||
      authorityReference.length === 0
    ) {
      throw new AuthorizationError(
        "Job Application registration requires explicit user authority",
      );
    }

    const registration = normalizeJobApplicationRegistration(input);
    const payload = {
      ...registration,
      allowDistinctDuplicate: input.allowDistinctDuplicate === true,
      authority: {
        type: input.authority.type,
        confirmed: input.authority.confirmed,
        reference: authorityReference,
      },
    };

    const replay = this.readIdempotentReplay<CreateJobApplicationResult>(
      identity.workspaceId,
      "workspace_create_job_application",
      input.idempotencyKey,
      payload,
    );
    if (replay) {
      return replay;
    }

    const existingMatches = this.findExactActiveJobApplications(
      identity.workspaceId,
      registration.company,
      registration.role,
    );
    const hasDistinctOverride = validateDistinctDuplicateOverride(
      input.allowDistinctDuplicate === true,
      registration.postingReference,
      existingMatches,
    );
    if (existingMatches.length > 0 && !hasDistinctOverride) {
      return possibleDuplicateResult(existingMatches);
    }

    try {
      return this.runIdempotent(
        identity.workspaceId,
        "workspace_create_job_application",
        input.idempotencyKey,
        payload,
        () => {
          const currentMatches = this.findExactActiveJobApplications(
            identity.workspaceId,
            registration.company,
            registration.role,
          );
          const currentOverride = validateDistinctDuplicateOverride(
            input.allowDistinctDuplicate === true,
            registration.postingReference,
            currentMatches,
          );
          if (currentMatches.length > 0 && !currentOverride) {
            throw new PossibleDuplicateDetected(currentMatches);
          }

        const projectId = randomUUID();
        const transitionId = randomUUID();
        const now = new Date().toISOString();
        const metadata = registrationMetadata(registration);
        const title = jobApplicationTitle(
          registration.company,
          registration.role,
        );

        this.database
          .prepare(
            `INSERT INTO projects(
               id, workspace_id, project_type, title, status,
               lifecycle_state, lifecycle_version, record_version,
               metadata_json, created_at, updated_at
             ) VALUES (?, ?, 'job_application', ?, 'ACTIVE', 'APPLIED', 1, 1,
                       ?, ?, ?)`,
          )
          .run(
            projectId,
            identity.workspaceId,
            title,
            canonicalJson(metadata),
            now,
            now,
          );

        this.database
          .prepare(
            `INSERT INTO state_transitions(
               id, project_id, from_state, to_state, from_version, to_version,
               trigger_type, status, proposed_by, proposal_rationale,
               canonical_hash, admitted_by, admission_authority_type,
               admission_authority_reference, proposed_at, admitted_at
             ) VALUES (?, ?, 'NONE', 'APPLIED', 0, 1, 'USER_ASSERTION',
                       'ADMITTED', 'USER', 'Job Application registered by user',
                       ?, 'USER', 'EXPLICIT_USER_DEV', ?, ?, ?)`,
          )
          .run(
            transitionId,
            projectId,
            canonicalHash({
              projectId,
              fromState: "NONE",
              toState: "APPLIED",
              triggerType: "USER_ASSERTION",
              authorityReference,
            }),
            authorityReference,
            now,
            now,
          );

        return {
          creationStatus: "CREATED" as const,
          project: this.getAuthorizedProject(projectId, identity.workspaceId),
          initialTransition: this.getTransition(transitionId),
          replayed: false,
        };
        },
      );
    } catch (error) {
      if (error instanceof PossibleDuplicateDetected) {
        return possibleDuplicateResult(error.matches);
      }
      throw error;
    }
  }

  listJobApplications(includeClosed = false): ListJobApplicationsResult {
    const identity = this.resolveDevelopmentIdentity();
    const statusClause = includeClosed ? "" : "AND status <> 'CLOSED'";
    const total = this.database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM projects
         WHERE workspace_id = ? AND project_type = 'job_application'
         ${statusClause}`,
      )
      .get(identity.workspaceId) as { count: number };

    const rows = this.database
      .prepare(
        `SELECT id, workspace_id, project_type, title, status,
                lifecycle_state, lifecycle_version, record_version,
                metadata_json, created_at, updated_at
         FROM projects
         WHERE workspace_id = ? AND project_type = 'job_application'
         ${statusClause}
         ORDER BY updated_at DESC, id ASC
         LIMIT ?`,
      )
      .all(
        identity.workspaceId,
        JOB_APPLICATION_LIST_LIMIT,
      ) as unknown as ProjectRow[];

    return {
      applications: rows.map((row) => mapJobApplicationSummary(row)),
      totalCount: total.count,
      truncated: total.count > rows.length,
      includeClosed,
    };
  }

  updateJobApplication(input: UpdateJobApplicationInput): {
    project: ProjectRecord;
    changed: boolean;
    replayed: boolean;
  } {
    const identity = this.resolveDevelopmentIdentity();
    if (!Number.isInteger(input.expectedRecordVersion) || input.expectedRecordVersion < 1) {
      throw new ValidationError("expectedRecordVersion must be a positive integer");
    }
    const patch = normalizeJobApplicationUpdate(input);
    if (Object.keys(patch).length === 0) {
      throw new ValidationError("At least one registration metadata field is required");
    }

    const payload = {
      projectId: input.projectId,
      expectedRecordVersion: input.expectedRecordVersion,
      patch,
    };

    return this.runIdempotent(
      identity.workspaceId,
      "workspace_update_job_application",
      input.idempotencyKey,
      payload,
      () => {
        const project = this.getAuthorizedProject(
          input.projectId,
          identity.workspaceId,
        );
        if (project.projectType !== "job_application") {
          throw new ValidationError("Project is not a Job Application");
        }
        if (project.recordVersion !== input.expectedRecordVersion) {
          throw new ConcurrencyConflictError(
            "Project registration metadata changed after it was read",
          );
        }

        const current = readJobApplicationRegistration(project.metadata);
        const next = { ...current, ...patch };
        const changed = canonicalJson(current) !== canonicalJson(next);
        if (!changed) {
          return { project, changed: false, replayed: false };
        }

        const now = new Date().toISOString();
        const nextMetadata: Record<string, JsonValue> = {
          ...project.metadata,
          ...patch,
          company: next.company,
          role: next.role,
        };
        const update = this.database
          .prepare(
            `UPDATE projects
             SET title = ?, metadata_json = ?, record_version = record_version + 1,
                 updated_at = ?
             WHERE id = ? AND workspace_id = ? AND project_type = 'job_application'
               AND record_version = ?`,
          )
          .run(
            jobApplicationTitle(next.company, next.role),
            canonicalJson(nextMetadata),
            now,
            project.id,
            identity.workspaceId,
            input.expectedRecordVersion,
          );

        if (update.changes !== 1) {
          throw new ConcurrencyConflictError(
            "Concurrent registration update prevented this change",
          );
        }

        return {
          project: this.getAuthorizedProject(project.id, identity.workspaceId),
          changed: true,
          replayed: false,
        };
      },
    );
  }

  getProject(projectId: string): ProjectDetails {
    const identity = this.resolveDevelopmentIdentity();
    const project = this.getAuthorizedProject(projectId, identity.workspaceId);

    const resources = this.database
      .prepare(
        `SELECT id, project_id, resource_type, provider, external_id,
                external_uri, title, observed_facts_json, observed_at, created_at
         FROM resources WHERE project_id = ? ORDER BY created_at DESC, id ASC
         LIMIT ?`,
      )
      .all(projectId, PROJECT_HISTORY_LIMIT) as unknown as ResourceRow[];

    const transitionRows = this.database
      .prepare(
        `SELECT id, project_id, from_state, to_state, from_version, to_version,
                trigger_type, status, proposed_by, proposal_rationale,
                admitted_by, admission_authority_type,
                admission_authority_reference, proposed_at, admitted_at,
                rejection_reason
         FROM state_transitions WHERE project_id = ?
         ORDER BY proposed_at DESC, id ASC LIMIT ?`,
      )
      .all(projectId, PROJECT_HISTORY_LIMIT) as unknown as TransitionRow[];

    const tasks = this.database
      .prepare(
        `SELECT id, project_id, title, task_kind, status, priority, due_at,
                record_version, created_by, updated_by, source_transition_id,
                created_at, updated_at, completed_at
         FROM tasks
         WHERE project_id = ? AND status NOT IN ('DONE', 'CANCELLED')
         ORDER BY created_at DESC`,
      )
      .all(projectId) as unknown as TaskRow[];

    const totalCounts = this.database
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM resources WHERE project_id = ?) AS resources,
           (SELECT COUNT(*) FROM state_transitions WHERE project_id = ?) AS transitions,
           (SELECT COUNT(*) FROM tasks
            WHERE project_id = ? AND status NOT IN ('DONE', 'CANCELLED')) AS open_tasks`,
      )
      .get(projectId, projectId, projectId) as {
      resources: number;
      transitions: number;
      open_tasks: number;
    };

    return {
      project,
      resources: resources.map((row) => this.mapResource(row)),
      transitions: transitionRows.map((row) => this.mapTransition(row)),
      openTasks: tasks.map((row) => mapTask(row)),
      totalCounts: {
        resources: totalCounts.resources,
        transitions: totalCounts.transitions,
        openTasks: totalCounts.open_tasks,
      },
    };
  }

  findJobApplication(company: string, role: string): FindJobApplicationResult {
    const identity = this.resolveDevelopmentIdentity();
    const normalizedCompany = normalizeJobApplicationLookupValue(company);
    const normalizedRole = normalizeJobApplicationLookupValue(role);

    if (!normalizedCompany || !normalizedRole) {
      throw new ValidationError("Company and role are required");
    }

    const rows = this.database
      .prepare(
        `SELECT id, workspace_id, project_type, title, status,
                lifecycle_state, lifecycle_version, record_version, metadata_json,
                created_at, updated_at
         FROM projects
         WHERE workspace_id = ?
           AND project_type = 'job_application'
           AND status <> 'CLOSED'
         ORDER BY updated_at DESC, id ASC`,
      )
      .all(identity.workspaceId) as unknown as ProjectRow[];

    const matches = rows.flatMap((row): JobApplicationMatch[] => {
      const metadata = JSON.parse(row.metadata_json) as Record<
        string,
        JsonValue
      >;
      const candidateCompany = metadata.company;
      const candidateRole = metadata.role;

      if (
        typeof candidateCompany !== "string" ||
        typeof candidateRole !== "string" ||
        normalizeJobApplicationLookupValue(candidateCompany) !==
          normalizedCompany ||
        normalizeJobApplicationLookupValue(candidateRole) !== normalizedRole
      ) {
        return [];
      }

      return [
        {
          projectId: row.id,
          title: row.title,
          company: candidateCompany,
          role: candidateRole,
          projectStatus: row.status,
          lifecycleState: row.lifecycle_state,
          lifecycleVersion: row.lifecycle_version,
          recordVersion: row.record_version,
          updatedAt: row.updated_at,
        },
      ];
    });

    return {
      matchStatus:
        matches.length === 0
          ? "NOT_FOUND"
          : matches.length === 1
            ? "EXACT"
            : "AMBIGUOUS",
      matches,
    };
  }

  recordObservation(input: RecordObservationInput): {
    resource: ResourceRecord;
    projectStateChanged: false;
    deduplicated: boolean;
    replayed: boolean;
  } {
    const normalizedInput = normalizeRecordObservationInput(input);
    const identity = this.resolveDevelopmentIdentity();
    const payload = {
      projectId: normalizedInput.projectId,
      resourceType: normalizedInput.resourceType,
      provider: normalizedInput.provider,
      externalId: normalizedInput.externalId,
      externalUri: normalizedInput.externalUri,
      title: normalizedInput.title,
      observedFacts: normalizedInput.observedFacts,
      observedAt: normalizedInput.observedAt,
    };

    return this.runIdempotent(
      identity.workspaceId,
      "workspace_record_observation",
      normalizedInput.idempotencyKey,
      payload,
      () => {
        this.getAuthorizedProject(
          normalizedInput.projectId,
          identity.workspaceId,
        );
        const exactHash = canonicalHash(payload);

        let existing: ResourceRow | undefined;
        if (normalizedInput.externalId) {
          existing = this.database
            .prepare(
              `SELECT id, project_id, resource_type, provider, external_id,
                      external_uri, title, observed_facts_json, observed_at,
                      created_at
               FROM resources
               WHERE project_id = ? AND provider = ? AND external_id = ?`,
            )
            .get(
              normalizedInput.projectId,
              normalizedInput.provider,
              normalizedInput.externalId,
            ) as ResourceRow | undefined;
        } else {
          existing = this.database
            .prepare(
              `SELECT id, project_id, resource_type, provider, external_id,
                      external_uri, title, observed_facts_json, observed_at,
                      created_at
               FROM resources
               WHERE project_id = ? AND canonical_hash = ?`,
            )
            .get(normalizedInput.projectId, exactHash) as
            | ResourceRow
            | undefined;
        }

        if (existing) {
          return {
            resource: this.mapResource(existing),
            projectStateChanged: false,
            deduplicated: true,
            replayed: false,
          };
        }

        const id = randomUUID();
        const now = new Date().toISOString();
        this.database
          .prepare(
            `INSERT INTO resources(
               id, project_id, resource_type, provider, external_id,
               external_uri, title, observed_facts_json, evidence_snapshot_json,
               observed_at, canonical_hash, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
          )
          .run(
            id,
            normalizedInput.projectId,
            normalizedInput.resourceType,
            normalizedInput.provider,
            normalizedInput.externalId,
            normalizedInput.externalUri,
            normalizedInput.title,
            canonicalJson(normalizedInput.observedFacts),
            normalizedInput.observedAt,
            exactHash,
            now,
          );

        return {
          resource: this.getResource(id),
          projectStateChanged: false,
          deduplicated: false,
          replayed: false,
        };
      },
    );
  }

  proposeTransition(input: ProposeTransitionInput): {
    transition: TransitionRecord;
    projectStateChanged: false;
    deduplicated: boolean;
    replayed: boolean;
  } {
    const identity = this.resolveDevelopmentIdentity();
    const evidenceResourceIds = [...new Set(input.evidenceResourceIds)].sort();
    const payload = {
      projectId: input.projectId,
      expectedLifecycleVersion: input.expectedLifecycleVersion,
      toState: input.toState,
      triggerType: input.triggerType,
      evidenceResourceIds,
      rationale: input.rationale,
    };

    return this.runIdempotent(
      identity.workspaceId,
      "workspace_propose_transition",
      input.idempotencyKey,
      payload,
      () => {
        const project = this.getAuthorizedProject(
          input.projectId,
          identity.workspaceId,
        );
        if (project.lifecycleVersion !== input.expectedLifecycleVersion) {
          throw new ConcurrencyConflictError(
            `Expected lifecycle version ${input.expectedLifecycleVersion}, current version is ${project.lifecycleVersion}`,
          );
        }
        if (!isLifecycleState(project.lifecycleState)) {
          throw new ValidationError(
            `Unsupported current lifecycle state: ${project.lifecycleState}`,
          );
        }

        const proposalHash = canonicalHash(payload);
        const existing = this.database
          .prepare(
            `SELECT id, project_id, from_state, to_state, from_version, to_version,
                    trigger_type, status, proposed_by, proposal_rationale,
                    admitted_by, admission_authority_type,
                    admission_authority_reference, proposed_at, admitted_at,
                    rejection_reason
             FROM state_transitions
             WHERE project_id = ? AND canonical_hash = ?`,
          )
          .get(input.projectId, proposalHash) as TransitionRow | undefined;

        if (existing) {
          return {
            transition: this.mapTransition(existing),
            projectStateChanged: false,
            deduplicated: true,
            replayed: false,
          };
        }

        const verifiedEvidenceIds: string[] = [];
        let rejectionReason: string | null = null;

        if (!isAllowedTransition(project.lifecycleState, input.toState)) {
          rejectionReason = `Transition ${project.lifecycleState} -> ${input.toState} is not allowed in Spike 1A`;
        }

        if (
          !rejectionReason &&
          input.triggerType === "EXTERNAL_EVIDENCE" &&
          evidenceResourceIds.length === 0
        ) {
          rejectionReason =
            "EXTERNAL_EVIDENCE transitions require at least one evidence Resource";
        }

        for (const resourceId of evidenceResourceIds) {
          const resource = this.database
            .prepare("SELECT project_id FROM resources WHERE id = ?")
            .get(resourceId) as { project_id: string } | undefined;
          if (!resource || resource.project_id !== input.projectId) {
            rejectionReason ??=
              `Evidence Resource ${resourceId} does not belong to this Project`;
          } else {
            verifiedEvidenceIds.push(resourceId);
          }
        }

        const id = randomUUID();
        const now = new Date().toISOString();
        const status = rejectionReason ? "REJECTED" : "PROPOSED";
        this.database
          .prepare(
            `INSERT INTO state_transitions(
               id, project_id, from_state, to_state, from_version, to_version,
               trigger_type, status, proposed_by, proposal_rationale,
               canonical_hash, proposed_at, rejection_reason
             ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'CHATGPT', ?, ?, ?, ?)`,
          )
          .run(
            id,
            input.projectId,
            project.lifecycleState,
            input.toState,
            project.lifecycleVersion,
            input.triggerType,
            status,
            input.rationale,
            proposalHash,
            now,
            rejectionReason,
          );

        const insertEvidence = this.database.prepare(
          "INSERT INTO transition_evidence(transition_id, resource_id) VALUES (?, ?)",
        );
        for (const resourceId of verifiedEvidenceIds) {
          insertEvidence.run(id, resourceId);
        }

        return {
          transition: this.getTransition(id),
          projectStateChanged: false,
          deduplicated: false,
          replayed: false,
        };
      },
    );
  }

  admitTransition(input: AdmitTransitionInput): {
    project: ProjectRecord;
    transition: TransitionRecord;
    derivedTask: TaskRecord | null;
    alreadyAdmitted: boolean;
    replayed: boolean;
  } {
    const identity = this.resolveDevelopmentIdentity();
    const authorityReference = input.authority.reference.trim();
    if (!input.authority.confirmed || authorityReference.length === 0) {
      throw new AuthorizationError(
        "Admission requires an explicit user-authority assertion",
      );
    }

    const payload = {
      transitionId: input.transitionId,
      expectedLifecycleVersion: input.expectedLifecycleVersion,
      authority: {
        type: input.authority.type,
        confirmed: input.authority.confirmed,
        reference: authorityReference,
      },
    };

    return this.runIdempotent(
      identity.workspaceId,
      "workspace_admit_transition",
      input.idempotencyKey,
      payload,
      () => {
        const transition = this.getAuthorizedTransition(
          input.transitionId,
          identity.workspaceId,
        );

        if (transition.status === "REJECTED") {
          throw new ValidationError("A rejected transition cannot be admitted");
        }

        if (transition.status === "ADMITTED") {
          return {
            project: this.getAuthorizedProject(
              transition.projectId,
              identity.workspaceId,
            ),
            transition,
            derivedTask: this.getTaskForTransition(transition.id),
            alreadyAdmitted: true,
            replayed: false,
          };
        }

        if (transition.fromVersion !== input.expectedLifecycleVersion) {
          throw new ConcurrencyConflictError(
            "Admission expected version does not match the proposal version",
          );
        }

        const project = this.getAuthorizedProject(
          transition.projectId,
          identity.workspaceId,
        );
        if (
          project.lifecycleVersion !== input.expectedLifecycleVersion ||
          project.lifecycleState !== transition.fromState
        ) {
          throw new ConcurrencyConflictError(
            "Project lifecycle changed after this transition was proposed",
          );
        }
        if (
          !isLifecycleState(transition.fromState) ||
          !isLifecycleState(transition.toState) ||
          !isAllowedTransition(transition.fromState, transition.toState)
        ) {
          throw new ValidationError("Transition is no longer allowed");
        }
        if (
          transition.triggerType === "EXTERNAL_EVIDENCE" &&
          transition.evidenceResourceIds.length === 0
        ) {
          throw new ValidationError(
            "External-evidence transition has no attributable evidence",
          );
        }

        const now = new Date().toISOString();
        const nextVersion = project.lifecycleVersion + 1;
        const projectUpdate = this.database
          .prepare(
            `UPDATE projects
             SET lifecycle_state = ?, lifecycle_version = ?, updated_at = ?
             WHERE id = ? AND workspace_id = ?
               AND lifecycle_state = ? AND lifecycle_version = ?`,
          )
          .run(
            transition.toState,
            nextVersion,
            now,
            project.id,
            identity.workspaceId,
            transition.fromState,
            input.expectedLifecycleVersion,
          );

        if (projectUpdate.changes !== 1) {
          throw new ConcurrencyConflictError(
            "Concurrent lifecycle update prevented admission",
          );
        }

        const transitionUpdate = this.database
          .prepare(
            `UPDATE state_transitions
             SET status = 'ADMITTED', to_version = ?, admitted_by = 'USER',
                 admission_authority_type = 'EXPLICIT_USER_DEV',
                 admission_authority_reference = ?, admitted_at = ?
             WHERE id = ? AND status = 'PROPOSED'`,
          )
          .run(nextVersion, authorityReference, now, transition.id);

        if (transitionUpdate.changes !== 1) {
          throw new ConcurrencyConflictError(
            "Concurrent transition update prevented admission",
          );
        }

        const taskDefinition = derivedTaskForTransition(
          transition.fromState,
          transition.toState,
        );
        if (taskDefinition) {
          this.database
            .prepare(
              `INSERT OR IGNORE INTO tasks(
                 id, project_id, title, task_kind, status, priority, due_at,
                 record_version, created_by, updated_by, source_transition_id,
                 created_at, updated_at, completed_at
               ) VALUES (?, ?, ?, ?, 'TODO', ?, NULL, 1, 'SYSTEM', 'SYSTEM',
                         ?, ?, ?, NULL)`,
            )
            .run(
              randomUUID(),
              project.id,
              taskDefinition.title,
              taskDefinition.taskKind,
              taskDefinition.priority,
              transition.id,
              now,
              now,
            );
        }

        return {
          project: this.getAuthorizedProject(project.id, identity.workspaceId),
          transition: this.getTransition(transition.id),
          derivedTask: this.getTaskForTransition(transition.id),
          alreadyAdmitted: false,
          replayed: false,
        };
      },
    );
  }

  private runIdempotent<T extends ReplayableResult>(
    workspaceId: string,
    operation: string,
    idempotencyKey: string,
    payload: unknown,
    work: () => T,
  ): T {
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) {
      throw new ValidationError("idempotencyKey is required");
    }

    return this.database.transaction(() => {
      const replay = this.readIdempotentReplay<T>(
        workspaceId,
        operation,
        normalizedKey,
        payload,
      );
      if (replay) return replay;

      const response = work();
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
          canonicalHash(payload),
          canonicalJson(response),
          new Date().toISOString(),
        );
      return response;
    })();
  }

  private readIdempotentReplay<T extends ReplayableResult>(
    workspaceId: string,
    operation: string,
    idempotencyKey: string,
    payload: unknown,
  ): T | null {
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) {
      throw new ValidationError("idempotencyKey is required");
    }

    const existing = this.database
      .prepare(
        `SELECT request_hash, response_json
         FROM idempotency_records
         WHERE workspace_id = ? AND operation = ? AND idempotency_key = ?`,
      )
      .get(workspaceId, operation, normalizedKey) as IdempotencyRow | undefined;
    if (!existing) return null;

    if (existing.request_hash !== canonicalHash(payload)) {
      throw new IdempotencyConflictError(
        "The idempotency key was already used with a different payload",
      );
    }

    const replayed = JSON.parse(existing.response_json) as T;
    return { ...replayed, replayed: true };
  }

  private findExactActiveJobApplications(
    workspaceId: string,
    company: string,
    role: string,
  ): JobApplicationSummary[] {
    const normalizedCompany = normalizeJobApplicationLookupValue(company);
    const normalizedRole = normalizeJobApplicationLookupValue(role);
    const rows = this.database
      .prepare(
        `SELECT id, workspace_id, project_type, title, status,
                lifecycle_state, lifecycle_version, record_version,
                metadata_json, created_at, updated_at
         FROM projects
         WHERE workspace_id = ?
           AND project_type = 'job_application'
           AND status = 'ACTIVE'
         ORDER BY updated_at DESC, id ASC`,
      )
      .all(workspaceId) as unknown as ProjectRow[];

    return rows
      .map((row) => mapJobApplicationSummary(row))
      .filter(
        (application) =>
          normalizeJobApplicationLookupValue(application.company) ===
            normalizedCompany &&
          normalizeJobApplicationLookupValue(application.role) === normalizedRole,
      );
  }

  private getAuthorizedProject(
    projectId: string,
    workspaceId: string,
  ): ProjectRecord {
    const row = this.database
      .prepare(
        `SELECT id, workspace_id, project_type, title, status,
                lifecycle_state, lifecycle_version, record_version,
                metadata_json,
                created_at, updated_at
         FROM projects WHERE id = ? AND workspace_id = ?`,
      )
      .get(projectId, workspaceId) as ProjectRow | undefined;

    if (!row) {
      throw new NotFoundError(`Project ${projectId} was not found`);
    }
    if (!isLifecycleState(row.lifecycle_state)) {
      throw new ValidationError(
        `Project has unsupported lifecycle state ${row.lifecycle_state}`,
      );
    }

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      projectType: row.project_type,
      title: row.title,
      status: row.status,
      lifecycleState: row.lifecycle_state,
      lifecycleVersion: row.lifecycle_version,
      recordVersion: row.record_version,
      metadata: JSON.parse(row.metadata_json) as Record<string, JsonValue>,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private getResource(resourceId: string): ResourceRecord {
    const row = this.database
      .prepare(
        `SELECT id, project_id, resource_type, provider, external_id,
                external_uri, title, observed_facts_json, observed_at, created_at
         FROM resources WHERE id = ?`,
      )
      .get(resourceId) as ResourceRow | undefined;
    if (!row) {
      throw new NotFoundError(`Resource ${resourceId} was not found`);
    }
    return this.mapResource(row);
  }

  private getTransition(transitionId: string): TransitionRecord {
    const row = this.database
      .prepare(
        `SELECT id, project_id, from_state, to_state, from_version, to_version,
                trigger_type, status, proposed_by, proposal_rationale,
                admitted_by, admission_authority_type,
                admission_authority_reference, proposed_at, admitted_at,
                rejection_reason
         FROM state_transitions WHERE id = ?`,
      )
      .get(transitionId) as TransitionRow | undefined;
    if (!row) {
      throw new NotFoundError(`Transition ${transitionId} was not found`);
    }
    return this.mapTransition(row);
  }

  private getAuthorizedTransition(
    transitionId: string,
    workspaceId: string,
  ): TransitionRecord {
    const row = this.database
      .prepare(
        `SELECT st.id, st.project_id, st.from_state, st.to_state,
                st.from_version, st.to_version, st.trigger_type, st.status,
                st.proposed_by, st.proposal_rationale, st.admitted_by,
                st.admission_authority_type, st.admission_authority_reference,
                st.proposed_at, st.admitted_at, st.rejection_reason
         FROM state_transitions st
         JOIN projects p ON p.id = st.project_id
         WHERE st.id = ? AND p.workspace_id = ?`,
      )
      .get(transitionId, workspaceId) as TransitionRow | undefined;
    if (!row) {
      throw new NotFoundError(`Transition ${transitionId} was not found`);
    }
    return this.mapTransition(row);
  }

  private getTaskForTransition(transitionId: string): TaskRecord | null {
    const row = this.database
      .prepare(
        `SELECT id, project_id, title, task_kind, status, priority, due_at,
                record_version, created_by, updated_by, source_transition_id,
                created_at, updated_at, completed_at
         FROM tasks WHERE source_transition_id = ? ORDER BY created_at LIMIT 1`,
      )
      .get(transitionId) as TaskRow | undefined;
    return row ? mapTask(row) : null;
  }

  private mapResource(row: ResourceRow): ResourceRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      resourceType: row.resource_type,
      provider: row.provider,
      externalId: row.external_id,
      externalUri: row.external_uri,
      title: row.title,
      observedFacts: JSON.parse(row.observed_facts_json) as Record<
        string,
        JsonValue
      >,
      observedAt: row.observed_at,
      createdAt: row.created_at,
    };
  }

  private mapTransition(row: TransitionRow): TransitionRecord {
    const evidenceRows = this.database
      .prepare(
        `SELECT resource_id FROM transition_evidence
         WHERE transition_id = ? ORDER BY resource_id`,
      )
      .all(row.id) as unknown as { resource_id: string }[];

    return {
      id: row.id,
      projectId: row.project_id,
      fromState: row.from_state,
      toState: row.to_state,
      fromVersion: row.from_version,
      toVersion: row.to_version,
      triggerType: row.trigger_type,
      status: row.status,
      proposedBy: row.proposed_by,
      proposalRationale: row.proposal_rationale,
      evidenceResourceIds: evidenceRows.map((entry) => entry.resource_id),
      admittedBy: row.admitted_by,
      admissionAuthorityType: row.admission_authority_type,
      admissionAuthorityReference: row.admission_authority_reference,
      proposedAt: row.proposed_at,
      admittedAt: row.admitted_at,
      rejectionReason: row.rejection_reason,
    };
  }

}

interface NormalizedJobApplicationRegistration {
  company: string;
  role: string;
  appliedDate: string | null;
  location: string | null;
  postingReference: string | null;
}

type JobApplicationRegistrationPatch = Partial<
  NormalizedJobApplicationRegistration
>;

function possibleDuplicateResult(
  matches: JobApplicationSummary[],
): CreateJobApplicationResult {
  return {
    creationStatus: "POSSIBLE_DUPLICATE",
    matches,
    replayed: false,
  };
}

function validateDistinctDuplicateOverride(
  allowDistinctDuplicate: boolean,
  postingReference: string | null,
  matches: JobApplicationSummary[],
): boolean {
  if (!allowDistinctDuplicate) return false;
  if (postingReference === null) {
    throw new ValidationError(
      "allowDistinctDuplicate requires a sanitized postingReference",
    );
  }
  if (
    matches.some(
      (match) => match.postingReference === postingReference,
    )
  ) {
    throw new ValidationError(
      "postingReference does not distinguish this application from the existing active match",
    );
  }
  return true;
}

function normalizeJobApplicationRegistration(
  input: Pick<
    CreateJobApplicationInput,
    "company" | "role" | "appliedDate" | "location" | "postingReference"
  >,
): NormalizedJobApplicationRegistration {
  return {
    company: normalizeRequiredRegistrationText(input.company, "company"),
    role: normalizeRequiredRegistrationText(input.role, "role"),
    appliedDate: normalizeAppliedDate(input.appliedDate ?? null),
    location: normalizeOptionalRegistrationText(input.location ?? null, "location"),
    postingReference: normalizePostingReference(input.postingReference ?? null),
  };
}

function normalizeJobApplicationUpdate(
  input: UpdateJobApplicationInput,
): JobApplicationRegistrationPatch {
  const patch: JobApplicationRegistrationPatch = {};
  if (Object.hasOwn(input, "company")) {
    if (input.company === undefined) {
      throw new ValidationError("company must not be undefined when supplied");
    }
    patch.company = normalizeRequiredRegistrationText(input.company, "company");
  }
  if (Object.hasOwn(input, "role")) {
    if (input.role === undefined) {
      throw new ValidationError("role must not be undefined when supplied");
    }
    patch.role = normalizeRequiredRegistrationText(input.role, "role");
  }
  if (Object.hasOwn(input, "appliedDate")) {
    patch.appliedDate = normalizeAppliedDate(input.appliedDate ?? null);
  }
  if (Object.hasOwn(input, "location")) {
    patch.location = normalizeOptionalRegistrationText(
      input.location ?? null,
      "location",
    );
  }
  if (Object.hasOwn(input, "postingReference")) {
    patch.postingReference = normalizePostingReference(
      input.postingReference ?? null,
    );
  }
  return patch;
}

function normalizeRequiredRegistrationText(value: string, field: string): string {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!normalized) {
    throw new ValidationError(`${field} is required`);
  }
  if (normalized.length > 500) {
    throw new ValidationError(`${field} must not exceed 500 characters`);
  }
  return normalized;
}

function normalizeOptionalRegistrationText(
  value: string | null,
  field: string,
): string | null {
  if (value === null) return null;
  return normalizeRequiredRegistrationText(value, field);
}

function normalizeAppliedDate(value: string | null): string | null {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new ValidationError("appliedDate must use YYYY-MM-DD");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ValidationError("appliedDate must be a valid calendar date");
  }
  return value;
}

function normalizePostingReference(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2_000) {
    throw new ValidationError(
      "postingReference must be a non-empty URL of at most 2000 characters",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError("postingReference must be a valid HTTP(S) URL");
  }
  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    parsed.username ||
    parsed.password
  ) {
    throw new ValidationError(
      "postingReference must be an HTTP(S) URL without credentials",
    );
  }
  parsed.search = "";
  parsed.hash = "";
  const sanitized = parsed.toString();
  if (emailAddressPattern.test(sanitized)) {
    throw new ValidationError("postingReference must not contain an email address");
  }
  return sanitized;
}

function registrationMetadata(
  registration: NormalizedJobApplicationRegistration,
): Record<string, JsonValue> {
  return {
    company: registration.company,
    role: registration.role,
    appliedDate: registration.appliedDate,
    location: registration.location,
    postingReference: registration.postingReference,
  };
}

function readJobApplicationRegistration(
  metadata: Record<string, JsonValue>,
): NormalizedJobApplicationRegistration {
  if (typeof metadata.company !== "string" || typeof metadata.role !== "string") {
    throw new ValidationError("Job Application registration metadata is invalid");
  }
  return {
    company: normalizeRequiredRegistrationText(metadata.company, "company"),
    role: normalizeRequiredRegistrationText(metadata.role, "role"),
    appliedDate:
      typeof metadata.appliedDate === "string"
        ? normalizeAppliedDate(metadata.appliedDate)
        : null,
    location:
      typeof metadata.location === "string"
        ? normalizeOptionalRegistrationText(metadata.location, "location")
        : null,
    postingReference:
      typeof metadata.postingReference === "string"
        ? normalizePostingReference(metadata.postingReference)
        : null,
  };
}

function jobApplicationTitle(company: string, role: string): string {
  return `${company} — ${role}`;
}

function mapJobApplicationSummary(row: ProjectRow): JobApplicationSummary {
  const metadata = readJobApplicationRegistration(
    JSON.parse(row.metadata_json) as Record<string, JsonValue>,
  );
  return {
    projectId: row.id,
    title: row.title,
    company: metadata.company,
    role: metadata.role,
    appliedDate: metadata.appliedDate,
    location: metadata.location,
    postingReference: metadata.postingReference,
    projectStatus: row.status,
    lifecycleState: row.lifecycle_state,
    lifecycleVersion: row.lifecycle_version,
    recordVersion: row.record_version,
    updatedAt: row.updated_at,
  };
}

function normalizeJobApplicationLookupValue(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

const emailAddressPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu;
const senderDomainPattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

function normalizeRecordObservationInput(
  input: RecordObservationInput,
): RecordObservationInput {
  const provider = input.provider.trim();
  if (provider.toLowerCase() !== "gmail") {
    return input;
  }

  if (input.resourceType !== "EMAIL" || !input.externalId?.trim()) {
    throw new ValidationError(
      "Canonical Gmail observations require resourceType EMAIL and a stable individual message ID",
    );
  }

  if (
    containsEmailAddress(input.observedFacts) ||
    (input.title !== null && emailAddressPattern.test(input.title)) ||
    (input.externalUri !== null && emailAddressPattern.test(input.externalUri))
  ) {
    throw new ValidationError(
      "Canonical Gmail observations must not contain full email addresses; store senderDomain instead",
    );
  }

  return {
    ...input,
    provider: "gmail",
    externalId: input.externalId.trim(),
    observedFacts: normalizeCanonicalGmailObservedFacts(input.observedFacts),
  };
}

function normalizeCanonicalGmailObservedFacts(
  observedFacts: Record<string, JsonValue>,
): Record<string, JsonValue> {
  assertExactKeys(
    observedFacts,
    ["contractVersion", "sourceFacts", "interpretation"],
    "Canonical Gmail observedFacts",
  );
  if (observedFacts.contractVersion !== "gmail-job-observation-v0.1") {
    throw new ValidationError(
      "Canonical Gmail observations require contractVersion gmail-job-observation-v0.1",
    );
  }

  const sourceFacts = requireJsonObject(
    observedFacts.sourceFacts,
    "Canonical Gmail sourceFacts",
  );
  assertAllowedAndRequiredKeys(
    sourceFacts,
    ["receivedAt", "senderDomain", "threadId"],
    ["receivedAt"],
    "Canonical Gmail sourceFacts",
  );

  const interpretation = requireJsonObject(
    observedFacts.interpretation,
    "Canonical Gmail interpretation",
  );
  assertExactKeys(
    interpretation,
    ["company", "role", "emailKind", "summary"],
    "Canonical Gmail interpretation",
  );

  const receivedAt = requireNonEmptyString(
    sourceFacts.receivedAt,
    "Canonical Gmail sourceFacts.receivedAt",
  );
  const company = requireNonEmptyString(
    interpretation.company,
    "Canonical Gmail interpretation.company",
  );
  const role = requireNonEmptyString(
    interpretation.role,
    "Canonical Gmail interpretation.role",
  );
  const summary = requireNonEmptyString(
    interpretation.summary,
    "Canonical Gmail interpretation.summary",
  );
  const emailKind = requireNonEmptyString(
    interpretation.emailKind,
    "Canonical Gmail interpretation.emailKind",
  );
  if (emailKind !== "RECRUITER_CONTACT" && emailKind !== "OTHER") {
    throw new ValidationError(
      "Canonical Gmail interpretation.emailKind must be RECRUITER_CONTACT or OTHER",
    );
  }

  const normalizedSourceFacts: Record<string, JsonValue> = { receivedAt };
  if (sourceFacts.senderDomain !== undefined) {
    const senderDomain = requireNonEmptyString(
      sourceFacts.senderDomain,
      "Canonical Gmail sourceFacts.senderDomain",
    ).toLowerCase();
    if (!senderDomainPattern.test(senderDomain)) {
      throw new ValidationError(
        "Canonical Gmail sourceFacts.senderDomain must be a domain, not a sender identity",
      );
    }
    normalizedSourceFacts.senderDomain = senderDomain;
  }
  if (sourceFacts.threadId !== undefined) {
    normalizedSourceFacts.threadId = requireNonEmptyString(
      sourceFacts.threadId,
      "Canonical Gmail sourceFacts.threadId",
    );
  }

  return {
    contractVersion: "gmail-job-observation-v0.1",
    sourceFacts: normalizedSourceFacts,
    interpretation: { company, role, emailKind, summary },
  };
}

function containsEmailAddress(value: JsonValue): boolean {
  if (typeof value === "string") return emailAddressPattern.test(value);
  if (Array.isArray(value)) return value.some(containsEmailAddress);
  if (value && typeof value === "object") {
    return Object.values(value).some(containsEmailAddress);
  }
  return false;
}

function requireJsonObject(
  value: JsonValue | undefined,
  label: string,
): Record<string, JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an object`);
  }
  return value;
}

function requireNonEmptyString(
  value: JsonValue | undefined,
  label: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function assertExactKeys(
  value: Record<string, JsonValue>,
  keys: string[],
  label: string,
): void {
  assertAllowedAndRequiredKeys(value, keys, keys, label);
}

function assertAllowedAndRequiredKeys(
  value: Record<string, JsonValue>,
  allowedKeys: string[],
  requiredKeys: string[],
  label: string,
): void {
  const actualKeys = Object.keys(value);
  if (
    actualKeys.some((key) => !allowedKeys.includes(key)) ||
    requiredKeys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new ValidationError(
      `${label} must contain only the approved provenance fields`,
    );
  }
}
