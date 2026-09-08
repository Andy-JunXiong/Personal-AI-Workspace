import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

interface AcceptanceReport {
  schemaVersion: string;
  isolation: {
    workspacePerScenario: boolean;
    fileDatabasePerScenario: boolean;
    loopbackMcpOnly: boolean;
    externalSourcesAvailable: boolean;
    productionStateUsed: boolean;
  };
  scope: {
    proves: string[];
    doesNotProve: string[];
  };
  summary: {
    result: string;
    scenarios: number;
    passed: number;
    failed: number;
  };
  scenarios: Array<{
    scenario: string;
    result: string;
    trace: Array<{ tool: string; result: string; errorCode?: string }>;
    fingerprint: { equal: boolean };
    evidence: Record<string, unknown>;
  }>;
}

describe("Workspace Skills synthetic acceptance harness", () => {
  it("runs isolated S1/S2 trace and durable-state scenarios", async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve("scripts/run-workspace-skills-synthetic-acceptance.ts"),
      ],
      { maxBuffer: 2 * 1024 * 1024 },
    );
    const report = JSON.parse(stdout) as AcceptanceReport;

    expect(report.schemaVersion).toBe(
      "paw-workspace-skills-synthetic-acceptance-v1",
    );
    expect(report.isolation).toEqual({
      workspacePerScenario: true,
      fileDatabasePerScenario: true,
      loopbackMcpOnly: true,
      externalSourcesAvailable: false,
      productionStateUsed: false,
    });
    expect(report.summary).toEqual({
      result: "PASS",
      scenarios: 8,
      passed: 8,
      failed: 0,
    });
    expect(report.scenarios.map((scenario) => scenario.scenario)).toEqual([
      "S1_NORMAL_READ_ONLY",
      "S2_T1_ACTIVE_READ_ONLY",
      "S2_T2_AMBIGUOUS_STOP",
      "S2_T5_AUTHORIZED_TRANSITION",
      "S2_T6_PROPOSAL_ONLY",
      "S2_T8_OBSERVATION_ONLY",
      "S2_T9_INVALID_TRANSITION",
      "S2_T9_STALE_VERSION",
    ]);
    expect(report.scenarios.every((scenario) => scenario.result === "PASS")).toBe(
      true,
    );
    expect(report.scope.doesNotProve).toContain("model routing");

    const s1 = report.scenarios[0];
    expect(s1?.trace.map((event) => event.tool)).toEqual([
      "workspace_get_today",
    ]);
    expect(s1?.fingerprint.equal).toBe(true);

    const authorized = report.scenarios.find(
      (scenario) => scenario.scenario === "S2_T5_AUTHORIZED_TRANSITION",
    );
    expect(authorized?.trace.map((event) => event.tool)).toEqual([
      "workspace_find_job_application",
      "workspace_get_project",
      "workspace_propose_transition",
      "workspace_get_project",
      "workspace_admit_transition",
      "workspace_get_project",
    ]);
    expect(authorized?.evidence).toMatchObject({
      proposalReadbackUnchanged: true,
      finalLifecycle: "INTERVIEWING",
      finalLifecycleVersion: 2,
      derivedTaskKind: "PREPARE_FOR_INTERVIEW",
    });

    const stale = report.scenarios.find(
      (scenario) => scenario.scenario === "S2_T9_STALE_VERSION",
    );
    expect(stale?.trace.at(-2)).toEqual(
      expect.objectContaining({
        tool: "workspace_admit_transition",
        result: "ERROR",
        errorCode: "CONCURRENCY_CONFLICT",
      }),
    );
    expect(stale?.fingerprint.equal).toBe(true);
  }, 30_000);
});
