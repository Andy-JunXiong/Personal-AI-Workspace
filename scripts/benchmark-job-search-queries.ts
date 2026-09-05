import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { openDatabase } from "../src/persistence/database.js";
import { WorkspaceService } from "../src/application/workspace-service.js";

// Self-contained synthetic benchmark. It accepts no existing database path and
// cannot open the real Workspace. Measures reads, not cloud/web load capacity.
const root = resolve(tmpdir());
const directory = mkdtempSync(join(root, "paw-query-benchmark-"));
const database = openDatabase(join(directory, "synthetic.db"));
try {
  const service = new WorkspaceService(database, {
    issuer: "synthetic-benchmark", subject: "synthetic-user", workspaceName: "Synthetic benchmark",
  });
  const identity = service.ensureDevelopmentIdentity();
  const projectIds: string[] = [];
  const timestamp = "2026-09-05T00:00:00.000Z";
  database.transaction(() => {
    const project = database.prepare(`INSERT INTO projects(id, workspace_id, project_type,
      title, status, lifecycle_state, lifecycle_version, record_version, metadata_json, created_at, updated_at)
      VALUES (?, ?, 'job_application', 'Synthetic job', 'ACTIVE', 'APPLIED', 1, 1, ?, ?, ?)`);
    const task = database.prepare(`INSERT INTO tasks(id, project_id, title, task_kind, status,
      priority, due_at, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, 'Synthetic task', 'OTHER', 'TODO', 'LOW', ?, 'USER', 'USER', ?, ?)`);
    for (let i = 0; i < 1000; i++) {
      const id = randomUUID(); projectIds.push(id);
      project.run(id, identity.workspaceId, JSON.stringify({ company: `Synthetic ${i}`, role: "Engineer" }), timestamp, timestamp);
      for (let j = 0; j < 5; j++) task.run(randomUUID(), id, j === 0 ? null : timestamp, timestamp, timestamp);
    }
  })();
  const query = service.jobSearchQueryService;
  const first = query.listApplications();
  if (first.totalCount !== 1000 || first.items.length !== 25 || !first.nextCursor) throw new Error("Incorrect benchmark fixture");
  function measure(read: () => unknown) {
    read(); // Warm the prepared path/page cache before the bounded sample.
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now(); read(); samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return { medianMs: Number(samples[9]!.toFixed(2)), p95Ms: Number(samples[18]!.toFixed(2)) };
  }
  const before = database.prepare("SELECT total_changes() AS n").get();
  const results = {
    applications: 1000, openTasks: 5000, pageSize: 25, measuredIterations: 20,
    inventory: measure(() => query.listApplications()),
    continuation: measure(() => query.listApplications({ cursor: first.nextCursor })),
    search: measure(() => query.listApplications({ q: "Synthetic 999" })),
    detail: measure(() => query.getApplication(projectIds[0]!)),
    taskPage: measure(() => query.listTasks(projectIds[0]!)),
  };
  if (JSON.stringify(before) !== JSON.stringify(database.prepare("SELECT total_changes() AS n").get())) {
    throw new Error("Benchmark reads unexpectedly mutated the database");
  }
  console.log(JSON.stringify({ ...results, readMutations: 0, scope: "local synthetic SQLite; not VM capacity evidence" }));
} finally {
  database.close();
  const within = relative(root, resolve(directory));
  if (!within.startsWith("paw-query-benchmark-") || within.includes("/") || within.includes("\\")) {
    throw new Error("Refusing benchmark cleanup outside its generated temporary directory");
  }
  rmSync(directory, { recursive: true, force: true });
}
