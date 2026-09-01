import type { LifecycleState } from "./types.js";

const allowedTransitions: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = {
  APPLIED: ["RECRUITER_CONTACT"],
  RECRUITER_CONTACT: ["INTERVIEWING"],
  INTERVIEWING: [],
};

export interface DerivedTaskDefinition {
  taskKind: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
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

export function derivedTaskForTransition(
  fromState: LifecycleState,
  toState: LifecycleState,
): DerivedTaskDefinition | null {
  if (fromState === "APPLIED" && toState === "RECRUITER_CONTACT") {
    return {
      taskKind: "RESPOND_TO_RECRUITER",
      title: "Respond to recruiter",
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
