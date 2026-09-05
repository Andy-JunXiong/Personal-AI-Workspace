import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { JobSearchQueryService } from "../../src/application/job-search-query-service.js";
import { verifiedRequestContext } from "../../src/application/request-context.js";
import { openDatabase } from "../../src/persistence/database.js";
import { createTestWorkspace, testPrincipal } from "../helpers/test-workspace.js";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });
const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic query verification" };
function setup(fileBacked = false) {
  const w = createTestWorkspace({ fileBacked }); cleanups.push(w.cleanup);
  return { ...w, query: w.service.jobSearchQueryService };
}
function application(w: ReturnType<typeof setup>, name: string) {
  const result = w.service.createJobApplication({ company: name, role: "Engineer", authority, idempotencyKey: randomUUID() });
  if (result.creationStatus !== "CREATED") throw new Error("Expected synthetic creation");
  return result.project.id;
}
function task(w: ReturnType<typeof setup>, projectId = w.projectId, dueAt: string | null = null) {
  return w.service.taskService.createTask({ projectId, title: "Synthetic work", taskKind: "OTHER",
    priority: "LOW", dueAt, authority, idempotencyKey: randomUUID() }).task;
}
function addHistory(w: ReturnType<typeof setup>, count: number) {
  w.database.transaction(() => {
    for (let i = 0; i < count; i++) {
      const resourceId = randomUUID();
      const transitionId = randomUUID();
      const at = new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString();
      w.database.prepare(`INSERT INTO resources(id, project_id, resource_type, provider,
        external_id, title, observed_facts_json, evidence_snapshot_json, observed_at, canonical_hash, created_at)
        VALUES (?, ?, 'NOTE', 'synthetic', ?, 'Synthetic note', '{}', 'DO_NOT_EXPOSE_SNAPSHOT', ?, ?, ?)`
      ).run(resourceId, w.projectId, resourceId, at, resourceId, at);
      w.database.prepare(`INSERT INTO state_transitions(id, project_id, from_state, to_state,
        from_version, trigger_type, status, proposed_by, canonical_hash, proposed_at)
        VALUES (?, ?, 'APPLIED', 'INTERVIEWING', 1, 'USER_ASSERTION', 'PROPOSED', 'USER', ?, ?)`
      ).run(transitionId, w.projectId, transitionId, at);
      w.database.prepare("INSERT INTO transition_evidence VALUES (?, ?)").run(transitionId, resourceId);
    }
  })();
}

describe("Bounded application queries", () => {
  it("reads past the frozen 100-row cap without duplicates and preserves deterministic tie ordering", () => {
    const w = setup();
    for (let i = 0; i < 106; i++) application(w, `Synthetic ${i.toString().padStart(3, "0")}`);
    w.database.prepare("UPDATE projects SET updated_at = '2026-09-01T00:00:00.000Z'").run();
    const legacy = w.service.listJobApplications();
    expect(legacy).toMatchObject({ totalCount: 107, truncated: true });
    expect(legacy.applications).toHaveLength(100);
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = w.query.listApplications({ cursor });
      expect(page.items.length).toBeLessThanOrEqual(25);
      expect(page.totalCount).toBe(107);
      ids.push(...page.items.map((item) => item.projectId));
      expect(page.coverage.loaded).toBe(ids.length);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(new Set(ids).size).toBe(107);
    expect(ids).toEqual([...ids].sort());
    expect(w.query.listApplications({ pageSize: 100 }).items).toHaveLength(100);
  });

  it("filters lifecycle/open/closed and literal normalized search, with truthful due summaries", () => {
    const w = setup();
    const first = application(w, "ＡＣＭＥ  Labs");
    const second = application(w, "Beta %_ team");
    const late = task(w, first, "2026-09-07T09:00:00+10:00");
    const early = task(w, first, "2026-09-06T09:00:00+10:00");
    task(w, first); task(w, second);
    const result = w.query.listApplications({ q: "acme labs" });
    expect(result.totalCount).toBe(1);
    expect(result.items[0]).toMatchObject({ projectId: first, openTaskCount: 3,
      nextDueTask: { id: early.id, dueAt: "2026-09-05T23:00:00.000Z" } });
    expect(w.query.listApplications({ q: "%_" }).items.map((item) => item.projectId)).toEqual([second]);
    expect(w.query.listApplications({ q: "'; DROP TABLE projects;--" }).totalCount).toBe(0);
    expect(w.query.listApplications({ sort: "NEXT_DUE_ASC" }).items[0]?.projectId).toBe(first);
    expect(w.query.listApplications({ q: "Beta" }).items[0]?.nextDueTask).toBeNull();
    w.service.taskService.updateTask({ taskId: early.id, expectedRecordVersion: 1, status: "DONE", authority, idempotencyKey: randomUUID() });
    expect(w.query.listApplications({ q: "acme" }).items[0]).toMatchObject({ openTaskCount: 2, nextDueTask: { id: late.id } });
    const proposal = w.service.proposeTransition({ projectId: second, expectedLifecycleVersion: 1,
      toState: "REJECTED", triggerType: "USER_ASSERTION", evidenceResourceIds: [], rationale: "Synthetic closure", idempotencyKey: randomUUID() });
    w.service.admitTransition({ transitionId: proposal.transition.id, expectedLifecycleVersion: 1, authority, idempotencyKey: randomUUID() });
    expect(w.query.listApplications({ status: "CLOSED", lifecycle: "REJECTED" }).items.map((item) => item.projectId)).toEqual([second]);
    expect(w.query.listApplications({ lifecycle: "REJECTED" }).totalCount).toBe(0);
    expect(w.query.listApplications({ status: "ALL" }).totalCount).toBe(3);
  });

  it("binds signed cursors to query/owner/page size but allows new request contexts", () => {
    const w = setup(); application(w, "Second");
    const page = w.query.listApplications({ pageSize: 1 });
    const cursor = page.nextCursor!;
    const fresh = new WorkspaceService(w.database, verifiedRequestContext(w.database, w.identity, "WEB", randomUUID()));
    expect(fresh.jobSearchQueryService.listApplications({ pageSize: 1, cursor }).items).toHaveLength(1);
    for (const change of [{ pageSize: 2 }, { q: "Second" }, { status: "ALL" }, { sort: "COMPANY_ASC" }]) {
      expect(() => w.query.listApplications({ pageSize: 1, cursor, ...change })).toThrow(/reload/u);
    }
    const other = new WorkspaceService(w.database, { issuer: "other", subject: "other", workspaceName: "Other" });
    other.ensureDevelopmentIdentity();
    expect(() => other.jobSearchQueryService.listApplications({ pageSize: 1, cursor })).toThrow(/reload/u);
    const altered = `${cursor.slice(0, -4)}AAAA`;
    expect(() => w.query.listApplications({ pageSize: 1, cursor: altered })).toThrow(/reload/u);
    const expired = new JobSearchQueryService(w.database, () => w.identity, () => new Date(Date.now() + 901_000));
    expect(() => expired.listApplications({ pageSize: 1, cursor })).toThrow(/reload/u);
    // Invalid cursors must not strand a SQLite reader or prevent a subsequent write.
    expect(() => application(w, "After invalid cursors")).not.toThrow();
  });

  it("invalidates cursors after membership, ordering or task-summary changes", () => {
    const w = setup(); application(w, "Second");
    const membership = w.query.listApplications({ pageSize: 1 }).nextCursor!;
    const third = application(w, "Third");
    expect(() => w.query.listApplications({ pageSize: 1, cursor: membership })).toThrow(/reload/u);
    const metadata = w.query.listApplications({ pageSize: 1 }).nextCursor!;
    w.service.updateJobApplication({ projectId: third, expectedRecordVersion: 1, company: "Changed", idempotencyKey: randomUUID() });
    expect(() => w.query.listApplications({ pageSize: 1, cursor: metadata })).toThrow(/reload/u);
    const summary = w.query.listApplications({ pageSize: 1 }).nextCursor!;
    task(w);
    expect(() => w.query.listApplications({ pageSize: 1, cursor: summary })).toThrow(/reload/u);
  });

  it("rejects invalid/unknown query arguments at the application boundary", () => {
    const w = setup();
    for (const input of [{ pageSize: 0 }, { pageSize: 101 }, { pageSize: 1.5 }, { q: ["x"] },
      { status: "anything" }, { workspaceId: w.identity.workspaceId }, { sort: "DROP TABLE" }]) {
      expect(() => w.query.listApplications(input)).toThrow(/Invalid Job Search query/u);
    }
    expect(w.query.listApplications({ q: "no match" }).coverage).toEqual({ offset: 0, returned: 0, loaded: 0, hasMore: false, complete: true });
  });
});

describe("Terminal tasks and complete bounded history", () => {
  it("reads exact terminal tasks on closed parents after reopening, with zero writes", () => {
    const w = setup(true);
    const completed = task(w);
    w.service.taskService.updateTask({ taskId: completed.id, expectedRecordVersion: 1, status: "DONE", authority, idempotencyKey: randomUUID() });
    const cancelled = task(w);
    const proposal = w.service.proposeTransition({ projectId: w.projectId, expectedLifecycleVersion: 1,
      toState: "WITHDRAWN", triggerType: "USER_ASSERTION", evidenceResourceIds: [], rationale: "Synthetic closure", idempotencyKey: randomUUID() });
    w.service.admitTransition({ transitionId: proposal.transition.id, expectedLifecycleVersion: 1, authority, idempotencyKey: randomUUID() });
    const expected = w.query.getTask(completed.id);
    expect(expected).toMatchObject({ id: completed.id, status: "DONE", recordVersion: 2, completedAt: expect.any(String) });
    w.database.close();
    const db = openDatabase(w.databasePath); cleanups.push(() => db.close());
    const service = new WorkspaceService(db, testPrincipal);
    const before = db.prepare("SELECT total_changes() AS n").get();
    expect(service.jobSearchQueryService.getTask(completed.id)).toEqual(expected);
    expect(service.jobSearchQueryService.getTask(cancelled.id).status).toBe("CANCELLED");
    expect(service.jobSearchQueryService.getApplication(w.projectId)).toMatchObject({ project: { status: "CLOSED" },
      totalCounts: { openTasks: 0, completedTasks: 1, cancelledTasks: 1 } });
    expect(db.prepare("SELECT total_changes() AS n").get()).toEqual(before);
  });

  it("paginates tasks and invalidates after status changes without conflating terminal absence", () => {
    const w = setup(); const tasks = Array.from({ length: 27 }, () => task(w));
    const first = w.query.listTasks(w.projectId);
    expect(first.totalCount).toBe(27); expect(first.items).toHaveLength(25);
    expect(w.query.listTasks(w.projectId, { cursor: first.nextCursor }).items).toHaveLength(2);
    w.service.taskService.updateTask({ taskId: tasks[0]!.id, expectedRecordVersion: 1, status: "DONE", authority, idempotencyKey: randomUUID() });
    expect(() => w.query.listTasks(w.projectId, { cursor: first.nextCursor })).toThrow(/reload/u);
    expect(w.query.listTasks(w.projectId, { status: "DONE" }).items.map((item) => item.id)).toEqual([tasks[0]!.id]);
    expect(w.query.listTasks(w.projectId, { status: "ALL" }).totalCount).toBe(27);
  });

  it("reads beyond ten history/resources, defaults to admitted events and omits private snapshots", () => {
    const w = setup(); addHistory(w, 31);
    expect(w.service.getProject(w.projectId).transitions).toHaveLength(10);
    expect(w.query.listHistory(w.projectId).items.every((item) => item.status === "ADMITTED")).toBe(true);
    expect(w.query.listHistory(w.projectId).totalCount).toBe(1);
    const first = w.query.listHistory(w.projectId, { status: "PROPOSED" });
    const second = w.query.listHistory(w.projectId, { status: "PROPOSED", cursor: first.nextCursor });
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(31);
    expect(first.items[0]?.evidenceResourceIds).toHaveLength(1);
    const resources = w.query.listResources(w.projectId);
    expect(resources.totalCount).toBe(31);
    expect(w.query.listResources(w.projectId, { cursor: resources.nextCursor }).items).toHaveLength(6);
    expect(JSON.stringify(resources)).not.toContain("DO_NOT_EXPOSE_SNAPSHOT");
    expect(() => w.query.listResources(w.projectId, { cursor: first.nextCursor })).toThrow(/reload/u);
    addHistory(w, 1);
    expect(() => w.query.listResources(w.projectId, { cursor: resources.nextCursor })).toThrow(/reload/u);
  });

  it("denies missing/other-owner/non-job objects consistently at every new read", () => {
    const w = setup(); const t = task(w);
    const other = new WorkspaceService(w.database, { issuer: "other", subject: "other", workspaceName: "Other" });
    other.ensureDevelopmentIdentity();
    const message = (read: () => unknown) => { try { read(); return "unexpected success"; } catch (error) { return (error as Error).message; } };
    expect(message(() => other.jobSearchQueryService.getTask(t.id))).toBe(message(() => w.query.getTask(randomUUID())));
    for (const method of ["getApplication", "listTasks", "listHistory", "listResources"] as const) {
      expect(message(() => other.jobSearchQueryService[method](w.projectId))).toBe(message(() => w.query[method](randomUUID())));
    }
    w.database.prepare("UPDATE projects SET project_type = 'synthetic_other_domain' WHERE id = ?").run(w.projectId);
    expect(() => w.query.getTask(t.id)).toThrow(/not found/u);
    expect(() => w.query.getApplication(w.projectId)).toThrow(/not found/u);
    expect(w.query.listApplications().totalCount).toBe(0);
  });
});
