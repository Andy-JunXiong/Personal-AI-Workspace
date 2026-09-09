import { request as httpRequest, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createWebAuthApp } from "../../src/auth/web-auth-app.js";
import { IdentityLinks } from "../../src/auth/identity-links.js";
import { createTestWorkspace } from "../helpers/test-workspace.js";
import { syntheticOidc, syntheticIssuer, webOrigin } from "../helpers/synthetic-oidc.js";
import { randomUUID } from "node:crypto";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { checkWebRelease } from "../../src/operations/web-release-check.js";
import { GmailConnections } from "../../src/gmail/connections.js";
import type { GmailRuntime } from "../../src/gmail/checks.js";
import { join } from "node:path";

const cleanups: Array<() => void | Promise<void>> = [];
function gmailFixture(workspace: ReturnType<typeof createTestWorkspace>): GmailRuntime {
  // Keep the same source timestamp across retries, inside the normal 24-hour window.
  const receivedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return {
    connections: new GmailConnections(join(workspace.directory, "mail"), Buffer.alloc(32, 9)),
    authorization: {
      async authorizationUrl(checks) { const url = new URL("https://accounts.google.com/auth"); url.searchParams.set("state", checks.state); return url; },
      async authenticate(callback) { const id = callback.searchParams.get("code")!; return { subject: id, email: `${id}@example.test`, refreshToken: id }; },
      async access(connection) { return connection.refreshToken; },
    },
    reader: { async search() { return { complete: true, scope: "synthetic", messages: [{ id: "abcd", threadId: "1234",
      receivedAt, senderDomain: "example.test", subject: "Interview", text: "Interview invitation" }] }; } },
    interpreter: { async interpret(_company, _role, messages) { return { items: messages.map(m => ({ messageId: m.id,
      relevant: true, category: "INTERVIEW" as const, summary: "收到面试邀请", evidenceQuote: "Interview invitation", requiresAction: true })) }; } },
  };
}

it("authorizes two distinct mailboxes with session-bound callbacks and checks them without enabling general browser writes", async () => {
  const w = await setup(false, "Australia/Sydney", false, gmailFixture); w.link();
  const cookie = w.sessionCookie(await w.finish(await w.start()));
  const session = await (await w.request("/api/v1/session", { headers: { cookie } })).json();
  const headers = { cookie, origin: webOrigin, "content-type": "application/json", "x-csrf-token": session.csrfToken };
  const endpoint = `/api/v1/gmail/applications/${w.projectId}/check`;
  expect((await w.request(endpoint, { method: "POST", headers: { cookie }, body: "{}" })).status).toBe(403);
  expect((await w.request(`/api/v1/gmail/applications/${randomUUID()}/check`, { method: "POST", headers, body: "{}" })).status).toBe(404);
  for (const slot of [1, 2]) {
    const started = await w.request("/api/v1/gmail/connect", { method: "POST", headers, body: JSON.stringify({ slot, projectId: w.projectId }) });
    const state = new URL((await started.json()).url).searchParams.get("state");
    const callback = `/auth/gmail/callback?state=${state}&code=mail${slot}`;
    expect((await w.request(callback)).status).toBe(401);
    expect((await w.request(callback, { headers: { cookie } })).status).toBe(303);
    expect((await w.request(callback, { headers: { cookie } })).status).toBe(403);
  }
  const before = w.service.getProject(w.projectId).project;
  const started = await w.request(endpoint, { method: "POST", headers, body: "{}" });
  const run = await started.json();
  expect(started.status).toBe(202);
  expect((await (await w.request(endpoint, { method: "POST", headers, body: "{}" })).json()).id).toBe(run.id);
  const result = await (await w.request(endpoint, { headers: { cookie } })).json();
  expect(result.run.state).toBe("DONE");
  const detail = w.service.jobSearchQueryService.getApplication(w.projectId);
  expect(detail.latestGmailCheck?.facts).toMatchObject({ status: "UPDATED", matchedMessageCount: 2 });
  expect(w.database.prepare("SELECT count(*) AS n FROM resources WHERE provider = 'gmail'").get()).toEqual({ n: 2 });
  expect(w.service.getProject(w.projectId).project).toEqual(before);
  w.advance(61_000);
  await w.request(endpoint, { method: "POST", headers, body: "{}" });
  await w.request(endpoint, { headers: { cookie } });
  expect(w.service.jobSearchQueryService.getApplication(w.projectId).latestGmailCheck?.facts).toMatchObject({ status: "NO_UPDATE" });
  expect(w.database.prepare("SELECT count(*) AS n FROM resources WHERE provider = 'gmail'").get()).toEqual({ n: 2 });
  const html = await (await w.request(`/workspace/job-search/applications/${w.projectId}`, { headers: { cookie } })).text();
  expect(html).toContain("检查两个邮箱的最新更新");
  expect(html).toContain("收到面试邀请");
  await w.request("/api/v1/gmail/disconnect", { method: "POST", headers, body: '{"slot":2}' });
  w.advance(61_000);
  await w.request(endpoint, { method: "POST", headers, body: "{}" });
  await w.request(endpoint, { headers: { cookie } });
  expect(w.service.jobSearchQueryService.getApplication(w.projectId).latestGmailCheck?.facts).toMatchObject({ status: "PARTIAL" });
});

it("records both-mailbox failure as FAILED rather than no update", async () => {
  const w = await setup(false, "Australia/Sydney", false, gmailFixture); w.link();
  const cookie = w.sessionCookie(await w.finish(await w.start()));
  const { csrfToken } = await (await w.request("/api/v1/session", { headers: { cookie } })).json();
  await w.request(`/api/v1/gmail/applications/${w.projectId}/check`, { method: "POST",
    headers: { cookie, origin: webOrigin, "x-csrf-token": csrfToken, "content-type": "application/json" }, body: "{}" });
  expect(w.service.jobSearchQueryService.getApplication(w.projectId).latestGmailCheck?.facts).toMatchObject({ status: "FAILED" });
});

it("checks every application beyond one page including closed/rejected records, isolates owners and survives individual failures", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  const w = await setup(false, "Australia/Sydney", false, workspace => {
    const runtime = gmailFixture(workspace);
    for (const slot of [1, 2]) runtime.connections.put(workspace.identity, slot,
      { subject: `mail${slot}`, email: `mail${slot}@example.test`, refreshToken: `token${slot}` });
    runtime.reader = { async search(_token, company) {
      reads++; await gate;
      if (company === "Failure company") throw new Error("Mailbox unavailable");
      return { messages: [], complete: true, scope: "synthetic" };
    } };
    return runtime;
  });
  w.link();
  for (let i = 0; i < 105; i++) w.service.seedJobApplication({ projectId: randomUUID(), initialTransitionId: randomUUID(),
    title: `Job ${i}`, company: i === 0 ? "Failure company" : `Company ${i}`, role: "Engineer" });
  w.database.prepare("UPDATE projects SET status = 'CLOSED', lifecycle_state = 'REJECTED' WHERE id = ?").run(w.projectId);
  const other = new WorkspaceService(w.database, { issuer: "test-suite", subject: "other-batch-owner", workspaceName: "Other" });
  other.ensureDevelopmentIdentity();
  const privateId = randomUUID();
  other.seedJobApplication({ projectId: privateId, initialTransitionId: randomUUID(), title: "Private job", company: "PRIVATE", role: "Role" });
  const cookie = w.sessionCookie(await w.finish(await w.start()));
  const { csrfToken } = await (await w.request("/api/v1/session", { headers: { cookie } })).json();
  const headers = { cookie, origin: webOrigin, "x-csrf-token": csrfToken, "content-type": "application/json" };
  expect((await w.request("/api/v1/gmail/check-all", { method: "POST", headers: { cookie }, body: "{}" })).status).toBe(403);
  expect((await w.request("/api/v1/gmail/check-all")).status).toBe(401);
  const first = await (await w.request("/api/v1/gmail/check-all", { method: "POST", headers, body: "{}" })).json();
  expect(first.batch.total).toBe(106);
  expect(first.batch.state).toBe("RUNNING");
  const duplicate = await (await w.request("/api/v1/gmail/check-all", { method: "POST", headers, body: "{}" })).json();
  expect(duplicate.batch.id).toBe(first.batch.id);
  release();
  let final = first;
  for (let i = 0; i < 100; i++) {
    final = await (await w.request("/api/v1/gmail/check-all", { headers: { cookie } })).json();
    if (final.batch.state !== "RUNNING") break;
  }
  expect(final.batch.state).toBe("DONE");
  expect(final.batch.results).toHaveLength(106);
  expect(final.batch.results.filter((r: { outcome: string }) => r.outcome === "FAILED")).toHaveLength(1);
  expect(final.batch.results.map((r: { projectId: string }) => r.projectId)).toContain(w.projectId);
  expect(final.batch.results.map((r: { projectId: string }) => r.projectId)).not.toContain(privateId);
  expect(reads).toBe(212);
  expect(w.database.prepare("SELECT count(*) n FROM resources WHERE provider='workspace-gmail-check'").get()).toEqual({ n: 106 });
  const html = await (await w.request('/workspace/job-search/applications?status=OPEN&pageSize=1', { headers: { cookie } })).text();
  expect(html).toContain('data-gmail-check-all');
});

it("shows Gmail check receipts independently of task counts and rejects malformed success", async () => {
  const w = await setup();
  w.link();
  const headers = { cookie: w.sessionCookie(await w.finish(await w.start())) };
  const path = `/workspace/job-search/applications/${w.projectId}`;
  expect(await (await w.request(path, { headers })).text()).toContain("尚无有效的邮件检查记录");
  const input = { projectId: w.projectId, resourceType: "NOTE" as const, provider: "workspace-gmail-check",
    externalId: "check-1", externalUri: null, title: "Gmail check", observedAt: "2026-09-07T05:00:00Z", idempotencyKey: "check-1",
    observedFacts: { contractVersion: "gmail-application-check-v0.1", status: "NO_UPDATE",
      summary: "Only the existing confirmation was found.", searchScope: "Company and job, all result pages", matchedMessageCount: 1 } };
  const before = w.service.getProject(w.projectId);
  const first = w.service.recordObservation(input);
  expect(w.service.recordObservation(input).replayed).toBe(true);
  const html = await (await w.request(path, { headers })).text();
  expect(html).toContain("已检查，暂无新进展");
  expect(html).toContain("Only the existing confirmation was found.");
  expect(html).toContain("搜索 Gmail");
  expect(html).toContain("2026-09-07T05:00:00Z");
  expect(w.service.getProject(w.projectId).project).toEqual(before.project);
  expect(w.service.getProject(w.projectId).openTasks).toEqual(before.openTasks);
  expect(() => w.service.recordObservation({ ...input, externalId: "bad", idempotencyKey: "bad",
    observedFacts: { ...input.observedFacts, status: "SUCCESS" } })).toThrow();
  w.service.recordObservation({ ...input, externalId: "failed", idempotencyKey: "failed", observedAt: "2026-09-07T06:00:00Z",
    observedFacts: { ...input.observedFacts, status: "FAILED", summary: "Gmail unavailable" } });
  const failed = await (await w.request(path, { headers })).text();
  expect(failed).toContain("邮件检查失败");
  expect(failed).not.toContain("已检查，暂无新进展");
  expect(first.projectStateChanged).toBe(false);
});

it("shows the application date and chronological evidence, and renders a saved JD/skill report independently of resource pagination", async () => {
  const w = await setup(); w.link();
  w.database.prepare("UPDATE projects SET metadata_json = json_set(metadata_json, '$.appliedDate', '2026-07-01') WHERE id = ?").run(w.projectId);
  const headers = { cookie: w.sessionCookie(await w.finish(await w.start())) };
  const base = `/workspace/job-search/applications/${w.projectId}`;
  const beforeReport = await (await w.request(base, { headers })).text();
  expect(beforeReport).toContain("申请日期：2026-07-01");
  expect(beforeReport).toContain('section=timeline" aria-current="page"');
  expect(beforeReport).toContain("尚未保存 JD 正文");
  expect(beforeReport).toContain("尚未保存此岗位的技能匹配报告");
  const facts = { contractVersion: "job-application-profile-v0.1", jobDescription: "Build agents\nUse <script>unsafe()</script>",
    skillMatch: { summary: "Existing GPT assessment", matches: [{ requirement: "Agent systems", evidence: "Project experience",
      assessment: "PARTIAL" }], gaps: ["Production evaluation"] } };
  const input = { projectId: w.projectId, resourceType: "NOTE", provider: "chatgpt", externalId: "profile-1", externalUri: null,
    title: "Saved job report", observedAt: "2026-07-02T00:00:00Z", observedFacts: facts, idempotencyKey: randomUUID() };
  w.service.recordObservation(input);
  for (let i = 0; i < 12; i++) w.service.recordObservation({ ...input, externalId: `newer-${i}`, observedAt: "2026-09-01T00:00:00Z",
    observedFacts: { summary: "Unrelated later note" }, idempotencyKey: randomUUID() });
  expect(() => w.service.recordObservation({ ...input, observedFacts: { ...facts, skillMatch: "invented" }, idempotencyKey: randomUUID() })).toThrow();
  expect(() => w.service.recordObservation({ ...input, provider: "gmail", idempotencyKey: randomUUID() })).toThrow();
  const changes = w.database.prepare("SELECT total_changes() n").get();
  const html = await (await w.request(`${base}?pageSize=1`, { headers })).text();
  expect(html).toContain("Existing GPT assessment");
  expect(html).toContain("Project experience");
  expect(html).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
  expect(html).not.toContain("<script>unsafe()");
  expect(html.indexOf('aria-label="申请详情分区"')).toBeLessThan(html.indexOf('职位描述 · JD'));
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(changes);
  const list = await (await w.request("/workspace/job-search/applications", { headers })).text();
  expect(list).toContain("申请日期：2026-07-01");
  const first = w.service.jobSearchQueryService.listTimeline(w.projectId, { pageSize: 1 });
  expect(first.totalCount).toBe(2);
  expect(first.nextCursor).not.toBeNull();
  const next = w.service.jobSearchQueryService.listTimeline(w.projectId, { pageSize: 1, cursor: first.nextCursor });
  expect(next.items[0]?.kind).toBe("APPLICATION");
});
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

async function setup(bootstrapEnabled = true, timeZone = "Australia/Sydney", writesEnabled = false,
  gmailFactory?: (workspace: ReturnType<typeof createTestWorkspace>) => GmailRuntime) {
  const workspace = createTestWorkspace();
  cleanups.push(workspace.cleanup);
  const harness = syntheticOidc();
  let time = Date.now();
  const links = new IdentityLinks(workspace.database, () => time);
  const gmail = gmailFactory?.(workspace);
  const app = createWebAuthApp({ database: workspace.database, provider: harness.provider,
    origin: webOrigin, bootstrapEnabled, writesEnabled, now: () => time, timeZone, gmail });
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
  return { ...workspace, harness, links, request, start, finish, link, sessionCookie, gmail,
    advance: (ms: number) => { time += ms; } };
}

describe("Signed OIDC authentication over the isolated web transport", () => {
  it("passes the release checker against the real read and write route trees", async () => {
    for (const writesEnabled of [false, true]) {
      const w = await setup(true, "Australia/Sydney", writesEnabled);
      const before = w.database.prepare("SELECT total_changes() AS n").get();
      const fetcher = (input: string | URL, init: RequestInit = {}) => {
        const target = new URL(input.toString());
        return w.request(`${target.pathname}${target.search}`, init);
      };
      const report = await checkWebRelease({ origin: webOrigin,
        expectedWrites: writesEnabled ? "on" : "off", expectedAuthorizationOrigin: syntheticIssuer,
        fetcher });
      expect(report.passed).toBe(true);
      expect(report.checks.every((check) => check.passed)).toBe(true);
      expect(w.database.prepare("SELECT total_changes() AS n").get()).toEqual(before);
    }
  });

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
    expect(detail).not.toContain("data-complete-task");
    const open = await (await w.request(`${base}?section=tasks`, { headers })).text();
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

  it("shows rejected applications by default and preserves explicit open filtering and pagination", async () => {
    const w = await setup(); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic overview" };
    const created = w.service.createJobApplication({ company: "Rejected company", role: "Role", authority, idempotencyKey: randomUUID() });
    if (created.creationStatus !== "CREATED") throw new Error("Expected synthetic application");
    const proposal = w.service.proposeTransition({ projectId: created.project.id, expectedLifecycleVersion: 1,
      toState: "REJECTED", triggerType: "USER_ASSERTION", evidenceResourceIds: [], rationale: "Synthetic closure", idempotencyKey: randomUUID() });
    w.service.admitTransition({ transitionId: proposal.transition.id, expectedLifecycleVersion: 1, authority, idempotencyKey: randomUUID() });
    const headers = { cookie: w.sessionCookie(await w.finish(await w.start())) };
    const base = "/workspace/job-search/applications";
    const all = await (await w.request(base, { headers })).text();
    expect(all).toContain("Rejected company");
    expect(all).toContain('value="ALL" selected');
    expect(all).toContain("共 2 项");
    expect(await (await w.request(`${base}?status=OPEN`, { headers })).text()).not.toContain("Rejected company");
    expect(await (await w.request(`${base}?lifecycle=REJECTED`, { headers })).text()).toContain("Rejected company");
    const first = await (await w.request(`${base}?pageSize=1`, { headers })).text();
    const nextPath = /data-more href="([^"]+)"/u.exec(first)![1]!.replaceAll("&amp;", "&");
    expect(nextPath).toContain("status=ALL");
    expect((await w.request(nextPath, { headers })).status).toBe(200);
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

  it("completes one owned Task atomically and replays the same browser intent once", async () => {
    const w = await setup(true, "Australia/Sydney", true); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic completion setup" };
    const task = w.service.taskService.createTask({ projectId: w.projectId, title: "Complete in browser",
      taskKind: "OTHER", priority: "HIGH", authority, idempotencyKey: randomUUID() }).task;
    const cookie = w.sessionCookie(await w.finish(await w.start()));
    const session = await (await w.request("/api/v1/session", { headers: { cookie } })).json() as { csrfToken: string };
    const intentKey = randomUUID();
    const path = `/api/v1/job-search/tasks/${task.id}/complete`;
    const options = { method: "POST", headers: { cookie, origin: webOrigin, "content-type": "application/json",
      "x-csrf-token": session.csrfToken }, body: JSON.stringify({ expectedRecordVersion: 1, intentKey }) };
    const beforePage = await (await w.request(`/workspace/job-search/tasks/${task.id}`, { headers: { cookie } })).text();
    expect(beforePage).toContain("data-complete-task");

    const completed = await w.request(path, options);
    expect(completed.status).toBe(200);
    expect(await completed.json()).toMatchObject({ changed: true, replayed: false,
      task: { id: task.id, status: "DONE", recordVersion: 2, completedAt: expect.any(String) } });
    const replay = await w.request(path, options);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ changed: true, replayed: true,
      task: { id: task.id, status: "DONE", recordVersion: 2 } });

    const audits = w.database.prepare(
      "SELECT channel, authority_type, authority_reference, before_record_version, after_record_version, changed_fields_json FROM task_command_audit WHERE operation = 'workspace_update_task' AND intent_key = ?",
    ).all(intentKey) as Array<Record<string, unknown>>;
    expect(audits).toEqual([{ channel: "WEB", authority_type: "EXPLICIT_USER_WEB",
      authority_reference: `task-complete:${w.identity.principalId}:${intentKey}`,
      before_record_version: 1, after_record_version: 2, changed_fields_json: '["status"]' }]);
    expect(w.service.jobSearchQueryService.getTask(task.id)).toMatchObject({ status: "DONE", recordVersion: 2 });
    const afterPage = await (await w.request(`/workspace/job-search/tasks/${task.id}`, { headers: { cookie } })).text();
    expect(afterPage).toContain("完成时间");
    expect(afterPage).not.toContain("data-complete-task");
  });

  it("requires an authenticated same-origin CSRF-bound write and hides other owners", async () => {
    const w = await setup(true, "Australia/Sydney", true); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic write guard" };
    const task = w.service.taskService.createTask({ projectId: w.projectId, title: "Guarded browser task",
      taskKind: "OTHER", priority: "LOW", authority, idempotencyKey: randomUUID() }).task;
    const path = `/api/v1/job-search/tasks/${task.id}/complete`;
    const body = JSON.stringify({ expectedRecordVersion: 1, intentKey: randomUUID() });
    expect((await w.request(path, { method: "POST", headers: { "content-type": "application/json" }, body })).status).toBe(401);
    const cookie = w.sessionCookie(await w.finish(await w.start()));
    const session = await (await w.request("/api/v1/session", { headers: { cookie } })).json() as { csrfToken: string };
    expect((await w.request(path, { method: "POST", headers: { cookie, "content-type": "application/json",
      "x-csrf-token": session.csrfToken }, body })).status).toBe(403);
    expect((await w.request(path, { method: "POST", headers: { cookie, origin: "https://evil.example.test",
      "content-type": "application/json", "x-csrf-token": session.csrfToken }, body })).status).toBe(403);
    const headers = { cookie, origin: webOrigin, "content-type": "application/json", "x-csrf-token": session.csrfToken };
    expect((await w.request(path, { method: "POST", headers,
      body: JSON.stringify({ expectedRecordVersion: 1, intentKey: randomUUID(), confirmed: true }) })).status).toBe(422);

    const other = new WorkspaceService(w.database, { issuer: "write-other", subject: "write-other", workspaceName: "Other" });
    other.ensureDevelopmentIdentity();
    const creation = other.createJobApplication({ company: "Private", role: "Role", authority, idempotencyKey: randomUUID() });
    if (creation.creationStatus !== "CREATED") throw new Error("Expected creation");
    const privateTask = other.taskService.createTask({ projectId: creation.project.id, title: "Private task",
      taskKind: "OTHER", priority: "LOW", authority, idempotencyKey: randomUUID() }).task;
    for (const id of [privateTask.id, randomUUID()]) {
      const response = await w.request(`/api/v1/job-search/tasks/${id}/complete`, { method: "POST", headers,
        body: JSON.stringify({ expectedRecordVersion: 1, intentKey: randomUUID() }) });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "NOT_FOUND" });
    }
    expect(w.service.jobSearchQueryService.getTask(task.id).status).toBe("TODO");
  });

  it("rejects stale and changed completion intents without reopening terminal Tasks", async () => {
    const w = await setup(true, "Australia/Sydney", true); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic conflict setup" };
    const task = w.service.taskService.createTask({ projectId: w.projectId, title: "Conflict browser task",
      taskKind: "OTHER", priority: "LOW", authority, idempotencyKey: randomUUID() }).task;
    w.service.taskService.updateTask({ taskId: task.id, expectedRecordVersion: 1, status: "IN_PROGRESS",
      authority, idempotencyKey: randomUUID() });
    const cookie = w.sessionCookie(await w.finish(await w.start()));
    const session = await (await w.request("/api/v1/session", { headers: { cookie } })).json() as { csrfToken: string };
    const headers = { cookie, origin: webOrigin, "content-type": "application/json", "x-csrf-token": session.csrfToken };
    const path = `/api/v1/job-search/tasks/${task.id}/complete`;
    const stale = await w.request(path, { method: "POST", headers,
      body: JSON.stringify({ expectedRecordVersion: 1, intentKey: randomUUID() }) });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: "CONCURRENCY_CONFLICT", reloadRequired: true });

    const intentKey = randomUUID();
    expect((await w.request(path, { method: "POST", headers,
      body: JSON.stringify({ expectedRecordVersion: 2, intentKey }) })).status).toBe(200);
    const changedIntent = await w.request(path, { method: "POST", headers,
      body: JSON.stringify({ expectedRecordVersion: 3, intentKey }) });
    expect(changedIntent.status).toBe(409);
    expect(await changedIntent.json()).toEqual({ error: "IDEMPOTENCY_CONFLICT", reloadRequired: false });
    expect((await w.request(path, { method: "POST", headers,
      body: JSON.stringify({ expectedRecordVersion: 3, intentKey: randomUUID() }) })).status).toBe(422);
  });

  it("rolls back Task state and idempotency when browser audit storage fails", async () => {
    const w = await setup(true, "Australia/Sydney", true); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic rollback setup" };
    const task = w.service.taskService.createTask({ projectId: w.projectId, title: "Atomic browser task",
      taskKind: "OTHER", priority: "LOW", authority, idempotencyKey: randomUUID() }).task;
    const cookie = w.sessionCookie(await w.finish(await w.start()));
    const session = await (await w.request("/api/v1/session", { headers: { cookie } })).json() as { csrfToken: string };
    const intentKey = randomUUID();
    const options = { method: "POST", headers: { cookie, origin: webOrigin, "content-type": "application/json",
      "x-csrf-token": session.csrfToken }, body: JSON.stringify({ expectedRecordVersion: 1, intentKey }) };
    w.database.exec("CREATE TRIGGER fail_web_task_audit BEFORE INSERT ON task_command_audit WHEN NEW.channel = 'WEB' BEGIN SELECT RAISE(ABORT, 'forced audit failure'); END");
    expect((await w.request(`/api/v1/job-search/tasks/${task.id}/complete`, options)).status).toBe(503);
    expect(w.service.jobSearchQueryService.getTask(task.id)).toMatchObject({ status: "TODO", recordVersion: 1 });
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM idempotency_records WHERE operation = 'workspace_update_task' AND idempotency_key = ?").get(intentKey)).toEqual({ n: 0 });
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM task_command_audit WHERE intent_key = ?").get(intentKey)).toEqual({ n: 0 });
    w.database.exec("DROP TRIGGER fail_web_task_audit");
    expect((await w.request(`/api/v1/job-search/tasks/${task.id}/complete`, options)).status).toBe(200);
  });

  it("serves candidate reads and renders the Jobs pages with zero read writes", async () => {
    const w = await setup(); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic candidate read" };
    const { candidate } = w.service.candidateService.recordCandidate({
      provider: "seek", postingId: "seek-1", sourceUrl: "https://www.seek.com.au/job/1",
      title: "Senior Engineer", company: "Acme", role: "Senior Engineer", location: "Sydney",
      fitReason: "Matches distributed systems background", fitUncertainty: "MEDIUM",
      sourceAvailability: "AVAILABLE", authority, idempotencyKey: randomUUID(),
    });
    const headers = { cookie: w.sessionCookie(await w.finish(await w.start())) };
    const before = w.database.prepare("SELECT total_changes() AS n").get();

    const list = await (await w.request("/api/v1/job-search/candidates", { headers })).json();
    expect(list).toMatchObject({ totalCount: 1, items: [{ id: candidate.id, decision: "UNREVIEWED" }] });
    const detail = await (await w.request(`/api/v1/job-search/candidates/${candidate.id}`, { headers })).json();
    expect(detail).toMatchObject({ id: candidate.id, company: "Acme", linkedProjectId: null });

    const jobsHtml = await (await w.request("/workspace/job-search/jobs", { headers })).text();
    expect(jobsHtml).toContain("候选职位"); expect(jobsHtml).toContain("Acme"); expect(jobsHtml).toContain("Senior Engineer");
    const jobHtml = await (await w.request(`/workspace/job-search/jobs/${candidate.id}`, { headers })).text();
    expect(jobHtml).toContain("Matches distributed systems background");
    expect(jobHtml).toContain(`Candidate ${candidate.id}`);
    expect(jobHtml).not.toContain("data-decide-candidate"); // writes are off by default
    expect((await w.request(`/api/v1/job-search/candidates/${randomUUID()}`, { headers })).status).toBe(404);
    expect(w.database.prepare("SELECT total_changes() AS n").get()).toEqual(before);
  });

  it("saves a candidate through the web and replays the same intent once", async () => {
    const w = await setup(true, "Australia/Sydney", true); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic candidate setup" };
    const { candidate } = w.service.candidateService.recordCandidate({
      provider: "seek", postingId: "seek-1", sourceUrl: "https://www.seek.com.au/job/1",
      title: "Senior Engineer", company: "Acme", role: "Senior Engineer",
      authority, idempotencyKey: randomUUID(),
    });
    const cookie = w.sessionCookie(await w.finish(await w.start()));
    const session = await (await w.request("/api/v1/session", { headers: { cookie } })).json() as { csrfToken: string };
    const intentKey = randomUUID();
    const path = `/api/v1/job-search/candidates/${candidate.id}/decide`;
    const options = { method: "POST", headers: { cookie, origin: webOrigin, "content-type": "application/json",
      "x-csrf-token": session.csrfToken }, body: JSON.stringify({ action: "SAVE", expectedRecordVersion: 1, intentKey }) };

    const beforePage = await (await w.request(`/workspace/job-search/jobs/${candidate.id}`, { headers: { cookie } })).text();
    expect(beforePage).toContain("data-decide-candidate");

    const saved = await w.request(path, options);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ changed: true, replayed: false,
      candidate: { id: candidate.id, decision: "SAVED", recordVersion: 2 } });
    const replay = await w.request(path, options);
    expect(await replay.json()).toMatchObject({ changed: true, replayed: true,
      candidate: { id: candidate.id, decision: "SAVED", recordVersion: 2 } });

    expect(w.database.prepare(
      "SELECT channel, authority_type, authority_reference, action FROM candidate_decisions WHERE candidate_id = ?",
    ).all(candidate.id)).toEqual([{ channel: "WEB", authority_type: "EXPLICIT_USER_WEB",
      authority_reference: `candidate-decision:${w.identity.principalId}:${intentKey}`, action: "SAVE" }]);
    const afterPage = await (await w.request(`/workspace/job-search/jobs/${candidate.id}`, { headers: { cookie } })).text();
    expect(afterPage).toContain("已收藏");
    expect(afterPage).not.toContain('data-action="SAVE"');
  });

  it("links a candidate to an existing application through the web with CSRF and replay protection", async () => {
    const w = await setup(true, "Australia/Sydney", true); w.link();
    const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic candidate link setup" };
    const { candidate } = w.service.candidateService.recordCandidate({
      provider: "seek", postingId: "seek-1", sourceUrl: "https://www.seek.com.au/job/1",
      title: "Senior Engineer", company: "Acme", role: "Senior Engineer",
      authority, idempotencyKey: randomUUID(),
    });
    const cookie = w.sessionCookie(await w.finish(await w.start()));
    const session = await (await w.request("/api/v1/session", { headers: { cookie } })).json() as { csrfToken: string };
    const intentKey = randomUUID();
    const path = `/api/v1/job-search/candidates/${candidate.id}/link`;
    const body = JSON.stringify({ projectId: w.projectId, intentKey });

    const beforePage = await (await w.request(`/workspace/job-search/jobs/${candidate.id}`, { headers: { cookie } })).text();
    expect(beforePage).toContain("data-link-candidate"); // the seeded application is selectable
    expect((await w.request(path, { method: "POST", headers: { cookie, "content-type": "application/json",
      "x-csrf-token": session.csrfToken }, body })).status).toBe(403);

    const options = { method: "POST", headers: { cookie, origin: webOrigin, "content-type": "application/json",
      "x-csrf-token": session.csrfToken }, body };
    const linked = await w.request(path, options);
    expect(linked.status).toBe(200);
    expect(await linked.json()).toMatchObject({ changed: true, replayed: false,
      candidate: { id: candidate.id, linkedProjectId: w.projectId } });
    const replay = await w.request(path, options);
    expect(await replay.json()).toMatchObject({ changed: true, replayed: true,
      candidate: { id: candidate.id, linkedProjectId: w.projectId } });

    expect(w.database.prepare(
      "SELECT channel, authority_type, authority_reference, project_id FROM candidate_links WHERE candidate_id = ?",
    ).all(candidate.id)).toEqual([{ channel: "WEB", authority_type: "EXPLICIT_USER_WEB",
      authority_reference: `candidate-link:${w.identity.principalId}:${intentKey}`, project_id: w.projectId }]);
    const afterPage = await (await w.request(`/workspace/job-search/jobs/${candidate.id}`, { headers: { cookie } })).text();
    expect(afterPage).toContain("查看已关联申请");
    expect(afterPage).not.toContain("data-link-candidate");
  });
});


it("renders GPT-written dossiers without browser profile mutation, preserving version history", async () => {
  const w = await setup(); w.link();
  const cookie = w.sessionCookie(await w.finish(await w.start()));
  const { csrfToken } = await (await w.request("/api/v1/session", { headers: { cookie } })).json();
  const headers = { cookie, origin: webOrigin, "x-csrf-token": csrfToken, "content-type": "application/json" };
  const facts = { contractVersion: "job-application-profile-v0.1", jobDescription: "Actual JD", skillMatch: null,
    skillMatchText: "Original GPT report <script>bad()</script>", resumeVersion: "AI role v2",
    resumeText: "Actual resume", sourceReference: "Original chat" };
  for (const version of ["AI role v1", "AI role v2"]) w.service.recordObservation({ projectId: w.projectId, provider: "chatgpt", resourceType: "NOTE",
    externalId: version, externalUri: null, title: "Saved dossier", observedAt: "2026-09-07T00:00:00Z",
    idempotencyKey: randomUUID(), observedFacts: { ...facts, resumeVersion: version } });
  const before = w.database.prepare("SELECT total_changes() n").get();
  expect((await w.request(`/api/v1/application-profiles/${w.projectId}`, { method: "POST", headers, body: "{}" })).status).toBe(404);
  const html = await (await w.request(`/workspace/job-search/applications/${w.projectId}`, { headers: { cookie } })).text();
  expect(html).toContain("AI role v2"); expect(html).toContain("Original GPT report &lt;script&gt;");
  expect(html).not.toContain("<script>bad()"); expect(html).not.toContain("data-profile-form");
  expect(html).toContain("更新或补充资料请在 GPT 中操作");
  const history = await (await w.request(`/workspace/job-search/applications/${w.projectId}?section=resources`, { headers: { cookie } })).text();
  expect(history).toContain("AI role v1"); expect(history).toContain("AI role v2");
  expect(w.database.prepare("SELECT total_changes() n").get()).toEqual(before);
});

it("defaults to newest application date with undated applications last, independently of later edits", async () => {
  const w = await setup();
  w.database.prepare("UPDATE projects SET metadata_json=json_set(metadata_json,'$.appliedDate','2026-01-01'),updated_at='2099-01-01T00:00:00Z' WHERE id=?").run(w.projectId);
  const newest = randomUUID(), unknown = randomUUID();
  for (const id of [newest, unknown]) w.service.seedJobApplication({ projectId: id, initialTransitionId: randomUUID(), title: id, company: id, role: "Role" });
  w.database.prepare("UPDATE projects SET metadata_json=json_set(metadata_json,'$.appliedDate','2026-09-01') WHERE id=?").run(newest);
  const page = w.service.jobSearchQueryService.listApplications({ status: "ALL" });
  expect(page.items.map(a => a.projectId)).toEqual([newest, w.projectId, unknown]);
  expect(w.service.jobSearchQueryService.listApplications({ sort: "UPDATED_DESC" }).items[0]?.projectId).toBe(w.projectId);
});
