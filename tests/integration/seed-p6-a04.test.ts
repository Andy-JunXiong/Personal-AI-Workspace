import { afterEach, describe, expect, it } from "vitest";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";
import { runSeedP6A04 } from "../../scripts/seed-p6-a04.js";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

const authority = {
  type: "EXPLICIT_USER_DEV" as const,
  confirmed: true as const,
  reference: "synthetic",
};

const seedEnvironment = {
  PAW_DEV_PRINCIPAL_ISSUER: "test-suite",
  PAW_DEV_PRINCIPAL_SUBJECT: "test-user",
  PAW_DEV_WORKSPACE_NAME: "Test Workspace",
};

function setup() {
  const workspace = createEmptyTestWorkspace({ fileBacked: true });
  cleanups.push(workspace.cleanup);
  return workspace;
}

describe("P6 A04 bounded synthetic seed", () => {
  it("creates only the prefixed applications through the authority/idempotency path and preserves real rows", () => {
    const w = setup();
    const real = w.service.createJobApplication({
      company: "Real Company",
      role: "Real Role",
      authority,
      idempotencyKey: "real-application",
    });
    if (real.creationStatus !== "CREATED") throw new Error("Expected a real application");

    const result = runSeedP6A04(
      ["--db", w.databasePath, "--authority-reference", "P6 A04 acceptance", "--count", "5"],
      seedEnvironment,
    );

    expect(result).toMatchObject({
      requestedCount: 5,
      createdCount: 5,
      replayedCount: 0,
      workspaceId: w.identity.workspaceId,
    });
    expect(result.projectIds).toHaveLength(5);

    const rows = w.database
      .prepare("SELECT metadata_json FROM projects WHERE project_type = 'job_application' ORDER BY created_at")
      .all() as Array<{ metadata_json: string }>;
    expect(rows).toHaveLength(6); // 1 real + 5 seed
    const seeded = rows.filter((row) =>
      (JSON.parse(row.metadata_json) as { company: string }).company.startsWith(
        "SYNTHETIC TEST - P6-A04 Company",
      ),
    );
    expect(seeded).toHaveLength(5);
    expect(
      w.database.prepare("SELECT COUNT(*) AS n FROM resources").get(),
    ).toEqual({ n: 0 });
    expect(
      w.database.prepare("SELECT COUNT(*) AS n FROM job_candidates").get(),
    ).toEqual({ n: 0 });
    expect(
      w.database.prepare("SELECT COUNT(*) AS n FROM state_transitions").get(),
    ).toEqual({ n: 6 }); // 1 real + 5 seed initial APPLIED admissions
    const realAfter = w.service.getProject(real.project.id).project;
    expect(realAfter.title).toBe("Real Company — Real Role");
    expect(realAfter.lifecycleState).toBe("APPLIED");
  });

  it("replays the same seed idempotently with zero new rows", () => {
    const w = setup();
    const first = runSeedP6A04(
      ["--db", w.databasePath, "--authority-reference", "P6 A04 acceptance", "--count", "5"],
      seedEnvironment,
    );
    const second = runSeedP6A04(
      ["--db", w.databasePath, "--authority-reference", "P6 A04 acceptance", "--count", "5"],
      seedEnvironment,
    );

    expect(first.projectIds).toEqual(second.projectIds);
    expect(second).toMatchObject({ createdCount: 0, replayedCount: 5 });
    expect(
      w.database.prepare("SELECT COUNT(*) AS n FROM projects").get(),
    ).toEqual({ n: 5 });
    expect(
      w.database.prepare("SELECT COUNT(*) AS n FROM idempotency_records").get(),
    ).toEqual({ n: 5 });
  });

  it("rejects an unbounded count, a missing authority reference, and a missing database", () => {
    const w = setup();
    const run = (args: string[]) => runSeedP6A04(args, seedEnvironment);
    expect(() => run(["--db", w.databasePath, "--authority-reference", "x", "--count", "0"]))
      .toThrow(/between 1 and 200/u);
    expect(() => run(["--db", w.databasePath, "--authority-reference", "x", "--count", "201"]))
      .toThrow(/between 1 and 200/u);
    expect(() => run(["--db", w.databasePath, "--count", "5"]))
      .toThrow(/authority-reference/u);
    expect(() => run(["--db", w.databasePath, "--authority-reference", " ", "--count", "5"]))
      .toThrow(/authority-reference/u);
    expect(() => run(["--db", `${w.directory}/missing.db`, "--authority-reference", "x"]))
      .toThrow();
    expect(() => run(["--authority-reference", "x"]))
      .toThrow(/--db/u);
    for (const count of ["1.5", "5jobs", "1e2", "0x10", " 5", "-1", "NaN"]) {
      expect(() => run(["--db", w.databasePath, "--authority-reference", "x", "--count", count]))
        .toThrow(/between 1 and 200/u);
    }
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM projects").get()).toEqual({ n: 0 });
  });

  it("creates the default dataset beyond 100 and replays without additional writes", () => {
    const w = setup();
    const args = ["--db", w.databasePath, "--authority-reference", "P6 A04 acceptance"];
    const first = runSeedP6A04(args, seedEnvironment);
    expect(first).toMatchObject({ requestedCount: 106, createdCount: 106, replayedCount: 0 });
    expect(new Set(first.projectIds).size).toBe(106);
    const before = w.database.serialize();
    const second = runSeedP6A04(args, seedEnvironment);
    expect(second).toMatchObject({ createdCount: 0, replayedCount: 106, projectIds: first.projectIds });
    expect(w.database.serialize()).toEqual(before);
  }, 15_000);

  it("rejects an unmapped principal without initializing identity or writing records", () => {
    const w = setup();
    const before = w.database.serialize();
    expect(() => runSeedP6A04(
      ["--db", w.databasePath, "--authority-reference", "P6 A04 acceptance"],
      { ...seedEnvironment, PAW_DEV_PRINCIPAL_SUBJECT: "unmapped-user" },
    )).toThrow();
    expect(w.database.serialize()).toEqual(before);
  });
});
