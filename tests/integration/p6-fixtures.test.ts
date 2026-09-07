import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { it, expect } from "vitest";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";
import { createWorkspaceHttpApp } from "../../src/mcp/http-app.js";

it("creates scenario-isolated P6 fixtures through MCP and replays without changing the database", async () => {
  const w = createEmptyTestWorkspace({ fileBacked: true });
  const server = createWorkspaceHttpApp(w.service).listen(0, "127.0.0.1");
  await new Promise<void>(done => server.once("listening", done));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing port");
    const env = { ...process.env, PAW_P6_AUTHORITY: "approved-steps-1-4-20260907",
      PAW_P6_ENDPOINT: `http://127.0.0.1:${address.port}/mcp`, PAW_P6_WORKSPACE_ID: w.identity.workspaceId };
    const baselinePath = resolve(w.directory, "before-fixtures.db");
    writeFileSync(baselinePath, w.database.serialize());
    const run = () => promisify(execFile)(process.execPath, [resolve("deploy/cloud/p6-fixtures.mjs")], { env, maxBuffer: 1024 * 1024 });
    const first = JSON.parse((await run()).stdout);
    expect(Object.keys(first.applications)).toHaveLength(10);
    expect(Object.keys(first.tasks)).toHaveLength(6);
    expect(Object.keys(first.candidates)).toHaveLength(5);
    expect(Object.keys(first.runs)).toHaveLength(3);
    expect(first.observations).toHaveLength(12);
    expect(first.tasks["A10"].status).toBe("TODO");
    expect(first.tasks["A05-Blocked"].status).toBe("BLOCKED");
    expect(w.service.getProject(first.applications.A02.id).project.lifecycleState).toBe("APPLIED");
    const before = w.database.serialize();
    const second = JSON.parse((await run()).stdout);
    expect(second.applications).toEqual(first.applications);
    expect(second.tasks).toEqual(first.tasks);
    expect(w.database.serialize()).toEqual(before);
    const receiptPath = resolve(w.directory, "fixtures.json");
    writeFileSync(receiptPath, JSON.stringify(first));
    const runAcceptance = () => promisify(execFile)(process.execPath,
      [resolve("deploy/cloud/p6-server-acceptance.mjs")], { env: { ...env,
        PAW_P6_DB_PATH: w.databasePath, PAW_P6_BASELINE_PATH: baselinePath,
        PAW_P6_FIXTURES_PATH: receiptPath }, maxBuffer: 1024 * 1024 });
    const acceptance = (await runAcceptance()).stdout.trim().split("\n").map(line => JSON.parse(line));
    for (const scenario of ["A07", "A08", "A11", "data-preservation"]) {
      expect(acceptance.find(row => row.scenario === scenario)?.result).toBe("PASS");
    }
    const beforeAcceptanceReplay = w.database.serialize();
    await runAcceptance();
    expect(w.database.serialize()).toEqual(beforeAcceptanceReplay);
  } finally {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    w.cleanup();
  }
}, 20_000);
