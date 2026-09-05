import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";
import { openDatabase } from "../../src/persistence/database.js";

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

function launch(environment: NodeJS.ProcessEnv): {
  child: ChildProcess;
  started: Promise<{ port: number; workspaceId: string }>;
  exited: Promise<number | null>;
} {
  const child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    cwd: process.cwd(), windowsHide: true, env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Drain stderr without putting startup errors/paths into checked-in evidence.
  child.stderr?.resume();
  const exited = new Promise<number | null>((done) => child.once("exit", done));
  cleanups.push(async () => { if (child.exitCode === null) { child.kill(); await exited; } });
  const started = new Promise<{ port: number; workspaceId: string }>((done, reject) => {
    let buffer = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("Synthetic startup timed out")); }, 10_000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("exit", () => { clearTimeout(timer); reject(new Error("Server exited before listening")); });
    child.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const event = JSON.parse(line) as { event: string; port: number; workspaceId: string };
          if (event.event === "server_started") { clearTimeout(timer); done(event); }
        } catch { /* Other process output is not server readiness. */ }
      }
    });
  });
  return { child, started, exited };
}

it("keeps the existing MCP runtime healthy when enabled web configuration fails closed", async () => {
  const w = createEmptyTestWorkspace({ fileBacked: true }); cleanups.push(w.cleanup);
  const server = launch({ PAW_DB_PATH: w.databasePath, PORT: "0", PAW_WEB_ENABLED: "true",
    PAW_WEB_ORIGIN: "not-an-origin", PAW_DEV_PRINCIPAL_ISSUER: "test-suite",
    PAW_DEV_PRINCIPAL_SUBJECT: "test-user" });
  const started = await server.started;
  expect(started.workspaceId).toBe(w.identity.workspaceId);
  const health = await fetch(`http://127.0.0.1:${started.port}/healthz`);
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ status: "ok", database: "available" });
  expect(w.database.prepare("SELECT COUNT(*) AS n FROM workspaces").get()).toEqual({ n: 1 });
});

it("refuses to create a substitute Workspace when web is enabled on an empty synthetic database", async () => {
  const w = createEmptyTestWorkspace({ fileBacked: true }); cleanups.push(w.cleanup);
  const emptyPath = join(w.directory, "empty-web.db");
  const secret = join(w.directory, "synthetic-secret"); writeFileSync(secret, "synthetic-client-secret");
  const server = launch({ PAW_DB_PATH: emptyPath, PORT: "0", PAW_WEB_ENABLED: "true",
    PAW_WEB_WRITES_ENABLED: "false", PAW_WEB_ORIGIN: "https://workspace.example.test",
    PAW_GOOGLE_CLIENT_ID: "synthetic-client", PAW_GOOGLE_CLIENT_SECRET_FILE: secret,
    PAW_DEV_PRINCIPAL_ISSUER: "test-suite", PAW_DEV_PRINCIPAL_SUBJECT: "test-user" });
  await expect(server.started).rejects.toThrow(/before listening/u);
  expect(await server.exited).not.toBe(0);
  const empty = openDatabase(emptyPath);
  try {
    expect(empty.prepare("SELECT COUNT(*) AS n FROM principals").get()).toEqual({ n: 0 });
    expect(empty.prepare("SELECT COUNT(*) AS n FROM workspaces").get()).toEqual({ n: 0 });
  } finally { empty.close(); }
});
