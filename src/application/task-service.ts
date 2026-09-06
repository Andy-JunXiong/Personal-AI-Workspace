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
  ExplicitUserDevAuthority,
  IdentityContext,
  TaskKind,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from "../domain/types.js";
import type { WorkspaceDatabase } from "../persistence/database.js";

export type Clock = () => Date;
export type ProjectVisibilityResolver = (
  projectId: string,
  workspaceId: string,
) => void;

interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  task_kind: TaskKind;
  status: TaskStatus;
  priority: TaskPriority;
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

interface ReplayableResult {
  replayed: boolean;
}

interface TaskCommandContext extends IdentityContext {
  channel: "WEB" | "MCP";
}

interface ExplicitUserWebAuthority {
  type: "EXPLICIT_USER_WEB";
  reference: string;
}

type TaskMutationAuthority = ExplicitUserDevAuthority | ExplicitUserWebAuthority;

export interface CreateTaskInput {
  projectId: string;
  title: string;
  taskKind: TaskKind;
  priority: TaskPriority;
  dueAt?: string | null;
  authority: ExplicitUserDevAuthority;
  idempotencyKey: string;
}

export interface UpdateTaskInput {
  taskId: string;
  expectedRecordVersion: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: string | null;
  authority: TaskMutationAuthority;
  idempotencyKey: string;
}

export interface CompleteWebTaskInput {
  taskId: string;
  expectedRecordVersion: number;
  intentKey: string;
}

const TASK_KINDS: readonly TaskKind[] = [
  "FOLLOW_UP",
  "PREPARE_FOR_INTERVIEW",
  "RESPOND_TO_RECRUITER",
  "OTHER",
];
const TASK_PRIORITIES: readonly TaskPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];
const TASK_STATUSES: readonly TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
  "CANCELLED",
];
const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ["DONE", "CANCELLED"];

export class TaskService {
  constructor(
    private readonly database: WorkspaceDatabase,
    private readonly resolveContext: () => TaskCommandContext,
    private readonly assertProjectVisible: ProjectVisibilityResolver,
    private readonly clock: Clock = () => new Date(),
    private readonly assertMutationAllowed: () => void = () => {},
  ) {}

  createTask(input: CreateTaskInput): { task: TaskRecord; replayed: boolean } {
    this.assertMutationAllowed();
    const context = this.resolveContext();
    const authorityReference = validateAuthority(input.authority, context.channel);
    const title = input.title.trim();
    if (!title) throw new ValidationError("Task title is required");
    if (title.length > 500) {
      throw new ValidationError("Task title must be at most 500 characters");
    }
    if (!TASK_KINDS.includes(input.taskKind)) {
      throw new ValidationError(`Unsupported taskKind: ${input.taskKind}`);
    }
    if (!TASK_PRIORITIES.includes(input.priority)) {
      throw new ValidationError(`Unsupported priority: ${input.priority}`);
    }
    const dueAt = normalizeDueAt(input.dueAt ?? null);
    const payload = {
      projectId: input.projectId,
      title,
      taskKind: input.taskKind,
      priority: input.priority,
      dueAt,
      authority: authorityPayload(input.authority, authorityReference),
    };

    this.assertProjectVisible(input.projectId, context.workspaceId);
    return this.runIdempotent(
      context.workspaceId,
      "workspace_create_task",
      input.idempotencyKey,
      payload,
      () => {
        const sourceOwnedTask = this.database
          .prepare(
            `SELECT id FROM tasks
             WHERE project_id = ? AND task_kind = ?
               AND source_transition_id IS NOT NULL
               AND status NOT IN ('DONE', 'CANCELLED')
             ORDER BY created_at, id LIMIT 1`,
          )
          .get(input.projectId, input.taskKind) as { id: string } | undefined;
        if (sourceOwnedTask) {
          throw new ValidationError(
            `An open transition-derived ${input.taskKind} Task already owns this work`,
          );
        }

        const taskId = randomUUID();
        const now = this.clock().toISOString();
        this.database
          .prepare(
            `INSERT INTO tasks(
               id, project_id, title, task_kind, status, priority, due_at,
               record_version, created_by, updated_by, source_transition_id,
               created_at, updated_at, completed_at
             ) VALUES (?, ?, ?, ?, 'TODO', ?, ?, 1, 'USER', 'USER', NULL,
                       ?, ?, NULL)`,
          )
          .run(
            taskId,
            input.projectId,
            title,
            input.taskKind,
            input.priority,
            dueAt,
            now,
            now,
          );

        const result = { task: this.getTask(taskId, context.workspaceId), replayed: false };
        this.writeAudit({
          context,
          taskId,
          operation: "workspace_create_task",
          intentKey: input.idempotencyKey,
          authority: input.authority,
          authorityReference,
          beforeRecordVersion: 0,
          afterRecordVersion: result.task.recordVersion,
          changedFields: ["projectId", "title", "taskKind", "status", "priority", "dueAt"],
        });
        return result;
      },
    );
  }

  completeTaskFromWeb(input: CompleteWebTaskInput): {
    task: TaskRecord;
    changed: boolean;
    replayed: boolean;
  } {
    const context = this.resolveContext();
    if (context.channel !== "WEB") {
      throw new AuthorizationError("Web Task completion requires a verified web request");
    }
    const intentKey = input.intentKey.trim();
    return this.updateTask({
      taskId: input.taskId,
      expectedRecordVersion: input.expectedRecordVersion,
      status: "DONE",
      authority: {
        type: "EXPLICIT_USER_WEB",
        reference: `task-complete:${context.principalId}:${intentKey}`,
      },
      idempotencyKey: intentKey,
    });
  }

  updateTask(input: UpdateTaskInput): {
    task: TaskRecord;
    changed: boolean;
    replayed: boolean;
  } {
    const context = this.resolveContext();
    const authorityReference = validateAuthority(input.authority, context.channel);
    if (input.authority.type === "EXPLICIT_USER_DEV") this.assertMutationAllowed();
    if (
      !Number.isInteger(input.expectedRecordVersion) ||
      input.expectedRecordVersion < 1
    ) {
      throw new ValidationError("expectedRecordVersion must be a positive integer");
    }
    if (input.status !== undefined && !TASK_STATUSES.includes(input.status)) {
      throw new ValidationError(`Unsupported status: ${input.status}`);
    }
    if (input.priority !== undefined && !TASK_PRIORITIES.includes(input.priority)) {
      throw new ValidationError(`Unsupported priority: ${input.priority}`);
    }
    if (
      input.status === undefined &&
      input.priority === undefined &&
      input.dueAt === undefined
    ) {
      throw new ValidationError("At least one Task field is required");
    }
    const patch = {
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(input.dueAt === undefined ? {} : { dueAt: normalizeDueAt(input.dueAt) }),
    };
    const payload = {
      taskId: input.taskId,
      expectedRecordVersion: input.expectedRecordVersion,
      patch,
      authority: authorityPayload(input.authority, authorityReference),
    };

    // Ownership is checked before idempotency lookup so a replay never bypasses
    // current request identity and parent visibility.
    this.getTask(input.taskId, context.workspaceId);
    return this.runIdempotent(
      context.workspaceId,
      "workspace_update_task",
      input.idempotencyKey,
      payload,
      () => {
        const current = this.getTask(input.taskId, context.workspaceId);
        if (current.recordVersion !== input.expectedRecordVersion) {
          throw new ConcurrencyConflictError(
            `Expected Task record version ${input.expectedRecordVersion}, current version is ${current.recordVersion}`,
          );
        }
        if (TERMINAL_TASK_STATUSES.includes(current.status)) {
          throw new ValidationError(
            `${current.status} is terminal; create a new Task to resume work`,
          );
        }

        const nextStatus = patch.status ?? current.status;
        const nextPriority = patch.priority ?? current.priority;
        const nextDueAt = "dueAt" in patch ? patch.dueAt ?? null : current.dueAt;
        const changed =
          nextStatus !== current.status ||
          nextPriority !== current.priority ||
          nextDueAt !== current.dueAt;
        if (!changed) {
          const result = { task: current, changed: false, replayed: false };
          this.writeAudit({
            context,
            taskId: current.id,
            operation: "workspace_update_task",
            intentKey: input.idempotencyKey,
            authority: input.authority,
            authorityReference,
            beforeRecordVersion: current.recordVersion,
            afterRecordVersion: current.recordVersion,
            changedFields: [],
          });
          return result;
        }

        const now = this.clock().toISOString();
        const completedAt = nextStatus === "DONE" ? now : null;
        const update = this.database
          .prepare(
            `UPDATE tasks
             SET status = ?, priority = ?, due_at = ?,
                 record_version = record_version + 1,
                 updated_by = 'USER', updated_at = ?, completed_at = ?
             WHERE id = ? AND record_version = ?
               AND status NOT IN ('DONE', 'CANCELLED')`,
          )
          .run(
            nextStatus,
            nextPriority,
            nextDueAt,
            now,
            completedAt,
            input.taskId,
            input.expectedRecordVersion,
          );
        if (update.changes !== 1) {
          throw new ConcurrencyConflictError(
            "Concurrent Task update prevented this change",
          );
        }

        const result = {
          task: this.getTask(input.taskId, context.workspaceId),
          changed: true,
          replayed: false,
        };
        this.writeAudit({
          context,
          taskId: input.taskId,
          operation: "workspace_update_task",
          intentKey: input.idempotencyKey,
          authority: input.authority,
          authorityReference,
          beforeRecordVersion: current.recordVersion,
          afterRecordVersion: result.task.recordVersion,
          changedFields: [
            ...(nextStatus !== current.status ? ["status"] : []),
            ...(nextPriority !== current.priority ? ["priority"] : []),
            ...(nextDueAt !== current.dueAt ? ["dueAt"] : []),
          ],
        });
        return result;
      },
    );
  }

  private writeAudit(input: {
    context: TaskCommandContext;
    taskId: string;
    operation: "workspace_create_task" | "workspace_update_task";
    intentKey: string;
    authority: TaskMutationAuthority;
    authorityReference: string;
    beforeRecordVersion: number;
    afterRecordVersion: number;
    changedFields: string[];
  }): void {
    this.database.prepare(
      `INSERT INTO task_command_audit(
         id, workspace_id, principal_id, task_id, operation, channel,
         intent_key, authority_type, authority_reference,
         before_record_version, after_record_version, changed_fields_json,
         outcome, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?)`,
    ).run(
      randomUUID(), input.context.workspaceId, input.context.principalId,
      input.taskId, input.operation, input.context.channel,
      input.intentKey.trim(), input.authority.type, input.authorityReference,
      input.beforeRecordVersion, input.afterRecordVersion,
      canonicalJson(input.changedFields), this.clock().toISOString(),
    );
  }

  private getTask(taskId: string, workspaceId: string): TaskRecord {
    const row = this.database
      .prepare(
        `SELECT t.id, t.project_id, t.title, t.task_kind, t.status,
                t.priority, t.due_at, t.record_version, t.created_by,
                t.updated_by, t.source_transition_id, t.created_at,
                t.updated_at, t.completed_at
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         WHERE t.id = ? AND p.workspace_id = ?`,
      )
      .get(taskId, workspaceId) as TaskRow | undefined;
    if (!row) throw new NotFoundError(`Task ${taskId} was not found`);
    return mapTask(row);
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

function validateAuthority(authority: TaskMutationAuthority, channel: "WEB" | "MCP"): string {
  const reference = authority.reference.trim();
  const validDevelopment = authority.type === "EXPLICIT_USER_DEV" &&
    authority.confirmed && channel === "MCP";
  const validWeb = authority.type === "EXPLICIT_USER_WEB" && channel === "WEB";
  if ((!validDevelopment && !validWeb) || !reference) {
    throw new AuthorizationError("Task mutation requires explicit user authority");
  }
  return reference;
}

function authorityPayload(authority: TaskMutationAuthority, reference: string) {
  return authority.type === "EXPLICIT_USER_DEV"
    ? { type: authority.type, confirmed: authority.confirmed, reference }
    : { type: authority.type, reference };
}

function normalizeDueAt(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(trimmed)) {
    throw new ValidationError("dueAt must be an ISO 8601 timestamp with an offset");
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError("dueAt must be a valid timestamp");
  }
  return parsed.toISOString();
}

export function mapTask(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    taskKind: row.task_kind,
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at,
    recordVersion: row.record_version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    sourceTransitionId: row.source_transition_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}
