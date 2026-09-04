import type { LifecycleState, TaskKind, TaskPriority } from "./types.js";

const allowedTransitions: Readonly<
  Record<LifecycleState, readonly LifecycleState[]>
> = {
  APPLIED: ["RECRUITER_CONTACT", "INTERVIEWING", "REJECTED", "WITHDRAWN"],
  RECRUITER_CONTACT: ["INTERVIEWING", "REJECTED", "WITHDRAWN"],
  INTERVIEWING: ["OFFER", "REJECTED", "WITHDRAWN"],
  OFFER: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const terminalStates: readonly LifecycleState[] = [
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

export interface DerivedTaskDefinition {
  taskKind: TaskKind;
  title: string;
  priority: TaskPriority;
}

export function isLifecycleState(value: string): value is LifecycleState {
  return value in allowedTransitions;
}

export function isAllowedTransition(
  fromState: LifecycleState,
  toState: LifecycleState,
): boolean {
  return allowedTransitions[fromState].includes(toState);
}

export function isTerminalLifecycleState(state: LifecycleState): boolean {
  return terminalStates.includes(state);
}

export function derivedTaskForTransition(
  fromState: LifecycleState,
  toState: LifecycleState,
): DerivedTaskDefinition | null {
  if (toState === "RECRUITER_CONTACT") {
    return {
      taskKind: "RESPOND_TO_RECRUITER",
      title: "Respond to recruiter",
      priority: "HIGH",
    };
  }

  if (toState === "INTERVIEWING") {
    return {
      taskKind: "PREPARE_FOR_INTERVIEW",
      title: "Prepare for interview",
      priority: "HIGH",
    };
  }

  if (toState === "OFFER") {
    return {
      taskKind: "REVIEW_OFFER",
      title: "Review offer",
      priority: "HIGH",
    };
  }

  return null;
}

// The only deterministic rule initializes the seeded fixture. No runtime
// lifecycle edge has deterministic admission authority in Spike 1A.
export const deterministicAdmissionRules: readonly string[] = [
  "SPIKE_FIXTURE_IMPORT",
];
