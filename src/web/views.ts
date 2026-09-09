import type { WorkspaceService } from "../application/workspace-service.js";
import { gmailCheckPrompt, gmailCheckSchema } from "../domain/gmail-check.js";
import { applicationProfileSchema } from "../domain/application-profile.js";
import { applicationResumeSchema, isResumeFileUrl, type ApplicationResume } from "../domain/application-resume.js";
import { isOngoingApplication } from "../domain/job-application-lifecycle.js";
import type { ReadPage } from "../application/read-pagination.js";
import type { ApplicationListItem } from "../application/job-search-query-service.js";
import type { JobCandidateRecord, ResourceRecord, TaskRecord, TransitionRecord } from "../domain/types.js";

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
  UNREVIEWED: "待考虑", SAVED: "已收藏", DISMISSED: "已忽略",
};
const label = (value: string): string => labels[value] ?? value;
const chip = (value: string, text = label(value)): string => `<span class="chip ${["DONE", "ACCEPTED"].includes(value) ? "good" : ["OVERDUE", "BLOCKED"].includes(value) ? "warn" : ""}">${e(text)}</span>`;
const appLink = (id: string): string => `${rootPath}/applications/${encodeURIComponent(id)}`;
const taskLink = (id: string): string => `${rootPath}/tasks/${encodeURIComponent(id)}`;
const candidateLink = (id: string): string => `${rootPath}/jobs/${encodeURIComponent(id)}`;
const applicationDate = (value: unknown): string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)
  ? value : "尚未记录";
const timelineDate = (value: string, zone: string): string => /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value
  : new Intl.DateTimeFormat("zh-CN", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const fitUncertaintyLabel = (value: string): string => ({ LOW: "低不确定性", MEDIUM: "中等不确定性", HIGH: "高不确定性", UNKNOWN: "不确定性未知" })[value] ?? value;
const sourceAvailabilityLabel = (value: string): string => ({ AVAILABLE: "来源可用", UNAVAILABLE: "来源已失效", UNKNOWN: "来源状态未知" })[value] ?? value;
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
function contextCopy(kind: "Application" | "Task" | "Candidate", id: string): string {
  const text = kind === "Task" ? `请从 Personal AI Workspace 读取 Task ${id} 的最新状态、完成时间和版本。按我接下来的要求处理，确认并保存后只告诉我结果。`
    : kind === "Candidate" ? `请从 Personal AI Workspace 读取 Candidate ${id} 的最新决策、来源与关联申请。按我接下来的要求处理，确认并保存后只告诉我结果。`
      : `请从 Personal AI Workspace 读取 Application / Project ${id} 的最新申请状态和待办任务。按我接下来的要求处理，确认并保存后只告诉我结果。`;
  return `<details class="context-handoff"><summary>在 ChatGPT 中处理</summary><section class="context-box"><div><h2>复制到 ChatGPT</h2><p>在对话中说明要更新的内容。保存后切回此页，会自动读取最新结果。</p></div><button type="button" class="button secondary" data-copy>复制引用</button><label class="sr-only" for="context-reference">可手动选取的上下文引用</label><textarea id="context-reference" readonly rows="3">${e(text)}</textarea></section></details>`;
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
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${e(title)} · Workspace</title><link rel="stylesheet" href="/assets/workspace.css"><script type="module" src="/assets/workspace.js"></script></head><body data-authenticated="${authenticated}"><a class="skip" href="#main">跳到主要内容</a><aside class="sidebar"><a class="brand" href="${rootPath}/today"><span class="brand-mark" aria-hidden="true">w.</span><span>Workspace<small>你的持续工作空间</small></span></a><p class="nav-label">JOB SEARCH / 求职</p><nav aria-label="主要导航"><a href="${rootPath}/today"${active === "today" ? ' aria-current="page"' : ""}><span aria-hidden="true">◷</span> 今天 <small>Today</small></a><a href="${rootPath}/jobs"${active === "jobs" ? ' aria-current="page"' : ""}><span aria-hidden="true">◇</span> 职位 <small>Jobs</small></a><a href="${rootPath}/applications"${active === "applications" ? ' aria-current="page"' : ""}><span aria-hidden="true">▤</span> 我的申请</a></nav><div class="sidebar-foot"><span class="connection-dot" aria-hidden="true"></span>同一份工作状态<p>查看进展，然后继续下一步。</p>${authenticated ? '<button type="button" class="text-button" data-logout>退出登录</button>' : ""}</div></aside><div class="workspace"><div class="topbar"><span>个人工作空间 <span class="slash">/</span> 求职</span><span class="view-label">查看模式</span></div><div id="notice" class="notice" role="status" aria-live="polite" hidden></div><main id="main" tabindex="-1">${content}</main><footer>对话帮助你思考，Workspace 保存工作进度。</footer></div></body></html>`;
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
  return document("今天", `${heading("TODAY / 今天", "把注意力放在下一步", "先处理需要关注的事项，再安排接下来的工作。")}${freshness(asOf, zone)}${mailScanPanel(service, zone)}<div class="stat-grid"><div class="stat"><span>需要关注</span><strong>${today.attention.length.toString().padStart(2, "0")}</strong><small>任务按既定规则呈现</small></div><div class="stat"><span>即将到来</span><strong>${today.upcoming.length.toString().padStart(2, "0")}</strong><small>未来 7 个本地日历日</small></div><div class="stat"><span>可检查下一步</span><strong>${today.applicationsWithoutOpenTask.length.toString().padStart(2, "0")}</strong><small>进行中的申请，尚无开放任务</small></div></div><div class="two-column"><div><section class="panel"><header class="section-heading"><h2>需要关注</h2><span class="count">${today.attention.length}</span></header>${today.attention.map(item).join("") || empty("暂无需要关注的任务", "有新的到期、受阻或高优先级任务时，会在这里出现。")}</section><section class="panel"><header class="section-heading"><h2>即将到来</h2><span class="muted">未来 7 天</span></header>${today.upcoming.map(item).join("") || empty("近期没有已排期任务", "未设截止时间的任务不会被自动排入日程。")}</section></div><aside class="panel quiet"><header class="section-heading"><h2>检查下一步</h2></header><p class="section-intro">这些申请尚无开放任务。可以检查进展；这不代表已逾期。</p>${today.applicationsWithoutOpenTask.map((app) => `<a class="gap-row" href="${appLink(app.projectId)}"><span><strong>${e(app.company)}</strong><small>${e(app.role)}</small></span><span aria-hidden="true">↗</span></a>`).join("") || empty("每个申请都有下一步", "当前没有需要检查的任务空缺。")}</aside></div>${today.recentLifecycleChanges.length ? `<section class="panel"><header class="section-heading"><h2>最近确认的进展</h2><span class="muted">最多 5 条</span></header>${today.recentLifecycleChanges.map((event) => `<div class="history-row"><div class="grow"><a href="${appLink(event.projectId)}">${e(event.company)} · ${e(event.role)}</a><p>${e(label(event.fromState))} → ${e(label(event.toState))}</p></div><time>${e(date(event.admittedAt, zone))}</time></div>`).join("")}</section>` : ""}`, true);
}

export function mailScanPanel(service: WorkspaceService, zone: string): string {
  const data = service.mailScanService.overview();
  const processing = service.mailBatchService.progress();
  const manual = service.manualMailService.recent();
  const names: Record<string, string> = { RUNNING: "未收到完成回执", COMPLETE: "两邮箱检查完成", PARTIAL: "检查不完整", FAILED: "检查失败" };
  const manualNames: Record<string, string> = { UPDATED: "已保存新邮件证据", NO_UPDATE: "范围内暂无新增证据", PARTIAL: "补查不完整", FAILED: "补查失败" };
  const mailboxNames: Record<string, string> = { COMPLETE: "检查及写入完成", PARTIAL: "部分完成", FAILED: "未完成" };
  const origins: Record<string, string> = { SCHEDULED: "定时执行（GPT 回报）", MANUAL: "手动执行", UNKNOWN: "执行来源待确认" };
  const latest = data.runs[0], lastManual = manual[0];
  const manualStatus = (run: typeof manual[number]) => run.interrupted ? "检查已中断，可重试" : run.state === "RUNNING" ? "正在补查" : manualNames[run.outcome ?? "PARTIAL"]!;
  const stamp = (value: string) => `<time datetime="${e(value)}">${e(date(value, zone))}</time>`;
  const readableScope = (scope: string) => e(scope).replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/gu, value => stamp(value));
  const badge = (text: string, warn: boolean, good = false) => `<span class="chip ${warn ? "warn" : good ? "good" : ""}">${e(text)}</span>`;
  return `<section class="mail-updates" aria-label="邮件更新"><header class="mail-updates-heading"><h2>邮件更新</h2><span class="muted">最近检查结果</span></header><div class="mail-update-grid">
    <details class="mail-update-card"><summary><span class="mail-update-title">每日邮件扫描</span>${badge(latest ? names[latest.status]! : "尚无记录", !!latest && latest.status !== "COMPLETE", latest?.status === "COMPLETE")}<span class="mail-update-time">${latest ? `最近检查 ${stamp(latest.startedAt)}` : "尚无每日扫描回执"}</span><span class="mail-update-toggle"><span class="when-closed">查看详情</span><span class="when-open">收起详情</span><span aria-hidden="true">⌄</span></span></summary>
      <div class="mail-update-body">
        <p class="mail-update-note">${latest ? `${e(origins[latest.triggerType])} · ${latest.finishedAt ? `结束于 ${stamp(latest.finishedAt)}` : "尚未收到结束时间"}` : "尚无每日扫描回执，不能据此判断邮箱没有更新。"}</p>
        ${latest?.searchPolicy ? `<p class="mail-update-note">仅检查主题关键词、申请公司或已关联发件人匹配的求职邮件；日常 24 小时，补查最多 72 小时。未命中邮件不计作全文审阅。</p>` : ""}
        ${latest?.executionReference ? `<p class="mail-update-note">执行来源：${e(latest.executionReference)}</p>` : ""}
        ${data.unfinishedCount ? `<p class="advisory">${data.unfinishedCount} 次扫描尚未提交完成回执，可能仍在运行或已中断。</p>` : ""}
        ${latest?.ledger?.liveness === "EXPIRED" ? `<p class="advisory">本次扫描已超过活动期限，处理尚未完成。下次获授权的扫描将保留旧回执并继续待处理邮件。</p>` : ""}
        ${latest?.ledger?.unresolvedActions ? `<p class="advisory">本次有 ${latest.ledger.unresolvedActions} 项邮件处理操作尚未成功，不能据此判断相关邮件处理完成。</p>` : ""}
        <div class="mail-mailboxes">${["mailbox-1", "mailbox-2"].map((key, i) => {
          const checkpoint = data.checkpoints.find(c => c.mailbox === key);
          const result = latest?.mailboxes.find(m => m.mailbox === key);
          return `<article class="mail-mailbox"><h3>邮箱 ${i + 1}</h3><p>${result ? e(mailboxNames[result.status]) : "尚无检查结果"}</p><p class="muted">最近成功覆盖至：${checkpoint ? stamp(checkpoint.coveredThrough) : "尚未记录"}</p>${result?.searchedFrom ? `<p class="muted">搜索起点：${stamp(result.searchedFrom)}</p>` : ""}${result?.failureReason ? `<details class="mail-technical"><summary>未完成原因</summary><p>${e(result.failureReason)}</p></details>` : ""}</article>`;
        }).join("")}</div>
        ${processing.streams.length ? `<details class="mail-technical"><summary>可恢复的邮件处理进度</summary><p class="muted">以下数量仅包含当前批次，不代表邮箱全部剩余邮件。</p>${processing.streams.map(s => `<p>邮箱 ${s.mailbox === "mailbox-1" ? "1" : "2"} · ${s.lane === "RECENT" ? "近期检查" : latest?.searchPolicy ? "历史补查已停用" : "一周内补查"}：${s.coveredThrough === s.startedFrom ? "尚无完整批次" : `已处理至 ${stamp(s.coveredThrough)}`} · 本批待处理 ${s.pendingMessages} 封${s.blockedMessages ? ` · 读取受阻 ${s.blockedMessages} 封` : ""}${s.backfillComplete && !latest?.searchPolicy ? " · 一周内补查完成" : ""}${s.excludedBefore ? ` · ${stamp(s.excludedBefore)} 之前不在当前检查范围` : ""}</p>`).join("")}</details>` : ""}
        ${latest?.counts ? `<p class="mail-update-note">本次已核对写入：${latest.counts.applications} 条新申请 · ${latest.counts.evidence} 条邮件证据 · ${latest.counts.transitions} 次状态变化 · ${latest.counts.tasks} 项待办</p>` : ""}
        ${data.runs.length > 1 ? `<details class="mail-technical"><summary>最近 ${data.runs.length} 次回执</summary>${data.runs.map(r => `<article class="mail-history-item"><p>${stamp(r.startedAt)} · ${e(names[r.status])} · ${e(origins[r.triggerType])}</p>${r.searchPolicy ? `<p>求职条件匹配范围</p>` : ""}${r.counts ? `<p>申请 ${r.counts.applications} · 证据 ${r.counts.evidence} · 状态变化 ${r.counts.transitions} · 待办 ${r.counts.tasks}</p>` : ""}${r.mailboxes.filter(m => m.failureReason).map(m => `<p>邮箱 ${m.mailbox === "mailbox-1" ? "1" : "2"}：${e(m.failureReason)}</p>`).join("")}</article>`).join("")}</details>` : ""}
        <p class="mail-update-note">失败邮箱保留上次成功进度；以上不代表已扫描全部历史邮件。</p>
      </div>
    </details>
    <details class="mail-update-card"><summary><span class="mail-update-title">网页按需补查</span>${badge(lastManual ? manualStatus(lastManual) : "尚未补查", !!lastManual && (lastManual.interrupted || ["PARTIAL", "FAILED"].includes(lastManual.outcome ?? "")), !!lastManual && !lastManual.interrupted && ["UPDATED", "NO_UPDATE"].includes(lastManual.outcome ?? ""))}<span class="mail-update-time">${lastManual ? `最近检查 ${stamp(new Date(lastManual.startedAt).toISOString())}` : "有新邮件时，可在申请页面发起"}</span><span class="mail-update-toggle"><span class="when-closed">查看详情</span><span class="when-open">收起详情</span><span aria-hidden="true">⌄</span></span></summary>
      <div class="mail-update-body"><p class="mail-update-note">仅检查已有申请的相关邮件，不代表每日全邮箱扫描完成。页面刷新仅重新读取数据库。</p>${manual.map(r => `<article class="mail-history-item"><div class="mail-history-heading"><p>${stamp(new Date(r.startedAt).toISOString())} · ${e(manualStatus(r))}</p><a class="text-link" href="${appLink(r.projectId)}">查看申请 ↗</a></div>${r.scope.map(scope => `<p class="muted">${readableScope(scope)}</p>`).join("")}</article>`).join("") || `<a class="text-link" href="${rootPath}/applications">前往我的申请 ↗</a>`}</div>
    </details>
  </div></section>`;
}

export function applicationListView(service: WorkspaceService, query: Record<string, string | number>, zone: string, gmailEnabled = false): string {
  const bulk = gmailEnabled ? `<section class="panel" data-gmail-batch><button type="button" class="button primary" data-gmail-check-all>补查进行中岗位的新邮件</button><p>只补查进行中的申请，已拒绝或已结束的岗位停止追踪。按公司或岗位关键词搜索，只读取主题和摘要。首次检查最近两天，之后接续补查，最多回看七天。保存有依据的邮件摘要，不自动更改申请状态或待办。</p><p data-gmail-batch-status role="status"></p><div data-gmail-batch-results></div></section>` : "";
  query = { ...query, status: query.status ?? "ALL" };
  const page = service.jobSearchQueryService.listApplications(query);
  const status = String(query.status), sort = String(query.sort ?? "APPLIED_DESC");
  const rows = page.items.map((app: ApplicationListItem) => `<article class="application-row"><div class="grow"><p class="overline">${e(app.company)}${app.location ? ` · ${e(app.location)}` : ""}</p><h2><a href="${appLink(app.projectId)}">${e(app.role)}</a></h2><p class="muted">申请日期：${e(applicationDate(app.appliedDate))}</p><p class="next-action">${app.nextDueTask ? `下一项：<a href="${taskLink(app.nextDueTask.id)}">${e(app.nextDueTask.title)}</a>` : app.openTaskCount ? "有开放任务，尚未设截止时间" : "尚无开放任务"}</p></div><div class="row-status">${chip(app.lifecycleState)}<span class="muted">${app.openTaskCount} 项开放任务</span>${app.nextDueTask ? `<time>${e(date(app.nextDueTask.dueAt, zone))}</time>` : ""}</div></article>`).join("");
  return document("我的申请", `${bulk}${heading("APPLICATIONS / 我的申请", "每份申请，都有后续", "查看已确认的进展、待办和保留下来的工作记录。")}${freshness(page.asOf, zone)}${mailScanPanel(service, zone)}<form class="filters" method="get" data-filter-form><label class="search-label">搜索公司或职位<input type="search" name="q" value="${e(query.q ?? "")}" placeholder="公司、职位关键词" maxlength="500"></label><label>申请范围<select name="status">${["OPEN", "CLOSED", "ALL"].map((x) => option(x, x === "OPEN" ? "进行中与暂停" : label(x), status)).join("")}</select></label><label>进展<select name="lifecycle">${option("", "全部进展", String(query.lifecycle ?? ""))}${["APPLIED", "RECRUITER_CONTACT", "INTERVIEWING", "OFFER", "ACCEPTED", "REJECTED", "WITHDRAWN"].map((x) => option(x, label(x), String(query.lifecycle ?? ""))).join("")}</select></label><label>排序<select name="sort">${option("APPLIED_DESC", "最近申请", sort)}${option("UPDATED_DESC", "最近更新", sort)}${option("COMPANY_ASC", "公司名称", sort)}${option("NEXT_DUE_ASC", "最近截止", sort)}</select></label><button class="button primary" type="submit">应用筛选</button></form><section class="panel"><header class="section-heading"><h2>申请记录 <span class="count">${page.totalCount}</span></h2><a class="text-link" href="${rootPath}/applications?status=ALL">查看全部</a></header><div data-page-items>${rows || empty(query.q || query.lifecycle ? "没有匹配的申请" : "当前范围没有申请", "尝试调整筛选，或在 ChatGPT 中记录实际投递。")}</div>${pagination(page, `${rootPath}/applications`, query)}</section>`, true, "applications");
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
  const resume = applicationResumeSchema.safeParse(resource.observedFacts);
  if (resume.success && resource.provider === "google-drive-resume") {
    return `<article class="evidence-row">${resumeAssociation(resume.data, resource.externalUri, zone)}<p class="muted">记录于 ${e(date(resource.createdAt, zone))} · 历史记录</p></article>`;
  }
  const profile = applicationProfileSchema.safeParse(resource.observedFacts);
  if (profile.success) {
    const p = profile.data;
    return `<article class="evidence-row"><h3>${e(resource.title ?? "岗位资料版本")}</h3><p class="muted">${e(resource.provider)} · ${e(date(resource.createdAt, zone))}</p><details><summary>查看此版本资料</summary>${[
      ["职位描述 · JD", p.jobDescription], ["技能匹配报告", p.skillMatchText],
      ["结构化匹配摘要", p.skillMatch?.summary], ["简历版本", p.resumeVersion],
      ["简历内容", p.resumeText], ["资料来源", p.sourceReference],
    ].filter(([, value]) => value).map(([title, value]) => `<h4>${e(title)}</h4><div class="saved-text">${e(value)}</div>`).join("")}</details></article>`;
  }
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

function resumeAssociation(resume: ApplicationResume, uri: string | null, zone: string): string {
  const labels = { CANDIDATE: "候选简历 · 待确认是否投递", CONFIRMED_FILE: "已确认投递文件 · 具体版本待确认",
    CONFIRMED_VERSION: "已确认实际投递版本", DISMISSED: "已排除此关联" };
  const source = resume.sourceFacts;
  const url = isResumeFileUrl(uri, source.fileId) ? safeExternalUrl(uri) : null;
  return `<div class="resume-association"><p class="overline">${labels[resume.interpretation.status]}</p><h3>${e(source.fileName)}</h3><p>${e(resume.interpretation.reason)}</p>
    ${url ? `<a class="text-link" href="${e(url)}" target="_blank" rel="noopener noreferrer">打开 Drive 文件（当前内容） ↗</a>` : "<p>文件链接不可用</p>"}
    <details><summary>版本与关联依据</summary><p class="muted">${source.revisionId ? `保存的 Drive 版本号：${e(source.revisionId)}` : "Drive 版本号尚未取得"}</p>
    ${source.revisionModifiedTime ? `<p class="muted">该版本修改时间：${e(timelineDate(source.revisionModifiedTime, zone))}</p>` : ""}
    ${resume.confirmation ? `<p>${e(resume.confirmation.statement)}</p><p class="muted">确认来源：${e(resume.confirmation.reference)}</p>` : "<p>文件名和修改时间用于寻找候选，尚不能确定实际投递版本。</p>"}
    <p class="muted">Drive 链接打开当前文件；核对历史内容时按保存的版本号读取。</p></details></div>`;
}

export function applicationView(service: WorkspaceService, id: string, query: Record<string, string | number>, zone: string,
  gmail?: { slot: number; email: string | null }[]): string {
  const detail = service.jobSearchQueryService.getApplication(id);
  const p = detail.project;
  const profile = service.jobSearchQueryService.applicationProfile(id);
  const report = applicationProfileSchema.safeParse(profile.saved?.facts);
  const match = report.success ? report.data.skillMatch : null;
  const data = report.success ? report.data : null;
  const matchLabels = { MATCH: "匹配", PARTIAL: "部分匹配", GAP: "有差距", UNKNOWN: "待确认" };
  const profilePanels = `<section class="panel application-profile"><h2>职位描述 · JD</h2>${report.success && report.data.jobDescription
    ? `<div class="saved-text">${e(report.data.jobDescription)}</div>` : `<p>尚未保存 JD 正文。</p>${safeExternalUrl(typeof p.metadata.postingReference === "string" ? p.metadata.postingReference : null) ? `<a class="text-link" target="_blank" rel="noopener noreferrer" href="${e(p.metadata.postingReference)}">查看职位原文 ↗</a>` : ""}`}</section>
    <section class="panel application-profile"><h2>我的技能匹配</h2>${data?.skillMatchText ? `<div class="saved-text">${e(data.skillMatchText)}</div>` : ""}${match ? `<p class="saved-text">${e(match.summary)}</p><div class="match-table"><table><thead><tr><th>岗位要求</th><th>我的经历 / 技能依据</th><th>匹配情况</th></tr></thead><tbody>${match.matches.map(m => `<tr><td>${e(m.requirement)}</td><td>${e(m.evidence)}</td><td>${e(matchLabels[m.assessment])}</td></tr>`).join("")}</tbody></table></div>${match.gaps.length ? `<h3>待补足</h3><ul>${match.gaps.map(g => `<li>${e(g)}</li>`).join("")}</ul>` : ""}`
    : data?.skillMatchText ? "" : profile.candidates.length ? profile.candidates.map(c => `<p class="saved-text">${e(c.fitReason)}</p><p class="muted">已关联候选岗位的匹配建议 · ${e(fitUncertaintyLabel(c.fitUncertainty))} · <a href="${candidateLink(c.id)}">查看来源</a></p>`).join("")
    : `<p>尚未保存此岗位的技能匹配报告。</p><p class="muted">若已在 GPT 中分析，请将原报告保存并关联到此申请，保存后这里即可展示。</p>`}${report.success && profile.saved ? `<p class="muted">报告来源：${e(profile.saved.provider)} · 保存记录时间 ${e(timelineDate(profile.saved.savedAt, zone))}</p>` : ""}</section>`;
  const resumes = service.jobSearchQueryService.applicationResumes(id).filter(r => r.facts.interpretation.status !== "DISMISSED");
  const resumePanel = `<section class="panel application-profile"><h2>申请简历</h2>${resumes.map(r => resumeAssociation(r.facts, r.externalUri, zone)).join("")}${data?.resumeVersion ? `<p><strong>原有简历记录：${e(data.resumeVersion)}</strong></p><p class="muted">原记录未区分文件与实际投递版本的确认依据。</p>` : resumes.length ? "" : "<p>尚未关联简历版本。</p>"}${data?.resumeText ? `<div class="saved-text">${e(data.resumeText)}</div>` : ""}${data?.sourceReference ? `<p class="saved-text muted">资料来源：${e(data.sourceReference)}</p>` : ""}
    <p class="muted">资料由 GPT 保存到此申请后显示。更新或补充资料请在 GPT 中操作。</p></section>`;
  const check = detail.latestGmailCheck;
  const parsed = gmailCheckSchema.safeParse(check?.facts);
  const checkLabels = { NO_UPDATE: "已检查，暂无新进展", UPDATED: "已检查，结果已更新", PARTIAL: "检查尚未完成", FAILED: "邮件检查失败" };
  const gmailControls = gmail ? `<div data-gmail-panel data-project-id="${e(id)}">${isOngoingApplication(p) ? '<button type="button" class="button primary" data-gmail-action="check">检查两个邮箱的最新更新</button><p>按公司或岗位关键词搜索，仅查看主题与摘要。</p>' : '<p>此申请已停止追踪，不再补查新邮件。以下为历史检查记录。</p>'}<p data-gmail-status role="status"></p><details><summary>邮箱连接（${gmail.filter(g => g.email).length}/2）</summary>${gmail.map(g => `<p>邮箱 ${g.slot}：${e(g.email ?? "尚未连接")} <button type="button" class="button secondary" data-gmail-action="connect" data-slot="${g.slot}">${g.email ? "重新授权" : "连接 Gmail"}</button>${g.email ? ` <button type="button" class="button secondary" data-gmail-action="disconnect" data-slot="${g.slot}">断开</button>` : ""}</p>`).join("")}</details></div>` : "";
  const emailCheck = `<section class="panel email-check"><h2>Gmail 最新进展</h2>${gmailControls}${check && parsed.success
    ? `<p><strong>${checkLabels[parsed.data.status]}</strong> · <time datetime="${e(check.checkedAt)}">${e(date(check.checkedAt, zone))}</time></p><p>${e(parsed.data.summary)}</p><p class="muted">检查范围：${e(parsed.data.searchScope)}</p>`
    : `<p>尚无有效的邮件检查记录。没有待办不代表邮箱没有新进展。</p>`}<details class="context-handoff"><summary>去 ChatGPT 检查 Gmail</summary><section class="context-box"><div><p>复制检查指令，粘贴到已连接 Gmail 和 Personal AI Workspace 的 ChatGPT 对话并发送。结果保存后，切回此页读取。</p></div><button type="button" class="button secondary" data-copy>复制检查指令</button><a class="button secondary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">打开 ChatGPT ↗</a><label class="sr-only" for="context-reference">Gmail 检查与回填指令</label><textarea id="context-reference" readonly rows="5">${e(gmailCheckPrompt(id))}</textarea></section></details></section>`;
  const section = String(query.section ?? (query.status ? "tasks" : "timeline"));
  const paging = { ...(query.cursor ? { cursor: query.cursor } : {}), ...(query.pageSize ? { pageSize: query.pageSize } : {}) };
  let page: ReadPage<unknown>, rows: string, filters = "";
  const status = String(query.status ?? (section === "history" ? "ADMITTED" : "OPEN"));
  if (section === "timeline") {
    const result = service.jobSearchQueryService.listTimeline(id, paging); page = result;
    const kinds: Record<string, string> = { APPLICATION: "申请日期", STATE: "状态登记", EMAIL: "邮件记录", CHECK: "邮箱检查", TASK: "待办记录" };
    rows = result.items.map(r => `<article class="history-row"><div class="timeline-dot" aria-hidden="true"></div><div class="grow"><p class="overline">${e(kinds[r.kind])}</p><h3>${e(r.kind === "STATE" ? label(r.title) : r.title)}</h3><p class="saved-text">${e(r.summary)}</p></div><time datetime="${e(r.at)}">${e(timelineDate(r.at, zone))}</time></article>`).join("");
  } else if (section === "resources") {
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
  const tabs = [["timeline", "时间线"], ["tasks", "任务"], ["resources", "证据"], ["history", "进展记录"]].map(([key, text]) => `<a href="${appLink(id)}?section=${key}"${section === key ? ' aria-current="page"' : ""}>${text}</a>`).join("");
  const posting = safeExternalUrl(typeof p.metadata.postingReference === "string" ? p.metadata.postingReference : null);
  return document("申请详情", `<a class="back-link" href="${rootPath}/applications">← 我的申请</a>${heading(String(p.metadata.company ?? "申请详情"), String(p.metadata.role ?? p.title), typeof p.metadata.location === "string" ? p.metadata.location : "当前已确认的申请状态")}<p class="application-date">申请日期：${e(applicationDate(p.metadata.appliedDate))}</p>${freshness(detail.asOf, zone)}<div class="detail-summary"><div>${chip(p.lifecycleState)} ${chip(p.status)}<p class="muted">当前申请进展</p></div><div><strong>${detail.totalCounts.openTasks}</strong><p>开放任务</p></div><div><strong>${detail.totalCounts.completedTasks}</strong><p>已完成任务</p></div>${posting ? `<a class="button secondary" target="_blank" rel="noopener noreferrer" href="${e(posting)}">查看职位来源 ↗</a>` : ""}</div><section class="panel"><nav class="tabs" aria-label="申请详情分区">${tabs}</nav>${filters ? `<form method="get" class="collection-filters" data-filter-form><input type="hidden" name="section" value="${e(section)}">${filters}<button type="submit" class="button secondary">查看</button></form>` : ""}${section === "history" ? '<p class="section-intro">只呈现实际记录的变更与建议；不补全跳过的阶段，也不代表全部编辑历史。</p>' : ""}<div data-page-items>${rows || empty("这个范围暂无记录", "可以切换范围，查看其他已保存的工作记录。")}</div>${pagination(page, appLink(id), { ...query, section, ...(!["resources", "timeline"].includes(section) ? { status } : {}) })}</section>${profilePanels}${resumePanel}${emailCheck}`, true, "applications");
}

export function taskView(service: WorkspaceService, id: string, zone: string, asOf: string,
  completionEnabled = false): string {
  const task = service.jobSearchQueryService.getTask(id);
  const { project } = service.jobSearchQueryService.getApplication(task.projectId);
  const terminal = task.status === "DONE" || task.status === "CANCELLED";
  const action = terminal || !completionEnabled ? "" : `<div class="task-actions"><button type="button" class="button primary" data-complete-task data-task-id="${e(task.id)}" data-record-version="${task.recordVersion}">标记为已完成</button></div>`;
  return document("任务详情", `<a class="back-link" href="${appLink(task.projectId)}">← ${e(project.metadata.company)} · ${e(project.metadata.role)}</a>${heading("TASK / 任务", task.title, "任务状态来自 Workspace 的最新记录。")}${freshness(asOf, zone)}<section class="panel task-detail"><div class="chips">${chip(task.status)}${chip(task.priority)}</div><dl class="facts"><div><dt>截止时间</dt><dd>${e(date(task.dueAt, zone))}</dd></div><div><dt>完成时间</dt><dd>${task.completedAt ? e(date(task.completedAt, zone)) : "尚无完成记录"}</dd></div><div><dt>最近更新</dt><dd>${e(date(task.updatedAt, zone))}</dd></div></dl><p class="section-intro">${terminal ? "这项任务已结束。如需继续同类工作，请在 ChatGPT 中创建新任务。" : "完成后，这项任务会保留在申请记录中。"}</p>${action}</section>${contextCopy("Task", id)}`, true, "applications");
}

export function candidateListView(service: WorkspaceService, query: Record<string, string | number>, zone: string): string {
  const page = service.jobSearchQueryService.listCandidates(query);
  const decision = String(query.decision ?? "ALL"), linked = String(query.linked ?? "ALL");
  const rows = page.items.map((candidate: JobCandidateRecord) => {
    const source = safeExternalUrl(candidate.sourceUrl);
    return `<article class="candidate-row"><div class="grow"><p class="overline">${e(candidate.company)}${candidate.location ? ` · ${e(candidate.location)}` : ""}</p><h2><a href="${candidateLink(candidate.id)}">${e(candidate.role)}</a></h2><p class="muted">${e(candidate.title)}</p>${candidate.fitReason ? `<p class="advisory">${e(candidate.fitReason)}</p>` : ""}</div><div class="row-status">${chip(candidate.decision)}${candidate.linkedProjectId ? `<a class="text-link" href="${appLink(candidate.linkedProjectId)}">已关联申请 ↗</a>` : `<span class="muted">未关联</span>`}${source ? `<a class="text-link" href="${e(source)}" target="_blank" rel="noopener noreferrer">职位来源 ↗</a>` : ""}</div></article>`;
  }).join("");
  return document("职位", `${heading("JOBS / 职位", "候选职位，逐条决定", "收藏、忽略或关联到实际申请；决策会跨对话保留。")}${freshness(page.asOf, zone)}<form class="filters" method="get" data-filter-form><label class="search-label">搜索公司、职位或标题<input type="search" name="q" value="${e(query.q ?? "")}" placeholder="公司、职位、标题关键词" maxlength="500"></label><label>决策<select name="decision">${["UNREVIEWED", "SAVED", "DISMISSED", "ALL"].map((x) => option(x, x === "ALL" ? "全部决策" : label(x), decision)).join("")}</select></label><label>关联<select name="linked">${option("ALL", "全部", linked)}${option("UNLINKED", "未关联", linked)}${option("LINKED", "已关联", linked)}</select></label><button class="button primary" type="submit">应用筛选</button></form><section class="panel"><header class="section-heading"><h2>候选职位 <span class="count">${page.totalCount}</span></h2></header><div data-page-items>${rows || empty("当前范围没有候选职位", "调整筛选，或在 ChatGPT 中记录新的候选职位。")}</div>${pagination(page, `${rootPath}/jobs`, query)}</section>`, true, "jobs");
}

export function candidateView(service: WorkspaceService, id: string, zone: string, asOf: string,
  writesEnabled = false): string {
  const candidate = service.jobSearchQueryService.getCandidate(id);
  const source = safeExternalUrl(candidate.sourceUrl);
  const decisionActions: Array<{ action: "SAVE" | "DISMISS" | "RESTORE"; label: string }> = [];
  if (candidate.decision !== "SAVED") decisionActions.push({ action: "SAVE", label: "收藏" });
  if (candidate.decision !== "DISMISSED") decisionActions.push({ action: "DISMISS", label: "忽略" });
  if (candidate.decision !== "UNREVIEWED") decisionActions.push({ action: "RESTORE", label: "恢复待考虑" });

  const actions = writesEnabled && decisionActions.length
    ? `<div class="candidate-actions">${decisionActions.map((a) =>
        `<button type="button" class="button secondary" data-decide-candidate data-candidate-id="${e(candidate.id)}" data-action="${a.action}" data-record-version="${candidate.recordVersion}">${e(a.label)}</button>`).join("")}</div>`
    : "";

  let linkControl = "";
  if (writesEnabled && !candidate.linkedProjectId) {
    const { applications } = service.listJobApplications(false);
    const options = applications.map((a) => `<option value="${e(a.projectId)}">${e(a.company)} · ${e(a.role)}</option>`).join("");
    linkControl = `<div class="candidate-link"><p class="section-intro">已实际投递后，选择对应的申请并关联。关联不会新建申请，也不会改变收藏/忽略决策。</p>${applications.length
      ? `<label>选择已记录的申请<select name="projectId" data-link-target>${options}</select></label><button type="button" class="button primary" data-link-candidate data-candidate-id="${e(candidate.id)}">记录已投递并关联</button>`
      : '<p class="muted">尚未记录任何进行中的申请。请先在 ChatGPT 中记录投递，再回到这里关联。</p>'}</div>`;
  }

  const linked = candidate.linkedProjectId
    ? `<a class="text-link" href="${appLink(candidate.linkedProjectId)}">查看已关联申请 ↗</a>`
    : "";

  return document("职位详情", `<a class="back-link" href="${rootPath}/jobs">← 职位列表</a>${heading(candidate.company, candidate.role, candidate.title)}${freshness(asOf, zone)}<div class="detail-summary"><div>${chip(candidate.decision)}<p class="muted">当前决策</p></div><div><strong>${e(sourceAvailabilityLabel(candidate.sourceAvailability))}</strong><p>来源状态</p></div><div><strong>${candidate.linkedProjectId ? "已关联" : "未关联"}</strong><p>关联申请</p></div></div><section class="panel"><dl class="facts"><div><dt>公司</dt><dd>${e(candidate.company)}</dd></div><div><dt>职位</dt><dd>${e(candidate.role)}</dd></div><div><dt>地点</dt><dd>${candidate.location ? e(candidate.location) : "未提供"}</dd></div><div><dt>来源</dt><dd>${source ? `<a class="text-link" href="${e(source)}" target="_blank" rel="noopener noreferrer">打开职位来源 ↗</a>` : e(candidate.provider)}</dd></div><div><dt>匹配建议</dt><dd>${candidate.fitReason ? e(candidate.fitReason) : "未提供建议"}</dd></div><div><dt>建议不确定性</dt><dd>${e(fitUncertaintyLabel(candidate.fitUncertainty))}</dd></div><div><dt>最近更新</dt><dd>${e(date(candidate.updatedAt, zone))}</dd></div></dl>${linked ? `<p class="section-intro">${linked}</p>` : ""}${actions}${linkControl}</section>${contextCopy("Candidate", id)}`, true, "jobs");
}
