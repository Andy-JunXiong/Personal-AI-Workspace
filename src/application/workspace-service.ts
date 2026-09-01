import { randomUUID } from "node:crypto";
import type { WorkspaceDatabase } from "../persistence/database.js";
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
  task_kind: string;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  source_transition_id: string | null;
  created_at: string;
  updated_at: string;
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

export class WorkspaceService {
  constructor(
    private readonly database: WorkspaceDatabase,
    private readonly developmentPrincipal: DevelopmentPrincipalConfig,
  ) {}

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

  getProject(projectId: string): ProjectDetails {
    const identity = this.resolveDevelopmentIdentity();
    const project = this.getAuthorizedProject(projectId, identity.workspaceId);

    const resources = this.database
      .prepare(
        `SELECT id, project_id, resource_type, provider, external_id,
                external_uri, title, observed_facts_json, observed_at, created_at
         FROM resources WHERE project_id = ? ORDER BY created_at DESC`,
      )
      .all(projectId) as unknown as ResourceRow[];

    const transitionRows = this.database
      .prepare(
        `SELECT id, project_id, from_state, to_state, from_version, to_version,
                trigger_type, status, proposed_by, proposal_rationale,
                admitted_by, admission_authority_type,
                admission_authority_reference, proposed_at, admitted_at,
                rejection_reason
         FROM state_transitions WHERE project_id = ? ORDER BY proposed_at DESC`,
      )
      .all(projectId) as unknown as TransitionRow[];

    const tasks = this.database
      .prepare(
        `SELECT id, project_id, title, task_kind, status, priority,
                source_transition_id, created_at, updated_at
         FROM tasks
         WHERE project_id = ? AND status NOT IN ('DONE', 'CANCELLED')
         ORDER BY created_at DESC`,
      )
      .all(projectId) as unknown as TaskRow[];

    return {
      project,
      resources: resources.map((row) => this.mapResource(row)),
      transitions: transitionRows.map((row) => this.mapTransition(row)),
      openTasks: tasks.map((row) => this.mapTask(row)),
    };
  }

  recordObservation(input: RecordObservationInput): {
    resource: ResourceRecord;
    projectStateChanged: false;
    deduplicated: boolean;
    replayed: boolean;
  } {
    const identity = this.resolveDevelopmentIdentity();
    const payload = {
      projectId: input.projectId,
      resourceType: input.resourceType,
      provider: input.provider,
      externalId: input.externalId,
      externalUri: input.externalUri,
      title: input.title,
      observedFacts: input.observedFacts,
      observedAt: input.observedAt,
    };

    return this.runIdempotent(
      identity.workspaceId,
      "workspace_record_observation",
      input.idempotencyKey,
      payload,
      () => {
        this.getAuthorizedProject(input.projectId, identity.workspaceId);
        const exactHash = canonicalHash(payload);

        let existing: ResourceRow | undefined;
        if (input.externalId) {
          existing = this.database
            .prepare(
              `SELECT id, project_id, resource_type, provider, external_id,
                      external_uri, title, observed_facts_json, observed_at,
                      created_at
               FROM resources
               WHERE project_id = ? AND provider = ? AND external_id = ?`,
            )
            .get(
              input.projectId,
              input.provider,
              input.externalId,
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
            .get(input.projectId, exactHash) as ResourceRow | undefined;
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
            input.projectId,
            input.resourceType,
            input.provider,
            input.externalId,
            input.externalUri,
            input.title,
            canonicalJson(input.observedFacts),
            input.observedAt,
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
                 created_by, source_transition_id, created_at, updated_at
               ) VALUES (?, ?, ?, ?, 'TODO', ?, NULL, 'SYSTEM', ?, ?, ?)`,
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
      const requestHash = canonicalHash(payload);
      const existing = this.database
        .prepare(
          `SELECT request_hash, response_json
           FROM idempotency_records
           WHERE workspace_id = ? AND operation = ? AND idempotency_key = ?`,
        )
        .get(workspaceId, operation, normalizedKey) as
        | IdempotencyRow
        | undefined;

      if (existing) {
        if (existing.request_hash !== requestHash) {
          throw new IdempotencyConflictError(
            "The idempotency key was already used with a different payload",
          );
        }

        const replayed = JSON.parse(existing.response_json) as T;
        return { ...replayed, replayed: true };
      }

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
          requestHash,
          canonicalJson(response),
          new Date().toISOString(),
        );
      return response;
    })();
  }

  private getAuthorizedProject(
    projectId: string,
    workspaceId: string,
  ): ProjectRecord {
    const row = this.database
      .prepare(
        `SELECT id, workspace_id, project_type, title, status,
                lifecycle_state, lifecycle_version, metadata_json,
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
        `SELECT id, project_id, title, task_kind, status, priority,
                source_transition_id, created_at, updated_at
         FROM tasks WHERE source_transition_id = ? ORDER BY created_at LIMIT 1`,
      )
      .get(transitionId) as TaskRow | undefined;
    return row ? this.mapTask(row) : null;
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

  private mapTask(row: TaskRow): TaskRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      taskKind: row.task_kind,
      status: row.status,
      priority: row.priority,
      sourceTransitionId: row.source_transition_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
