// Local UI fixture only. Not imported or emitted by the production build.
// No database/account arguments: always starts with new synthetic in-memory data.
import express from "express";
import { randomUUID } from "node:crypto";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";
import { createJobSearchPageRouter, createWebAssetsRouter } from "../../src/web/page-router.js";
import { verifiedRequestContext } from "../../src/application/request-context.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { errorView, loginView, rootPath } from "../../src/web/views.js";

const now = Date.now();
const w = createEmptyTestWorkspace({ timeZone: "Australia/Sydney", clock: () => new Date(now) });
const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Local synthetic visual fixture" };
const names = ["示例 · Northstar Studio", "示例 · Paperplane", "示例 · Common Ground", "示例 · Fieldwork", "示例 · Quiet Labs"];
let firstProject = "";
let completedTask = "";
for (let i = 0; i < 28; i++) {
  const result = w.service.createJobApplication({ company: names[i % names.length]!,
    role: ["Product Designer", "产品经理 · AI Workspace", "Software Engineer"][i % 3]! + (i >= 5 ? ` · 示例 ${i + 1}` : ""),
    location: "Sydney · Hybrid", authority, idempotencyKey: randomUUID() });
  if (result.creationStatus !== "CREATED") throw new Error("Expected synthetic creation");
  if (i === 0) firstProject = result.project.id;
  if (i > 3) continue;
  const task = w.service.taskService.createTask({ projectId: result.project.id,
    title: ["回复招聘邮件，确认面试安排", "整理作品集中的项目复盘", "准备下一轮产品案例面试", "跟进申请，询问招聘进展"][i]!,
    taskKind: "OTHER", priority: i === 0 ? "HIGH" : "MEDIUM",
    dueAt: new Date(now + (i - 1) * 86400000).toISOString(), authority, idempotencyKey: randomUUID() }).task;
  if (i === 0) {
    const completed = w.service.taskService.createTask({ projectId: result.project.id, title: "发送简历与作品集",
      taskKind: "OTHER", priority: "MEDIUM", authority, idempotencyKey: randomUUID() }).task;
    completedTask = completed.id;
    w.service.taskService.updateTask({ taskId: completed.id, expectedRecordVersion: 1, status: "DONE", authority, idempotencyKey: randomUUID() });
    w.service.recordObservation({ projectId: result.project.id, resourceType: "NOTE", provider: "synthetic", externalId: null,
      title: "招聘沟通摘要（合成示例）", externalUri: "https://example.test/job", observedAt: new Date(now).toISOString(),
      observedFacts: { sourceFacts: { summary: "已收到面试邀请，等待确认具体时间。" },
        interpretation: { proposedMeaning: "可在确认时间后准备面试材料；这条建议尚未改变申请进展。" } },
      idempotencyKey: randomUUID() });
  }
  if (i === 3) w.service.taskService.updateTask({ taskId: task.id, expectedRecordVersion: 1,
    status: "BLOCKED", authority, idempotencyKey: randomUUID() });
}
const app = express();
// Operator-only fault injection through this local process's stdin, never HTTP.
let fault = "normal";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (input: string) => {
  const command = input.trim();
  if (command === "quit") { stop(); return; }
  if (["normal", "unavailable", "expired"].includes(command)) {
    fault = command;
    console.log(`Synthetic fixture state: ${fault}`);
  }
});
app.use((_request, response, next) => {
  response.set({ "Cache-Control": "no-store", "X-Synthetic-Preview": "true",
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" });
  next();
});
app.get("/auth/start", (_request, response) => response.type("html").send(loginView(`${rootPath}/today`)));
app.get("/api/v1/session", (_request, response) => response.status(fault === "expired" ? 401 : 200).json({ authenticated: fault !== "expired" }));
app.use(createWebAssetsRouter());
app.use((request, response, next) => {
  if (fault === "normal") { next(); return; }
  response.status(fault === "expired" ? 401 : 503).type("html").send(fault === "expired"
    ? loginView(request.path) : errorView(503, request.path, true));
});
app.use(createJobSearchPageRouter(() => new WorkspaceService(w.database,
  verifiedRequestContext(w.database, w.identity, "WEB", randomUUID()), { timeZone: "Australia/Sydney", clock: () => new Date(now) }), "Australia/Sydney", () => now));
const server = app.listen(4173, "127.0.0.1", (error?: Error) => {
  if (error) { w.cleanup(); console.error(error.message); process.exit(1); }
  console.log(JSON.stringify({ syntheticOnly: true, today: `http://127.0.0.1:4173${rootPath}/today`,
    application: `${rootPath}/applications/${firstProject}`, completedTask: `${rootPath}/tasks/${completedTask}` }));
});
const stop = () => server.close(() => { w.cleanup(); process.exit(0); });
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
