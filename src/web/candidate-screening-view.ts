import { z } from "zod";
import type { WorkspaceService } from "../application/workspace-service.js";
import type { CandidateScreeningSummary } from "../domain/candidate-screening.js";
import { parseAssessment } from "../domain/candidate-match-assessment.js";
import { escapeHtml as e, rootPath } from "./views.js";

const labels = { FILTER: "已筛除", DEPRIORITIZE: "较低优先级", EVALUATE: "可继续评估", USER_CONFIRMATION_REQUIRED: "待确认" };
const basis = { FACT: "已记录事实", PREFERENCE: "你的筛选偏好", UNKNOWN: "资料待确认" };
const stale: Record<string, string> = { CANDIDATE_CHANGED: "职位信息已变化", JD_CHANGED: "JD 已更新", RESUME_CHANGED: "简历已更新",
  PROFILE_OR_SOURCES_CHANGED: "个人资料或经历来源已更新", RULES_CHANGED: "筛选规则已更新" };
export function screeningListSummary(summary: CandidateScreeningSummary | null) {
  if (!summary || summary.status === "UNSCREENED") return '<p class="candidate-meta">尚未筛选</p>';
  const label = summary.status === "STALE" ? "待重新筛选" : summary.overrideMode === "KEEP" ? "已手动保留"
    : summary.savedByUser && summary.decision === "FILTER" ? "已收藏 · 保留可见" : labels[summary.decision!];
  const reason = summary.status === "STALE" ? summary.staleReasons.map(key => stale[key] ?? key).join("；") : summary.reason;
  return `<div class="candidate-assessment-summary" data-screening-status="${summary.status}" data-screening-hidden="${summary.hidden}"><span class="assessment-badge pending">${label}</span><p>${e(reason ?? "")}</p></div>`;
}

export function screeningPanel(service: WorkspaceService, id: string, candidateVersion: number, query: Record<string, string | number>) {
  const positive = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional();
  const parsed = parseAssessment(z.object({ version: positive, beforeVersion: positive, overrideBeforeVersion: positive }).strict(), {
    version: query.screeningVersion, beforeVersion: query.screeningBeforeVersion, overrideBeforeVersion: query.overrideBeforeVersion,
  });
  const detail = service.candidateScreeningService.get(id, parsed), s = detail.summary;
  const url = `${rootPath}/jobs/${id}`;
  const record = detail.record;
  const history = detail.history.items.map(item => `<li><a href="${url}?screeningVersion=${item.recordVersion}">第 ${item.recordVersion} 次 · ${labels[item.decision as keyof typeof labels]}</a> — ${e(item.reason)}</li>`).join("");
  const overrides = detail.overrides.items.map(item => `<li>${item.mode === "KEEP" ? "手动保留" : "取消保留"} · ${e(item.createdAt)}<p>${e(item.reason)}</p></li>`).join("");
  const action = s.recordVersion ? `<button type="button" class="button secondary" data-screening-override data-candidate-id="${e(id)}" data-candidate-version="${candidateVersion}" data-screening-version="${s.recordVersion}" data-override-version="${s.overrideVersion}" data-mode="${s.overrideMode === "KEEP" ? "AUTOMATIC" : "KEEP"}">${s.overrideMode === "KEEP" ? "取消手动保留，按筛选结果显示" : "保留此职位，不受自动筛选隐藏"}</button><p data-screening-result role="status" aria-live="polite"></p>` : "";
  const findings = record?.result.findings.map(item => `<li><h4>${e(item.interpretation)}</h4><p>${labels[item.decision]} · ${basis[item.basis]} · ${item.importance === "REQUIRED" ? "必需" : item.importance === "PREFERRED" ? "优先" : "是否必需待确认"}</p><blockquote>${e(item.jdQuote)}</blockquote>${item.candidateEvidence ? `<p>个人依据：${e(item.candidateEvidence.statement)}</p>` : "<p>没有足够的已确认个人依据。</p>"}<details><summary>判断与备选条件</summary><p>${e(item.reason)}</p>${item.alternatives.map(alt => `<p>${labels[alt.decision]} · ${basis[alt.basis]}：${e(alt.reason)}${alt.candidateEvidence ? `<br>${e(alt.candidateEvidence.statement)}` : ""}</p>`).join("")}</details></li>`).join("") ?? "";
  return `<section class="panel screening-panel"><h2>职位筛选</h2>${screeningListSummary(s)}${s.status === "STALE" ? "<p>旧筛选已失效，此职位重新显示，等待按最新资料筛选。</p>" : ""}${s.savedByUser ? "<p>你已收藏此职位，自动筛选不会隐藏它。</p>" : ""}${action}${record ? `<details ${parsed.version !== undefined ? "open" : ""}><summary>${parsed.version !== undefined ? "历史" : "本次"}筛选依据 · 第 ${record.recordVersion} 次</summary><p>${e(record.reason)}</p><p>${e(record.createdAt)} · ${e(record.result.ruleVersion)} · 个人资料版本 ${record.result.profileVersion}</p>${record.result.missingMaterials.length ? "<p>资料或 JD 审阅尚不完整，需要确认后再筛选。</p>" : ""}<ol>${findings}</ol><p>来源记录：${e(record.provenanceReference)}</p>${parsed.version !== undefined ? `<a href="${url}">返回当前筛选</a>` : ""}</details>` : "<p>完整 JD 和已确认的个人资料齐备后，可在 ChatGPT 中按筛选规则评估。</p>"}${history ? `<details><summary>筛选历史</summary><ul>${history}</ul>${detail.history.nextBeforeVersion ? `<a href="${url}?screeningBeforeVersion=${detail.history.nextBeforeVersion}">更早的筛选记录</a>` : ""}</details>` : ""}${overrides ? `<details><summary>人工保留记录</summary><ul>${overrides}</ul>${detail.overrides.nextBeforeVersion ? `<a href="${url}?overrideBeforeVersion=${detail.overrides.nextBeforeVersion}">更早的保留记录</a>` : ""}</details>` : ""}</section>`;
}
