import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { IdentityLinks } from "../../src/auth/identity-links.js";
import { SessionStore } from "../../src/auth/session-store.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { verifiedRequestContext } from "../../src/application/request-context.js";
import { createTestWorkspace } from "../helpers/test-workspace.js";
import { runIdentityAdmin } from "../../scripts/web-identity-admin.js";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });
const identity = { issuer: "https://identity.example.test", subject: "verified-user", email: "user@example.test" };

function setup(fileBacked = false) {
  const workspace = createTestWorkspace({ fileBacked });
  cleanups.push(workspace.cleanup);
  let time = Date.now();
  const now = () => time;
  const links = new IdentityLinks(workspace.database, now);
  const link = () => links.linkPending(links.recordPending(identity), workspace.identity, workspace.identity.principalId);
  return { ...workspace, links, link, now, advance: (ms: number) => { time += ms; } };
}

describe("Explicit web identity association", () => {
  it("keeps existing identity/project rows and resolves by subject, never email", () => {
    const w = setup();
    const before = w.service.getProject(w.projectId);
    expect(() => w.links.resolve(identity)).toThrow(/not linked/u);
    w.link();
    expect(w.links.resolve(identity)).toEqual(w.identity);
    expect(() => w.links.resolve({ ...identity, subject: "other-user" })).toThrow(/not linked/u);
    expect(w.service.getProject(w.projectId)).toEqual(before);
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM principals").get()).toEqual({ n: 1 });
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM workspaces").get()).toEqual({ n: 1 });
    expect(w.database.prepare("SELECT action FROM identity_link_events").all()).toEqual([{ action: "LINK" }]);
  });

  it("rejects expired/reused pending claims, wrong targets and reassignment", () => {
    const w = setup();
    const pending = w.links.recordPending(identity);
    expect(() => w.links.linkPending(pending, { ...w.identity, workspaceId: randomUUID() }, w.identity.principalId))
      .toThrow(/existing Workspace owner/u);
    expect(() => w.links.linkPending(pending, w.identity, randomUUID())).toThrow(/existing Workspace owner/u);
    w.advance(600_000);
    expect(() => w.links.linkPending(pending, w.identity, w.identity.principalId)).toThrow(/expired/u);
    const valid = w.links.recordPending(identity);
    w.links.linkPending(valid, w.identity, w.identity.principalId);
    expect(() => w.links.linkPending(valid, w.identity, w.identity.principalId)).toThrow(/missing/u);
    expect(() => w.links.linkPending(w.links.recordPending(identity), w.identity, w.identity.principalId))
      .toThrow(/already has/u);
  });

  it("rolls association and pending consumption back when atomic audit fails", () => {
    const w = setup();
    const pending = w.links.recordPending(identity);
    w.database.exec("CREATE TRIGGER fail_link_audit BEFORE INSERT ON identity_link_events BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
    expect(() => w.links.linkPending(pending, w.identity, w.identity.principalId)).toThrow(/audit unavailable/u);
    expect(() => w.links.resolve(identity)).toThrow(/not linked/u);
    expect(w.links.inspectPending(pending).id).toBe(pending);
  });

  it("uses the operator CLI against an existing external synthetic database", () => {
    const w = setup(true);
    const pending = w.links.recordPending(identity);
    expect(runIdentityAdmin(["inspect", "--db", w.databasePath, "--pending", pending])).toMatchObject({ subject: identity.subject });
    expect(runIdentityAdmin(["link", "--db", w.databasePath, "--pending", pending,
      "--principal", w.identity.principalId, "--workspace", w.identity.workspaceId])).toEqual({ status: "ok", action: "link" });
    expect(w.links.resolve(identity)).toEqual(w.identity);
    runIdentityAdmin(["revoke", "--db", w.databasePath, "--issuer", identity.issuer, "--subject", identity.subject,
      "--principal", w.identity.principalId, "--workspace", w.identity.workspaceId]);
    expect(() => w.links.resolve(identity)).toThrow(/not linked/u);
    expect(() => runIdentityAdmin(["inspect", "--db", `${w.directory}/missing.db`, "--pending", pending])).toThrow();
  });
});

describe("Sessions and immutable application identity", () => {
  it("rechecks revocation/ownership, rotates sessions and cannot resurrect a revoked link", () => {
    const w = setup(); w.link();
    const sessions = new SessionStore(w.links, w.now);
    const first = sessions.createSession(identity);
    const second = sessions.createSession(identity, first);
    expect(() => sessions.getSession(first)).toThrow(/invalid/u);
    expect(sessions.getSession(second)).toMatchObject(w.identity);
    w.links.revoke(identity, w.identity, w.identity.principalId);
    expect(() => sessions.getSession(second)).toThrow(/not linked/u);
    expect(() => w.links.linkPending(w.links.recordPending(identity), w.identity, w.identity.principalId)).toThrow(/association/u);
    expect(w.database.prepare("SELECT action FROM identity_link_events ORDER BY rowid").all()).toEqual([{ action: "LINK" }, { action: "REVOKE" }]);
  });

  it("enforces inactivity, absolute expiry, process-local sessions and one-use logins", () => {
    const w = setup(); w.link();
    const sessions = new SessionStore(w.links, w.now);
    const idle = sessions.createSession(identity);
    w.advance(12 * 3_600_000);
    expect(() => sessions.getSession(idle)).toThrow(/expired/u);
    const active = sessions.createSession(identity);
    for (let i = 0; i < 16; i++) { w.advance(10 * 3_600_000); sessions.getSession(active); }
    w.advance(8 * 3_600_000);
    expect(() => sessions.getSession(active)).toThrow(/expired/u);
    const fresh = sessions.createSession(identity);
    expect(() => new SessionStore(w.links, w.now).getSession(fresh)).toThrow(/invalid/u);
    const login = sessions.beginLogin("/workspace/job-search/today");
    expect(() => sessions.consumeLogin(login.token, "wrong-state")).toThrow(/invalid/u);
    sessions.consumeLogin(login.token, login.transaction.state);
    expect(() => sessions.consumeLogin(login.token, login.transaction.state)).toThrow(/invalid/u);
    const expired = sessions.beginLogin("/workspace/job-search/today");
    w.advance(600_000);
    expect(() => sessions.consumeLogin(expired.token, expired.transaction.state)).toThrow(/expired/u);
  });

  it("scopes both application and Today reads and rejects all legacy web mutations", () => {
    const w = setup();
    const context = verifiedRequestContext(w.database, w.identity, "WEB", randomUUID());
    expect(Object.isFrozen(context)).toBe(true);
    const scoped = new WorkspaceService(w.database, context);
    expect(scoped.getProject(w.projectId)).toEqual(w.service.getProject(w.projectId));
    expect(scoped.todayQueryService.getToday()).toEqual(w.service.todayQueryService.getToday());
    expect(() => scoped.ensureDevelopmentIdentity()).toThrow(/cannot initialize/u);
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "synthetic" };
    expect(() => scoped.createJobApplication({ company: "Other", role: "Role", authority, idempotencyKey: "forged-dev" }))
      .toThrow(/not enabled/u);
    expect(() => scoped.updateJobApplication({ projectId: w.projectId, expectedRecordVersion: 1, role: "Forged", idempotencyKey: "forged-meta" }))
      .toThrow(/not enabled/u);
    expect(() => scoped.taskService.createTask({ projectId: w.projectId, title: "Forged", taskKind: "OTHER", priority: "LOW", authority, idempotencyKey: "forged-task" }))
      .toThrow(/not enabled/u);
    const other = new WorkspaceService(w.database, { issuer: "test-other", subject: "other", workspaceName: "Other" });
    const otherOwner = other.ensureDevelopmentIdentity();
    const otherWeb = new WorkspaceService(w.database, verifiedRequestContext(w.database, otherOwner, "WEB", randomUUID()));
    expect(() => otherWeb.getProject(w.projectId)).toThrow(/not found/u);
    expect(otherWeb.listJobApplications().applications).toEqual([]);
    expect(otherWeb.todayQueryService.getToday().attention).toEqual([]);
    expect(() => verifiedRequestContext(w.database, { ...w.identity, workspaceId: otherOwner.workspaceId }, "WEB", "test"))
      .toThrow(/not mapped/u);
  });
});
