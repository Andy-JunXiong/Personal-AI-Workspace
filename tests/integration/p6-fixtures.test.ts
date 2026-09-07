import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
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
  } finally {
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    w.cleanup();
  }
});
