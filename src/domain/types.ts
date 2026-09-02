export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type LifecycleState =
  | "APPLIED"
  | "RECRUITER_CONTACT"
  | "INTERVIEWING";

export type TransitionStatus = "PROPOSED" | "ADMITTED" | "REJECTED";

export type TriggerType =
  | "USER_ASSERTION"
  | "EXTERNAL_EVIDENCE"
  | "ACTION_OUTCOME"
  | "IMPORT";

export interface IdentityContext {
  principalId: string;
  workspaceId: string;
}

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  projectType: string;
  title: string;
  status: "ACTIVE" | "PAUSED" | "CLOSED";
  lifecycleState: LifecycleState;
  lifecycleVersion: number;
  recordVersion: number;
  metadata: Record<string, JsonValue>;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceRecord {
  id: string;
  projectId: string;
  resourceType: string;
  provider: string;
  externalId: string | null;
  externalUri: string | null;
  title: string | null;
  observedFacts: Record<string, JsonValue>;
  observedAt: string;
  createdAt: string;
}

export interface TransitionRecord {
  id: string;
  projectId: string;
  fromState: string;
  toState: string;
  fromVersion: number;
  toVersion: number | null;
  triggerType: TriggerType;
  status: TransitionStatus;
  proposedBy: "USER" | "CHATGPT" | "SYSTEM";
  proposalRationale: string | null;
  evidenceResourceIds: string[];
  admittedBy: "USER" | "RULE" | "SYSTEM" | null;
  admissionAuthorityType:
    | "EXPLICIT_USER_DEV"
    | "DETERMINISTIC_RULE"
    | null;
  admissionAuthorityReference: string | null;
  proposedAt: string;
  admittedAt: string | null;
  rejectionReason: string | null;
}

export interface TaskRecord {
  id: string;
  projectId: string;
  title: string;
  taskKind: TaskKind;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  recordVersion: number;
  createdBy: "USER" | "CHATGPT" | "SYSTEM";
  updatedBy: "USER" | "CHATGPT" | "SYSTEM";
  sourceTransitionId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type TaskKind =
  | "FOLLOW_UP"
  | "PREPARE_FOR_INTERVIEW"
  | "RESPOND_TO_RECRUITER"
  | "OTHER";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "DONE"
  | "CANCELLED";

export interface ExplicitUserDevAuthority {
  type: "EXPLICIT_USER_DEV";
  confirmed: true;
  reference: string;
}
