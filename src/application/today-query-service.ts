import { ValidationError } from "../domain/errors.js";
import type {
  IdentityContext,
  JsonValue,
  TaskKind,
  TaskPriority,
  TaskStatus,
} from "../domain/types.js";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { Clock } from "./task-service.js";

export type AttentionReason =
  | "OVERDUE"
  | "DUE_TODAY"
  | "HIGH_PRIORITY"
  | "BLOCKED";

export interface TodayTask {
  taskId: string;
  title: string;
  kind: TaskKind;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED";
  priority: TaskPriority;
  dueAt: string | null;
  recordVersion: number;
  projectId: string;
  company: string;
  role: string;
  lifecycleState: string;
}

export interface AttentionTask extends TodayTask {
  reasons: AttentionReason[];
}

export interface UpcomingTask extends Omit<TodayTask, "dueAt" | "status"> {
  status: "TODO" | "IN_PROGRESS";
  dueAt: string;
}

export interface ApplicationWithoutOpenTask {
  projectId: string;
  company: string;
  role: string;
  lifecycleState: string;
}

export interface RecentLifecycleChange {
  transitionId: string;
  projectId: string;
  company: string;
  role: string;
  fromState: string;
  toState: string;
  admittedAt: string;
}

export interface TodayResult {
  date: string;
  timeZone: string;
  attention: AttentionTask[];
  upcoming: UpcomingTask[];
  applicationsWithoutOpenTask: ApplicationWithoutOpenTask[];
  recentLifecycleChanges: RecentLifecycleChange[];
}

interface TaskContextRow {
  task_id: string;
  title: string;
  task_kind: TaskKind;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED";
  priority: TaskPriority;
  due_at: string | null;
  record_version: number;
  project_id: string;
  metadata_json: string;
  lifecycle_state: string;
}

interface ApplicationRow {
  project_id: string;
  metadata_json: string;
  lifecycle_state: string;
}

interface LifecycleChangeRow extends ApplicationRow {
  transition_id: string;
  from_state: string;
  to_state: string;
  admitted_at: string;
}

const REASON_ORDER: Readonly<Record<AttentionReason, number>> = {
  OVERDUE: 0,
  DUE_TODAY: 1,
  HIGH_PRIORITY: 2,
  BLOCKED: 3,
};
const PRIORITY_ORDER: Readonly<Record<TaskPriority, number>> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export class TodayQueryService {
  constructor(
    private readonly database: WorkspaceDatabase,
    private readonly resolveIdentity: () => IdentityContext,
    private readonly timeZone = "Australia/Sydney",
    private readonly clock: Clock = () => new Date(),
  ) {
    try {
      new Intl.DateTimeFormat("en-AU", { timeZone }).format(new Date(0));
    } catch {
      throw new ValidationError(`Invalid Workspace timeZone: ${timeZone}`);
    }
  }

  getToday(): TodayResult {
    const identity = this.resolveIdentity();
    const now = this.clock();
    if (Number.isNaN(now.getTime())) {
      throw new ValidationError("Injected clock returned an invalid date");
    }
    const date = localDate(now, this.timeZone);
    const todayDay = calendarDayNumber(date);
    const rows = this.database
      .prepare(
        `SELECT t.id AS task_id, t.title, t.task_kind, t.status, t.priority,
                t.due_at, t.record_version, p.id AS project_id,
                p.metadata_json, p.lifecycle_state
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         WHERE p.workspace_id = ?
           AND t.status IN ('TODO', 'IN_PROGRESS', 'BLOCKED')`,
      )
      .all(identity.workspaceId) as unknown as TaskContextRow[];

    const attention: AttentionTask[] = [];
    const upcoming: UpcomingTask[] = [];
    for (const row of rows) {
      const task = mapTodayTask(row);
      const dayDelta = task.dueAt
        ? calendarDayNumber(localDate(new Date(task.dueAt), this.timeZone)) -
          todayDay
        : null;
      const reasons: AttentionReason[] = [];
      if (dayDelta !== null && dayDelta < 0) reasons.push("OVERDUE");
      if (dayDelta === 0) reasons.push("DUE_TODAY");
      if (
        dayDelta === null &&
        (task.priority === "HIGH" || task.priority === "CRITICAL")
      ) {
        reasons.push("HIGH_PRIORITY");
      }
      if (task.status === "BLOCKED") reasons.push("BLOCKED");

      if (reasons.length > 0) {
        attention.push({ reasons, ...task });
      } else if (dayDelta !== null && dayDelta >= 1 && dayDelta <= 7) {
        if (task.dueAt === null || task.status === "BLOCKED") {
          throw new ValidationError("Invalid upcoming Task classification");
        }
        upcoming.push({ ...task, dueAt: task.dueAt, status: task.status });
      }
    }

    attention.sort(compareAttentionTasks);
    upcoming.sort(compareUpcomingTasks);

    const applicationsWithoutOpenTask = this.database
      .prepare(
        `SELECT p.id AS project_id, p.metadata_json, p.lifecycle_state
         FROM projects p
         WHERE p.workspace_id = ?
           AND p.project_type = 'job_application'
           AND p.status = 'ACTIVE'
           AND NOT EXISTS (
             SELECT 1 FROM tasks t
             WHERE t.project_id = p.id
               AND t.status IN ('TODO', 'IN_PROGRESS', 'BLOCKED')
           )`,
      )
      .all(identity.workspaceId) as unknown as ApplicationRow[];
    const gapSignals = applicationsWithoutOpenTask.map(mapApplicationContext);
    gapSignals.sort((left, right) =>
      compareText(left.company, right.company) ||
      compareText(left.role, right.role) ||
      left.projectId.localeCompare(right.projectId),
    );

    const recentRows = this.database
      .prepare(
        `SELECT st.id AS transition_id, st.project_id, st.from_state,
                st.to_state, st.admitted_at, p.metadata_json,
                p.lifecycle_state
         FROM state_transitions st
         JOIN projects p ON p.id = st.project_id
         WHERE p.workspace_id = ?
           AND st.status = 'ADMITTED'
           AND st.admitted_at IS NOT NULL
         ORDER BY st.admitted_at DESC, st.id ASC
         LIMIT 5`,
      )
      .all(identity.workspaceId) as unknown as LifecycleChangeRow[];

    return {
      date,
      timeZone: this.timeZone,
      attention,
      upcoming,
      applicationsWithoutOpenTask: gapSignals,
      recentLifecycleChanges: recentRows.map((row) => ({
        transitionId: row.transition_id,
        projectId: row.project_id,
        ...metadataContext(row.metadata_json),
        fromState: row.from_state,
        toState: row.to_state,
        admittedAt: row.admitted_at,
      })),
    };
  }
}

function mapTodayTask(row: TaskContextRow): TodayTask {
  return {
    taskId: row.task_id,
    title: row.title,
    kind: row.task_kind,
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at,
    recordVersion: row.record_version,
    projectId: row.project_id,
    ...metadataContext(row.metadata_json),
    lifecycleState: row.lifecycle_state,
  };
}

function mapApplicationContext(row: ApplicationRow): ApplicationWithoutOpenTask {
  return {
    projectId: row.project_id,
    ...metadataContext(row.metadata_json),
    lifecycleState: row.lifecycle_state,
  };
}

function metadataContext(metadataJson: string): { company: string; role: string } {
  const metadata = JSON.parse(metadataJson) as Record<string, JsonValue>;
  return {
    company: typeof metadata.company === "string" ? metadata.company : "",
    role: typeof metadata.role === "string" ? metadata.role : "",
  };
}

function localDate(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const valueFor = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value;
  const year = valueFor("year");
  const month = valueFor("month");
  const day = valueFor("day");
  if (!year || !month || !day) {
    throw new ValidationError("Could not derive the Workspace local date");
  }
  return `${year}-${month}-${day}`;
}

function calendarDayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new ValidationError(`Invalid local date: ${date}`);
  }
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function compareAttentionTasks(left: AttentionTask, right: AttentionTask): number {
  const leftReason = left.reasons[0];
  const rightReason = right.reasons[0];
  if (leftReason === undefined || rightReason === undefined) return 0;
  return (
    REASON_ORDER[leftReason] - REASON_ORDER[rightReason] ||
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
    compareNullableDueAt(left.dueAt, right.dueAt) ||
    compareText(left.title, right.title) ||
    left.taskId.localeCompare(right.taskId)
  );
}

function compareUpcomingTasks(left: UpcomingTask, right: UpcomingTask): number {
  return (
    compareNullableDueAt(left.dueAt, right.dueAt) ||
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
    compareText(left.title, right.title) ||
    left.taskId.localeCompare(right.taskId)
  );
}

function compareNullableDueAt(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}
