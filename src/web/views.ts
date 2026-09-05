import type { WorkspaceService } from "../application/workspace-service.js";
import type { ReadPage } from "../application/read-pagination.js";
import type { ApplicationListItem } from "../application/job-search-query-service.js";
import type { ResourceRecord, TaskRecord, TransitionRecord } from "../domain/types.js";

export const rootPath = "/workspace/job-search";
export const escapeHtml = (value: unknown): string => String(value ?? "").replace(/[&<>"']/gu,
  (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const e = escapeHtml;
const labels: Record<string, string> = {
  APPLIED: "已投递", RECRUITER_CONTACT: "招聘方联系", INTERVIEWING: "面试中", OFFER: "收到 Offer",
  ACCEPTED: "已接受", REJECTED: "未通过", WITHDRAWN: "已撤回", NONE: "开始",
  TODO: "待办", IN_PROGRESS: "进行中", BLOCKED: "受阻", DONE: "已完成", CANCELLED: "已取消",
  LOW: "低优先级", MEDIUM: "中优先级", HIGH: "高优先级", CRITICAL: "最高优先级",
  OVERDUE: "已逾期", DUE_TODAY: "今天到期", HIGH_PRIORITY: "高优先级", OPEN: "待处理",
  ACTIVE: "进行中", PAUSED: "已暂停", CLOSED: "已关闭", ALL: "全部",
};
const label = (value: string): string => labels[value] ?? value;
const chip = (value: string, text = label(value)): string => `<span class="chip ${["DONE", "ACCEPTED"].includes(value) ? "good" : ["OVERDUE", "BLOCKED"].includes(value) ? "warn" : ""}">${e(text)}</span>`;
const appLink = (id: string): string => `${rootPath}/applications/${encodeURIComponent(id)}`;
const taskLink = (id: string): string => `${rootPath}/tasks/${encodeURIComponent(id)}`;
function date(value: string | null, zone: string): string {
  if (!value) return "未设截止时间";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "时间不可用" : new Intl.DateTimeFormat("zh-CN", {
    timeZone: zone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(parsed);
}
const empty = (title: string, text: string): string => `<div class="empty"><span class="empty-mark" aria-hidden="true">—</span><h3>${e(title)}</h3><p>${e(text)}</p></div>`;
const option = (value: string, text: string, selected: string): string => `<option value="${e(value)}"${value === selected ? " selected" : ""}>${e(text)}</option>`;
function heading(kicker: string, title: string, description: string): string {
  return `<header class="page-heading"><div><p class="eyebrow">${e(kicker)}</p><h1>${e(title)}</h1><p class="subtitle">${e(description)}</p></div><button type="button" class="button secondary" data-refresh>刷新状态 <span aria-hidden="true">↻</span></button></header>`;
}
function freshness(asOf: string, zone: string): string {
  return `<p class="freshness">上次读取 <time datetime="${e(asOf)}">${e(date(asOf, zone))}</time><span>${e(zone)}</span></p>`;
}
function contextCopy(kind: "Application" | "Task", id: string): string {
  const text = kind === "Task" ? `请从 Personal AI Workspace 读取 Task ${id} 的最新状态、完成时间和版本，再帮我继续处理。`
    : `请从 Personal AI Workspace 读取 Application / Project ${id} 的最新状态与任务，再帮我判断下一步。`;
  return `<section class="context-box"><div><h2>带回 ChatGPT 继续</h2><p>复制这段引用到新对话，读取最新工作状态。</p></div><button type="button" class="button secondary" data-copy>复制引用</button><label class="sr-only" for="context-reference">可手动选取的上下文引用</label><textarea id="context-reference" readonly rows="3">${e(text)}</textarea></section>`;
}
function pageUrl(path: string, query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  return `${path}${params.size ? `?${params}` : ""}`;
}
function pagination<T>(page: ReadPage<T>, path: string, query: Record<string, unknown>): string {
  return `<div class="pagination" data-pagination data-total="${page.totalCount}"><p>共 ${page.totalCount} 项 · 当前显示 ${page.items.length ? page.coverage.offset + 1 : 0}–${page.coverage.loaded} 项</p>${page.nextCursor
    ? `<a class="button secondary" data-more href="${e(pageUrl(path, { ...query, cursor: page.nextCursor }))}">加载更多 <span aria-hidden="true">↓</span></a>` : `<span class="muted">已到末尾</span>`}</div>`;
}

export function document(title: string, content: string, authenticated: boolean, active = "today"): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${e(title)} · Workspace</title><link rel="stylesheet" href="/assets/workspace.css"><script type="module" src="/assets/workspace.js"></script></head><body data-authenticated="${authenticated}"><a class="skip" href="#main">跳到主要内容</a><aside class="sidebar"><a class="brand" href="${rootPath}/today"><span class="brand-mark" aria-hidden="true">w.</span><span>Workspace<small>你的持续工作空间</small></span></a><p class="nav-label">JOB SEARCH / 求职</p><nav aria-label="主要导航"><a href="${rootPath}/today"${active === "today" ? ' aria-current="page"' : ""}><span aria-hidden="true">◷</span> 今天 <small>Today</small></a><a href="${rootPath}/applications"${active === "applications" ? ' aria-current="page"' : ""}><span aria-hidden="true">▤</span> 我的申请</a></nav><div class="sidebar-foot"><span class="connection-dot" aria-hidden="true"></span>同一份工作状态<p>查看进展，然后继续下一步。</p>${authenticated ? '<button type="button" class="text-button" data-logout>退出登录</button>' : ""}</div></aside><div class="workspace"><div class="topbar"><span>个人工作空间 <span class="slash">/</span> 求职</span><span class="view-label">查看模式</span></div><div id="notice" class="notice" role="status" aria-live="polite" hidden></div><main id="main" tabindex="-1">${content}</main><footer>对话帮助你思考，Workspace 保存工作进度。</footer></div></body></html>`;
}

export function loginView(returnTo: string): string {
  return document("登录", `<div class="login-layout"><p class="eyebrow">WELCOME BACK</p><h1>从上次的进度继续。</h1><p class="subtitle">登录后查看你的申请、任务和下一步。<br>在这里与 ChatGPT 中，使用同一份工作状态。</p><a class="button primary" href="/auth/start?returnTo=${encodeURIComponent(returnTo)}">使用 Google 登录 <span aria-hidden="true">→</span></a><p class="muted">仅已关联的账户可以访问。</p></div>`, false);
}

export function errorView(status: number, returnTo: string, authenticated: boolean): string {
  const [title, text] = status === 404 ? ["找不到这条记录", "记录不存在，或当前账户无法访问。"]
    : status === 409 ? ["列表已有更新", "请重新读取列表，确保没有遗漏或重复的记录。"]
      : status === 400 ? ["无法使用这些筛选条件", "请返回列表重新选择。"] : ["暂时无法读取", "请稍后重试；此前显示的内容可能已过时。"];
  return document(title!, `${heading("WORKSPACE", title!, text!)}<a class="button primary" href="${e(returnTo)}">重新读取</a>`, authenticated, "applications");
}

export function loginFailureView(status: number, returnTo = `${rootPath}/today`, pendingId?: string): string {
  const title = status === 403 ? "此账户尚未关联工作空间" : status === 429 ? "登录尝试过于频繁" : "未能完成登录";
  const description = status === 403 ? "请使用已关联的 Google 账户；账户关联需要由本地管理员完成。"
    : status === 429 ? "请稍等一分钟后重试。" : "登录已取消、过期或暂时不可用，请重新开始。";
  return document("登录", `<div class="login-layout"><p class="eyebrow">WORKSPACE / 登录</p><h1>${title}</h1><p class="subtitle">${description}</p>${pendingId ? `<p class="muted">待关联编号：${e(pendingId)}</p>` : ""}<a class="button primary" href="/auth/start?returnTo=${encodeURIComponent(returnTo)}">重新登录</a></div>`, false);
}

export function todayView(service: WorkspaceService, asOf: string): string {
  const today = service.todayQueryService.getToday();
  const zone = today.timeZone;
  function item(task: { taskId: string; title: string; company: string; role: string; dueAt: string | null; reasons?: string[] }): string {
    return `<article class="task-row"><div class="task-symbol" aria-hidden="true">↗</div><div class="grow"><p class="overline">${e(task.company)} · ${e(task.role)}</p><h3><a href="${taskLink(task.taskId)}">${e(task.title)}</a></h3><div class="chips">${(task.reasons ?? []).map((reason) => chip(reason)).join("")}</div></div><span class="due">${e(date(task.dueAt, zone))}</span></article>`;
  }
  return document("今天", `${heading("TODAY / 今天", "把注意力放在下一步", "先处理需要关注的事项，再安排接下来的工作。")}${freshness(asOf, zone)}<div class="stat-grid"><div class="stat"><span>需要关注</span><strong>${today.attention.length.toString().padStart(2, "0")}</strong><small>任务按既定规则呈现</small></div><div class="stat"><span>即将到来</span><strong>${today.upcoming.length.toString().padStart(2, "0")}</strong><small>未来 7 个本地日历日</small></div><div class="stat"><span>可检查下一步</span><strong>${today.applicationsWithoutOpenTask.length.toString().padStart(2, "0")}</strong><small>进行中的申请，尚无开放任务</small></div></div><div class="two-column"><div><section class="panel"><header class="section-heading"><h2>需要关注</h2><span class="count">${today.attention.length}</span></header>${today.attention.map(item).join("") || empty("暂无需要关注的任务", "有新的到期、受阻或高优先级任务时，会在这里出现。")}</section><section class="panel"><header class="section-heading"><h2>即将到来</h2><span class="muted">未来 7 天</span></header>${today.upcoming.map(item).join("") || empty("近期没有已排期任务", "未设截止时间的任务不会被自动排入日程。")}</section></div><aside class="panel quiet"><header class="section-heading"><h2>检查下一步</h2></header><p class="section-intro">这些申请尚无开放任务。可以检查进展；这不代表已逾期。</p>${today.applicationsWithoutOpenTask.map((app) => `<a class="gap-row" href="${appLink(app.projectId)}"><span><strong>${e(app.company)}</strong><small>${e(app.role)}</small></span><span aria-hidden="true">↗</span></a>`).join("") || empty("每个申请都有下一步", "当前没有需要检查的任务空缺。")}</aside></div>${today.recentLifecycleChanges.length ? `<section class="panel"><header class="section-heading"><h2>最近确认的进展</h2><span class="muted">最多 5 条</span></header>${today.recentLifecycleChanges.map((event) => `<div class="history-row"><div class="grow"><a href="${appLink(event.projectId)}">${e(event.company)} · ${e(event.role)}</a><p>${e(label(event.fromState))} → ${e(label(event.toState))}</p></div><time>${e(date(event.admittedAt, zone))}</time></div>`).join("")}</section>` : ""}`, true);
}

export function applicationListView(service: WorkspaceService, query: Record<string, string | number>, zone: string): string {
  const page = service.jobSearchQueryService.listApplications(query);
  const status = String(query.status ?? "OPEN"), sort = String(query.sort ?? "UPDATED_DESC");
  const rows = page.items.map((app: ApplicationListItem) => `<article class="application-row"><div class="grow"><p class="overline">${e(app.company)}${app.location ? ` · ${e(app.location)}` : ""}</p><h2><a href="${appLink(app.projectId)}">${e(app.role)}</a></h2><p class="next-action">${app.nextDueTask ? `下一项：<a href="${taskLink(app.nextDueTask.id)}">${e(app.nextDueTask.title)}</a>` : app.openTaskCount ? "有开放任务，尚未设截止时间" : "尚无开放任务"}</p></div><div class="row-status">${chip(app.lifecycleState)}<span class="muted">${app.openTaskCount} 项开放任务</span>${app.nextDueTask ? `<time>${e(date(app.nextDueTask.dueAt, zone))}</time>` : ""}</div></article>`).join("");
  return document("我的申请", `${heading("APPLICATIONS / 我的申请", "每份申请，都有后续", "查看已确认的进展、待办和保留下来的工作记录。")}${freshness(page.asOf, zone)}<form class="filters" method="get" data-filter-form><label class="search-label">搜索公司或职位<input type="search" name="q" value="${e(query.q ?? "")}" placeholder="公司、职位关键词" maxlength="500"></label><label>申请范围<select name="status">${["OPEN", "CLOSED", "ALL"].map((x) => option(x, x === "OPEN" ? "进行中与暂停" : label(x), status)).join("")}</select></label><label>进展<select name="lifecycle">${option("", "全部进展", String(query.lifecycle ?? ""))}${["APPLIED", "RECRUITER_CONTACT", "INTERVIEWING", "OFFER", "ACCEPTED", "REJECTED", "WITHDRAWN"].map((x) => option(x, label(x), String(query.lifecycle ?? ""))).join("")}</select></label><label>排序<select name="sort">${option("UPDATED_DESC", "最近更新", sort)}${option("COMPANY_ASC", "公司名称", sort)}${option("NEXT_DUE_ASC", "最近截止", sort)}</select></label><button class="button primary" type="submit">应用筛选</button></form><section class="panel"><header class="section-heading"><h2>申请记录 <span class="count">${page.totalCount}</span></h2><a class="text-link" href="${rootPath}/applications?status=ALL">查看全部</a></header><div data-page-items>${rows || empty(query.q || query.lifecycle ? "没有匹配的申请" : "当前范围没有申请", "尝试调整筛选，或在 ChatGPT 中记录实际投递。")}</div>${pagination(page, `${rootPath}/applications`, query)}</section>`, true, "applications");
}

function taskRow(task: TaskRecord, zone: string): string {
  return `<article class="task-row"><span class="task-symbol ${task.status === "DONE" ? "complete" : ""}" aria-hidden="true">${task.status === "DONE" ? "✓" : "↗"}</span><div class="grow"><h3><a href="${taskLink(task.id)}">${e(task.title)}</a></h3><p class="muted">${e(label(task.priority))} · ${task.completedAt ? `完成于 ${e(date(task.completedAt, zone))}` : e(date(task.dueAt, zone))}</p></div>${chip(task.status)}</article>`;
}
function historyRow(event: TransitionRecord, zone: string): string {
  return `<article class="history-row"><div class="timeline-dot" aria-hidden="true"></div><div class="grow"><span class="overline">${event.status === "ADMITTED" ? "已确认变更" : event.status === "PROPOSED" ? "建议 · 尚未确认" : "未采纳建议"}</span><h3>${e(label(event.fromState))} → ${e(label(event.toState))}</h3>${event.proposalRationale ? `<p>${e(event.proposalRationale)}</p>` : ""}<small class="muted">${event.evidenceResourceIds.length} 条关联证据</small></div><time>${e(date(event.admittedAt ?? event.proposedAt, zone))}</time></article>`;
}
function safeExternalUrl(value: string | null): string | null {
  try { const url = new URL(value ?? ""); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function resourceRow(resource: ResourceRecord, zone: string): string {
  const facts = resource.observedFacts.sourceFacts;
  const summary = facts && typeof facts === "object" && !Array.isArray(facts) && typeof facts.summary === "string" ? facts.summary : null;
  const interpretation = resource.observedFacts.interpretation;
  const explanation = interpretation && typeof interpretation === "object" && !Array.isArray(interpretation) ? interpretation : {};
  const meaning = typeof explanation.summary === "string" ? explanation.summary
    : typeof explanation.proposedMeaning === "string" ? explanation.proposedMeaning : null;
  const source = facts && typeof facts === "object" && !Array.isArray(facts) ? facts : {};
  const provenance = resource.observedFacts.contractVersion === "gmail-job-observation-v0.1"
    ? `<p class="muted">${typeof source.senderDomain === "string" ? `来源域名 ${e(source.senderDomain)} · ` : ""}${typeof source.receivedAt === "string" ? `收到于 ${e(date(source.receivedAt, zone))}` : ""}</p>` : "";
  const url = safeExternalUrl(resource.externalUri);
  return `<article class="evidence-row"><p class="overline">来源观察 · ${e(resource.provider)}</p><h3>${e(resource.title ?? "来源记录")}</h3>${provenance}${summary ? `<p>${e(summary)}</p>` : ""}${meaning ? `<p class="advisory">建议 / 推断：${e(meaning)}<br><small>解读摘要，不代表已确认的申请进展。</small></p>` : ""}<div class="evidence-foot"><span>观察于 ${e(date(resource.observedAt, zone))}</span>${url ? `<a class="text-link" href="${e(url)}" target="_blank" rel="noopener noreferrer">打开来源 ↗</a>` : "<span>来源链接不可用</span>"}</div></article>`;
}

export function applicationView(service: WorkspaceService, id: string, query: Record<string, string | number>, zone: string): string {
  const detail = service.jobSearchQueryService.getApplication(id);
  const p = detail.project;
  const section = String(query.section ?? "tasks");
  const paging = { ...(query.cursor ? { cursor: query.cursor } : {}), ...(query.pageSize ? { pageSize: query.pageSize } : {}) };
  let page: ReadPage<unknown>, rows: string, filters = "";
  const status = String(query.status ?? (section === "history" ? "ADMITTED" : "OPEN"));
  if (section === "resources") {
    const result = service.jobSearchQueryService.listResources(id, paging); page = result;
    rows = result.items.map((r) => resourceRow(r, zone)).join("");
  } else if (section === "history") {
    const result = service.jobSearchQueryService.listHistory(id, { ...paging, status }); page = result;
    rows = result.items.map((r) => historyRow(r, zone)).join("");
    filters = `<label>记录类型<select name="status">${[["ADMITTED", "已确认变更"], ["PROPOSED", "尚未确认的建议"], ["REJECTED", "未采纳建议"], ["ALL", "全部记录"]].map(([v, t]) => option(v!, t!, status)).join("")}</select></label>`;
  } else {
    const result = service.jobSearchQueryService.listTasks(id, { ...paging, status }); page = result;
    rows = result.items.map((r) => taskRow(r, zone)).join("");
    filters = `<label>任务范围<select name="status">${["OPEN", "DONE", "CANCELLED", "ALL"].map((x) => option(x, label(x), status)).join("")}</select></label>`;
  }
  const tabs = [["tasks", "任务"], ["resources", "证据"], ["history", "进展记录"]].map(([key, text]) => `<a href="${appLink(id)}?section=${key}"${section === key ? ' aria-current="page"' : ""}>${text}</a>`).join("");
  const posting = safeExternalUrl(typeof p.metadata.postingReference === "string" ? p.metadata.postingReference : null);
  return document("申请详情", `<a class="back-link" href="${rootPath}/applications">← 我的申请</a>${heading(String(p.metadata.company ?? "申请详情"), String(p.metadata.role ?? p.title), typeof p.metadata.location === "string" ? p.metadata.location : "当前已确认的申请状态")}${freshness(detail.asOf, zone)}<div class="detail-summary"><div>${chip(p.lifecycleState)} ${chip(p.status)}<p class="muted">当前申请进展</p></div><div><strong>${detail.totalCounts.openTasks}</strong><p>开放任务</p></div><div><strong>${detail.totalCounts.completedTasks}</strong><p>已完成任务</p></div>${posting ? `<a class="button secondary" target="_blank" rel="noopener noreferrer" href="${e(posting)}">查看职位来源 ↗</a>` : ""}</div><section class="panel"><nav class="tabs" aria-label="申请详情分区">${tabs}</nav>${filters ? `<form method="get" class="collection-filters" data-filter-form><input type="hidden" name="section" value="${e(section)}">${filters}<button type="submit" class="button secondary">查看</button></form>` : ""}${section === "history" ? '<p class="section-intro">只呈现实际记录的变更与建议；不补全跳过的阶段，也不代表全部编辑历史。</p>' : ""}<div data-page-items>${rows || empty("这个范围暂无记录", "可以切换范围，查看其他已保存的工作记录。")}</div>${pagination(page, appLink(id), { ...query, section, ...(section !== "resources" ? { status } : {}) })}</section>${contextCopy("Application", id)}`, true, "applications");
}

export function taskView(service: WorkspaceService, id: string, zone: string, asOf: string): string {
  const task = service.jobSearchQueryService.getTask(id);
  const { project } = service.jobSearchQueryService.getApplication(task.projectId);
  return document("任务详情", `<a class="back-link" href="${appLink(task.projectId)}">← ${e(project.metadata.company)} · ${e(project.metadata.role)}</a>${heading("TASK / 任务", task.title, "任务状态来自 Workspace 的最新记录。")}${freshness(asOf, zone)}<section class="panel task-detail"><div class="chips">${chip(task.status)}${chip(task.priority)}</div><dl class="facts"><div><dt>截止时间</dt><dd>${e(date(task.dueAt, zone))}</dd></div><div><dt>完成时间</dt><dd>${task.completedAt ? e(date(task.completedAt, zone)) : "尚无完成记录"}</dd></div><div><dt>最近更新</dt><dd>${e(date(task.updatedAt, zone))}</dd></div></dl><p class="section-intro">${task.status === "DONE" || task.status === "CANCELLED" ? "这项任务已结束。如需继续同类工作，请在 ChatGPT 中创建新任务。" : "当前可查看任务；需要调整或完成时，可带回 ChatGPT 继续。"}</p></section>${contextCopy("Task", id)}`, true, "applications");
}
