import { request as httpRequest, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createWebAuthApp } from "../../src/auth/web-auth-app.js";
import { IdentityLinks } from "../../src/auth/identity-links.js";
import { createTestWorkspace } from "../helpers/test-workspace.js";
import { syntheticOidc, syntheticIssuer, webOrigin } from "../helpers/synthetic-oidc.js";
import { randomUUID } from "node:crypto";
import { WorkspaceService } from "../../src/application/workspace-service.js";

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

async function setup(bootstrapEnabled = true, timeZone = "Australia/Sydney") {
  const workspace = createTestWorkspace();
  cleanups.push(workspace.cleanup);
  const harness = syntheticOidc();
  let time = Date.now();
  const links = new IdentityLinks(workspace.database, () => time);
  const app = createWebAuthApp({ database: workspace.database, provider: harness.provider,
    origin: webOrigin, bootstrapEnabled, now: () => time, timeZone });
  const server: Server = app.listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  cleanups.push(() => new Promise<void>((done) => server.close(() => done())));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test listener");
  // Node fetch rewrites Host. Use the HTTP transport explicitly to exercise the
  // canonical HTTPS host that an ingress proxy would send over local loopback.
  const request = (path: string, options: RequestInit = {}) => new Promise<Response>((done, reject) => {
    const headers = new Headers(options.headers);
    if (!headers.has("host")) headers.set("host", new URL(webOrigin).host);
    const outgoing = httpRequest({ hostname: "127.0.0.1", port: address.port, path,
      method: options.method ?? "GET", headers: Object.fromEntries(headers) }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
      incoming.on("error", reject);
      incoming.on("end", () => {
        const responseHeaders = new Headers();
        for (let i = 0; i < incoming.rawHeaders.length; i += 2) {
          responseHeaders.append(incoming.rawHeaders[i]!, incoming.rawHeaders[i + 1]!);
        }
        done(new Response(incoming.statusCode === 204 ? null : Buffer.concat(chunks),
          { status: incoming.statusCode!, headers: responseHeaders }));
      });
    });
    outgoing.on("error", reject);
    outgoing.end(options.body);
  });
  const start = async (returnTo = "/workspace/job-search/today") => {
    const response = await request(`/auth/start?returnTo=${encodeURIComponent(returnTo)}`);
    expect(response.status).toBe(303);
    const cookie = response.headers.getSetCookie()[0]!.split(";")[0]!;
    const location = new URL(response.headers.get("location")!);
    return { cookie, location, response };
  };
  const finish = (login: Awaited<ReturnType<typeof start>>, patch: Record<string, unknown> = {}, forged = false,
    extraCookie = "") => {
    const callback = harness.authorize(login.location, patch, forged);
    return request(`${callback.pathname}${callback.search}`, { headers: { cookie: `${login.cookie}${extraCookie ? `; ${extraCookie}` : ""}` } });
  };
  const link = () => links.linkPending(links.recordPending({ issuer: syntheticIssuer,
    subject: "synthetic-user", email: "synthetic-user@example.test" }), workspace.identity, workspace.identity.principalId);
  const sessionCookie = (response: Response) => response.headers.getSetCookie()
    .find((value) => value.startsWith("__Host-paw_session=") && !value.startsWith("__Host-paw_session=;"))!.split(";")[0]!;
  return { ...workspace, harness, links, request, start, finish, link, sessionCookie,
    advance: (ms: number) => { time += ms; } };
}

describe("Signed OIDC authentication over the isolated web transport", () => {
  it("renders a safe login then the original object page, and removes private content after revocation", async () => {
    const w = await setup(); w.link();
    const path = `/workspace/job-search/applications/${w.projectId}`;
    const signedOut = await w.request(path);
    expect(signedOut.status).toBe(401);
    expect(signedOut.headers.get("content-type")).toContain("text/html");
    const loginHtml = await signedOut.text();
    expect(loginHtml).toContain(`/auth/start?returnTo=${encodeURIComponent(path)}`);
    expect(loginHtml).not.toContain("Example Co");
    const accepted = await w.finish(await w.start(path));
    const headers = { cookie: w.sessionCookie(accepted) };
    const object = await w.request(accepted.headers.get("location")!, { headers });
    expect(object.status).toBe(200);
    expect(await object.text()).toContain("Example Co");
    w.links.revoke({ issuer: syntheticIssuer, subject: "synthetic-user" }, w.identity, w.identity.principalId);
    const revoked = await w.request(path, { headers });
    expect(revoked.status).toBe(401);
    expect(await revoked.text()).not.toContain("Example Co");
  });

  it("renders truthful terminal tasks, observations and admitted/proposed history with zero read writes", async () => {
    const w = await setup(); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic page read" };
    const task = w.service.taskService.createTask({ projectId: w.projectId, title: "Completed synthetic task",
      taskKind: "OTHER", priority: "LOW", authority, idempotencyKey: randomUUID() }).task;
    w.service.taskService.updateTask({ taskId: task.id, expectedRecordVersion: 1, status: "DONE", authority, idempotencyKey: randomUUID() });
    w.service.recordObservation({ projectId: w.projectId, resourceType: "NOTE", provider: "synthetic", externalId: null,
      externalUri: "javascript:alert(1)", title: "<img src=x onerror=alert(1)>", observedAt: new Date().toISOString(),
      observedFacts: { sourceFacts: { summary: "Observed <script>bad</script>" }, interpretation: { proposedMeaning: "Advisory only" } },
      idempotencyKey: randomUUID() });
    w.service.recordObservation({ projectId: w.projectId, resourceType: "EMAIL", provider: "gmail", externalId: "synthetic-message",
      externalUri: "https://mail.google.com/", title: "Synthetic Gmail provenance", observedAt: new Date().toISOString(),
      observedFacts: { contractVersion: "gmail-job-observation-v0.1",
        sourceFacts: { receivedAt: new Date().toISOString(), senderDomain: "example.test" },
        interpretation: { company: "Example Co", role: "Software Engineer", emailKind: "OTHER", summary: "Synthetic interpreted summary" } },
      idempotencyKey: randomUUID() });
    w.service.proposeTransition({ projectId: w.projectId, expectedLifecycleVersion: 1, toState: "INTERVIEWING",
      triggerType: "USER_ASSERTION", evidenceResourceIds: [], rationale: "Unconfirmed synthetic proposal",
      idempotencyKey: randomUUID() });
    const headers = { cookie: w.sessionCookie(await w.finish(await w.start())) };
    const before = w.database.prepare("SELECT total_changes() AS n").get();
    const base = `/workspace/job-search/applications/${w.projectId}`;
    const done = await (await w.request(`${base}?status=DONE`, { headers })).text();
    expect(done).toContain("Completed synthetic task"); expect(done).toContain("已完成");
    const detail = await (await w.request(`/workspace/job-search/tasks/${task.id}`, { headers })).text();
    expect(detail).toContain("完成时间"); expect(detail).not.toContain("尚无完成记录");
    expect(detail).toContain(`Task ${task.id}`);
    const open = await (await w.request(base, { headers })).text();
    expect(open).not.toContain("Completed synthetic task");
    const resources = await (await w.request(`${base}?section=resources`, { headers })).text();
    expect(resources).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(resources).toContain("Observed &lt;script&gt;bad&lt;/script&gt;");
    expect(resources).toContain("建议 / 推断：Advisory only");
    expect(resources).toContain("建议 / 推断：Synthetic interpreted summary");
    expect(resources).toContain("来源域名 example.test");
    expect(resources).not.toContain('href="javascript:'); expect(resources).not.toContain("<img");
    const history = await (await w.request(`${base}?section=history`, { headers })).text();
    expect(history).not.toContain("Unconfirmed synthetic proposal");
    const proposals = await (await w.request(`${base}?section=history&status=PROPOSED`, { headers })).text();
    expect(proposals).toContain("Unconfirmed synthetic proposal"); expect(proposals).toContain("建议 · 尚未确认");
    const today = await (await w.request("/workspace/job-search/today", { headers })).text();
    expect(today).not.toContain("Completed synthetic task"); expect(today).toContain("Australia/Sydney");
    expect(w.database.prepare("SELECT total_changes() AS n").get()).toEqual(before);
  });

  it("supports ordinary GET filters and pagination, rejects invalid queries and offers a clean stale-cursor reload", async () => {
    const w = await setup(); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic page read" };
    w.service.createJobApplication({ company: "Second company", role: "Role", authority, idempotencyKey: randomUUID() });
    const headers = { cookie: w.sessionCookie(await w.finish(await w.start())) };
    const base = "/workspace/job-search/applications";
    const filtered = await w.request(`${base}?q=Example&lifecycle=&status=OPEN&sort=UPDATED_DESC`, { headers });
    expect(filtered.status).toBe(200);
    expect(await filtered.text()).not.toContain("Second company");
    const empty = await (await w.request(`${base}?q=absent`, { headers })).text();
    expect(empty).toContain("没有匹配的申请"); expect(empty).toContain("共 0 项");
    const escaped = await (await w.request(`${base}?q=${encodeURIComponent('\"><script>bad</script>')}`, { headers })).text();
    expect(escaped).toContain("&quot;&gt;&lt;script&gt;bad&lt;/script&gt;");
    const first = await (await w.request(`${base}?pageSize=1&status=ALL`, { headers })).text();
    const nextPath = /data-more href="([^"]+)"/u.exec(first)![1]!.replaceAll("&amp;", "&");
    expect((await w.request(nextPath, { headers })).status).toBe(200);
    w.service.createJobApplication({ company: "Changed membership", role: "Role", authority, idempotencyKey: randomUUID() });
    const stale = await w.request(nextPath, { headers });
    expect(stale.status).toBe(409);
    const staleHtml = await stale.text();
    expect(staleHtml).toContain("列表已有更新");
    expect(staleHtml).toContain(`${base}?pageSize=1&amp;status=ALL`);
    expect(staleHtml).not.toContain("cursor=");
    for (const suffix of ["?status=OPEN&status=ALL", "?workspaceId=other", "?pageSize=0", "/bad-id",
      `/${w.projectId}?section=unknown`, `/${w.projectId}?section=resources&status=DONE`]) {
      expect((await w.request(`${base}${suffix}`, { headers })).status).toBe(400);
    }
  });

  it("serves only the two approved assets under CSP and gives identical private/missing HTML errors", async () => {
    const w = await setup(); w.link();
    for (const [name, type] of [["workspace.css", "text/css"], ["workspace.js", "javascript"]]) {
      const response = await w.request(`/assets/${name}`);
      expect(response.status).toBe(200); expect(response.headers.get("content-type")).toContain(type);
      expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
      expect(response.headers.get("content-security-policy")).not.toContain("unsafe-inline");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect((await w.request("/assets/views.ts")).status).toBe(404);
    const other = new WorkspaceService(w.database, { issuer: "other", subject: "other", workspaceName: "Other" });
    other.ensureDevelopmentIdentity();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic private page" };
    const result = other.createJobApplication({ company: "PRIVATE OWNER DATA", role: "Role", authority, idempotencyKey: randomUUID() });
    if (result.creationStatus !== "CREATED") throw new Error("Expected creation");
    const headers = { cookie: w.sessionCookie(await w.finish(await w.start())) };
    for (const id of [randomUUID(), result.project.id]) {
      const response = await w.request(`/workspace/job-search/applications/${id}`, { headers });
      expect(response.status).toBe(404);
      const html = await response.text();
      expect(html).toContain("找不到这条记录"); expect(html).not.toContain("PRIVATE OWNER DATA");
    }
  });

  it("renders recoverable browser login failures and a generic page when storage is unavailable", async () => {
    const w = await setup();
    const login = await w.start();
    const callback = w.harness.authorize(login.location);
    const denied = await w.request(`${callback.pathname}${callback.search}`, { headers: { cookie: login.cookie, accept: "text/html" } });
    expect(denied.status).toBe(403);
    expect(await denied.text()).toContain("此账户尚未关联工作空间");
    w.link();
    const cancelled = await w.start();
    const failure = await w.request(`/auth/google/callback?error=access_denied&state=${cancelled.location.searchParams.get("state")}`,
      { headers: { cookie: cancelled.cookie, accept: "text/html" } });
    expect(failure.status).toBe(401); expect(await failure.text()).toContain("未能完成登录");
    const cookie = w.sessionCookie(await w.finish(await w.start()));
    w.database.close();
    const unavailable = await w.request("/workspace/job-search/today", { headers: { cookie } });
    expect(unavailable.status).toBe(503);
    const html = await unavailable.text();
    expect(html).toContain("暂时无法读取"); expect(html).not.toContain("database");
    expect(html).not.toContain("Example Co");
  });

  it("requires explicit operator linking, then returns the original Workspace and saved object route", async () => {
    const w = await setup();
    const login = await w.start(`/workspace/job-search/applications/${w.projectId}`);
    expect(login.location.searchParams.get("scope")).toBe("openid email");
    expect(login.location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(login.location.searchParams.get("nonce")).toBeTruthy();
    expect(login.location.searchParams.has("returnTo")).toBe(false);
    const denied = await w.finish(login);
    expect(denied.status).toBe(403);
    const pending = await denied.json() as { pendingId: string };
    expect(w.links.inspectPending(pending.pendingId)).toMatchObject({ subject: "synthetic-user" });
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM workspaces").get()).toEqual({ n: 1 });
    w.links.linkPending(pending.pendingId, w.identity, w.identity.principalId);
    const accepted = await w.finish(await w.start(`/workspace/job-search/applications/${w.projectId}`));
    expect(accepted.status).toBe(303);
    expect(accepted.headers.get("location")).toBe(`/workspace/job-search/applications/${w.projectId}`);
    const cookie = w.sessionCookie(accepted);
    const header = accepted.headers.getSetCookie().find((value) => value.startsWith("__Host-paw_session="))!;
    for (const attribute of ["Secure", "HttpOnly", "SameSite=Lax", "Path=/"]) expect(header).toContain(attribute);
    expect(header).not.toContain("Domain=");
    const session = await w.request("/api/v1/session", { headers: { cookie } });
    expect(await session.json()).toMatchObject({ authenticated: true, workspaceId: w.identity.workspaceId });
    expect(session.headers.get("cache-control")).toBe("private, no-store");
    expect(session.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it.each([
    ["wrong issuer", { iss: "https://wrong.example.test" }, false],
    ["wrong audience", { aud: "other-client" }, false],
    ["wrong nonce", { nonce: "different" }, false],
    ["expired token", { exp: 1 }, false],
    ["unverified email", { email_verified: false }, false],
    ["forged signature", {}, true],
  ])("rejects %s without issuing a session or pending identity", async (_label, patch, forged) => {
    const w = await setup(); w.link();
    const response = await w.finish(await w.start(), patch, forged);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "LOGIN_FAILED", restart: "/auth/start" });
    expect(response.headers.getSetCookie().some((value) => value.startsWith("__Host-paw_session="))).toBe(false);
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM pending_web_identities").get()).toEqual({ n: 0 });
  });

  it("rejects cookie/state mismatch, callback replay, cancellation and expired transactions", async () => {
    const w = await setup(); w.link();
    const login = await w.start();
    const callback = w.harness.authorize(login.location);
    const path = `${callback.pathname}${callback.search}`;
    expect((await w.request(path)).status).toBe(401);
    expect((await w.request(`${path}&state=second`, { headers: { cookie: login.cookie } })).status).toBe(401);
    expect(w.harness.tokenCalls).toBe(0);
    expect((await w.request(path, { headers: { cookie: login.cookie } })).status).toBe(303);
    expect((await w.request(path, { headers: { cookie: login.cookie } })).status).toBe(401);
    expect(w.harness.tokenCalls).toBe(1);
    const cancelled = await w.start();
    expect((await w.request(`/auth/google/callback?error=access_denied&state=${cancelled.location.searchParams.get("state")}`,
      { headers: { cookie: cancelled.cookie } })).status).toBe(401);
    const expired = await w.start(); w.advance(600_000);
    expect((await w.finish(expired)).status).toBe(401);
  });

  it("denies an unmapped account with the same email and disables bootstrap by default", async () => {
    const w = await setup(false); w.link();
    const accepted = await w.finish(await w.start());
    const cookie = w.sessionCookie(accepted);
    const response = await w.finish(await w.start(), { sub: "different-subject" }, false, cookie);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "ACCESS_DENIED" });
    expect((await w.request("/api/v1/session", { headers: { cookie } })).status).toBe(401);
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM pending_web_identities").get()).toEqual({ n: 0 });
  });

  it("protects logout against CSRF, rotates sessions and immediately observes link revocation", async () => {
    const w = await setup(); w.link();
    const first = w.sessionCookie(await w.finish(await w.start()));
    const cookie = w.sessionCookie(await w.finish(await w.start(), {}, false, first));
    expect((await w.request("/api/v1/session", { headers: { cookie: first } })).status).toBe(401);
    const session = await (await w.request("/api/v1/session", { headers: { cookie } })).json() as { csrfToken: string };
    expect((await w.request("/auth/logout", { method: "POST", headers: { cookie } })).status).toBe(403);
    expect((await w.request("/auth/logout", { method: "POST", headers: { cookie, origin: "https://evil.example.test", "x-csrf-token": session.csrfToken } })).status).toBe(403);
    expect((await w.request("/auth/logout", { method: "POST", headers: { cookie, origin: webOrigin, "x-csrf-token": session.csrfToken } })).status).toBe(204);
    expect((await w.request("/api/v1/session", { headers: { cookie } })).status).toBe(401);
    const revoked = w.sessionCookie(await w.finish(await w.start()));
    w.links.revoke({ issuer: syntheticIssuer, subject: "synthetic-user" }, w.identity, w.identity.principalId);
    expect((await w.request("/api/v1/session", { headers: { cookie: revoked } })).status).toBe(401);
  });

  it("rejects unsafe returns/hosts and never mounts public MCP, health or administration routes", async () => {
    const w = await setup();
    for (const value of ["//evil.test", "https://evil.test", "/\\evil.test", "/workspace/job-search/%2f%2fevil.test", "/workspace/job-search/today?next=evil"]) {
      expect((await w.request(`/auth/start?returnTo=${encodeURIComponent(value)}`)).status).toBe(400);
    }
    expect((await w.request("/auth/start", { headers: { host: "evil.test", "x-forwarded-host": new URL(webOrigin).host } })).status).toBe(400);
    for (const path of ["/mcp", "/healthz", "/auth/link", "/api/v1/job-search/tasks/example/complete"]) {
      expect((await w.request(path, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true, principalId: w.identity.principalId }) })).status).toBe(404);
    }
  });

  it("bounds login attempts independently of spoofed client IP headers", async () => {
    const w = await setup();
    for (let i = 0; i < 30; i++) {
      expect((await w.request("/auth/start", { headers: { "x-forwarded-for": `192.0.2.${i}` } })).status).toBe(303);
    }
    expect((await w.request("/auth/start")).status).toBe(429);
    w.advance(60_000);
    expect((await w.request("/auth/start")).status).toBe(303);
  });

  it("serves authenticated paged reads across requests and reports stale or invalid cursors", async () => {
    const w = await setup(); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic read test" };
    w.service.createJobApplication({ company: "Second", role: "Role", authority, idempotencyKey: randomUUID() });
    expect((await w.request("/api/v1/job-search/applications")).status).toBe(401);
    const cookie = w.sessionCookie(await w.finish(await w.start()));
    const headers = { cookie };
    const first = await (await w.request("/api/v1/job-search/applications?pageSize=1", { headers })).json() as {
      items: Array<{ projectId: string }>; nextCursor: string; totalCount: number;
    };
    expect(first.totalCount).toBe(2);
    const nextPath = `/api/v1/job-search/applications?pageSize=1&cursor=${encodeURIComponent(first.nextCursor)}`;
    const second = await w.request(nextPath, { headers });
    expect(second.status).toBe(200);
    const next = await second.json() as { items: Array<{ projectId: string }>; nextCursor: null };
    expect(next.items[0]?.projectId).not.toBe(first.items[0]?.projectId);
    expect(next.nextCursor).toBeNull();
    w.service.createJobApplication({ company: "New membership", role: "Role", authority, idempotencyKey: randomUUID() });
    const stale = await w.request(nextPath, { headers });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: "STALE_CURSOR", reloadRequired: true });
    const tampered = await w.request("/api/v1/job-search/applications?cursor=tampered", { headers });
    expect(tampered.status).toBe(409);
    for (const query of ["pageSize=101", "pageSize=1&pageSize=2", `workspaceId=${w.identity.workspaceId}`, "q[a]=value"]) {
      expect((await w.request(`/api/v1/job-search/applications?${query}`, { headers })).status).toBe(400);
    }
    expect((await w.request("/api/v1/job-search/applications", { headers })).status).toBe(200);
  });

  it("returns exact completed tasks, detail/history/resources and configured Today with no business writes", async () => {
    const w = await setup(true, "Pacific/Auckland"); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic read test" };
    const task = w.service.taskService.createTask({ projectId: w.projectId, title: "Synthetic task", taskKind: "OTHER",
      priority: "HIGH", authority, idempotencyKey: randomUUID() }).task;
    w.service.taskService.updateTask({ taskId: task.id, expectedRecordVersion: 1, status: "DONE", authority, idempotencyKey: randomUUID() });
    const cookie = w.sessionCookie(await w.finish(await w.start()));
    const before = w.database.prepare("SELECT total_changes() AS n").get();
    const headers = { cookie };
    const read = await w.request(`/api/v1/job-search/tasks/${task.id}`, { headers });
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ task: w.service.jobSearchQueryService.getTask(task.id), asOf: expect.any(String) });
    const tasks = await (await w.request(`/api/v1/job-search/applications/${w.projectId}/tasks?status=DONE`, { headers })).json();
    expect(tasks).toMatchObject({ totalCount: 1, items: [{ id: task.id, status: "DONE", recordVersion: 2 }] });
    for (const suffix of ["", "/history", "/resources"]) {
      expect((await w.request(`/api/v1/job-search/applications/${w.projectId}${suffix}`, { headers })).status).toBe(200);
    }
    const today = await (await w.request("/api/v1/job-search/today", { headers })).json() as { timeZone: string; asOf: string };
    expect(today.timeZone).toBe("Pacific/Auckland");
    expect(today.asOf).toBeTruthy();
    expect(w.database.prepare("SELECT total_changes() AS n").get()).toEqual(before);
    w.links.revoke({ issuer: syntheticIssuer, subject: "synthetic-user" }, w.identity, w.identity.principalId);
    expect((await w.request(`/api/v1/job-search/tasks/${task.id}`, { headers })).status).toBe(401);
  });

  it("returns identical not-found errors for missing and another owner's child objects", async () => {
    const w = await setup(); w.link();
    const other = new WorkspaceService(w.database, { issuer: "other", subject: "other", workspaceName: "Other" });
    other.ensureDevelopmentIdentity();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic other owner" };
    const created = other.createJobApplication({ company: "Other", role: "Role", authority, idempotencyKey: randomUUID() });
    if (created.creationStatus !== "CREATED") throw new Error("Expected creation");
    const task = other.taskService.createTask({ projectId: created.project.id, title: "Other private task", taskKind: "OTHER", priority: "LOW", authority, idempotencyKey: randomUUID() }).task;
    const headers = { cookie: w.sessionCookie(await w.finish(await w.start())) };
    for (const path of [`tasks/${task.id}`, `tasks/${randomUUID()}`, `applications/${created.project.id}`,
      `applications/${created.project.id}/tasks`, `applications/${created.project.id}/history`,
      `applications/${created.project.id}/resources`]) {
      const response = await w.request(`/api/v1/job-search/${path}`, { headers });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "NOT_FOUND" });
    }
  });
});
