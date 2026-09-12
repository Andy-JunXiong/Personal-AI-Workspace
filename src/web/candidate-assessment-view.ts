import { z } from "zod";
import type { CandidateAssessmentService } from "../application/candidate-assessment-service.js";
import { parseAssessment } from "../domain/candidate-match-assessment.js";
import { escapeHtml as e, rootPath, safeExternalUrl } from "./views.js";

type Detail = ReturnType<CandidateAssessmentService["getCandidate"]>;
type Summary = Detail["matchAssessment"];
const pageOptions = z.object({
  assessmentVersion: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  historyBeforeVersion: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict();
export const assessmentPageOptions = (query: unknown) => parseAssessment(pageOptions, query);

const stateLabels = { CURRENT: "当前评级", STALE: "待重新评估", MISSING_JD: "JD 待补充", UNASSESSED: "待评估" };
const staleLabels: Record<string, string> = {
  CANDIDATE_CHANGED: "职位信息已更正", JD_CHANGED: "JD 已更新", BASE_RESUME_CHANGED: "基础简历已更新",
  LIBRARY_CHANGED: "资料库或已确认的纠正已更新", SOURCES_CHANGED: "所用经历资料已更新或不再可用",
};
function missingLabel(value: string) {
  return ({ JOB_DESCRIPTION: "完整 JD 待补充", BASE_RESUME: "基础简历待补充", SOURCE_SELECTION_LIMIT: "需要缩小资料选择范围" })[value]
    ?? (value.startsWith("SOURCE_UNAVAILABLE:") ? "选定的经历资料已不可用" : value);
}
function at(value: string, zone: string) {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
function sourceLink(url: string | null, label: string) {
  const safe = safeExternalUrl(url);
  return safe ? `<a class="text-link" href="${e(safe)}" target="_blank" rel="noopener noreferrer">${e(label)} ↗</a>` : "";
}
function sourceText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(sourceText).filter(Boolean).join("\n");
  if (value && typeof value === "object") return Object.values(value).map(sourceText).filter(Boolean).join("\n");
  return "";
}

export function assessmentListSummary(summary: Summary) {
  const current = summary.status === "CURRENT";
  const reason = current ? summary.reason : summary.status === "STALE"
    ? summary.staleReasons.map(key => staleLabels[key] ?? "评估资料已变化").join("；")
    : summary.missingMaterials.length ? [...new Set(summary.missingMaterials.map(missingLabel))].join("；")
    : summary.reason ?? "尚未保存 ChatGPT 的岗位评估";
  return `<div class="candidate-assessment-summary" data-assessment-status="${summary.status}"><span class="assessment-badge ${current ? "current" : "pending"}">${current ? `${e(summary.grade)} · 匹配评级` : stateLabels[summary.status]}</span><p>${e(reason)}</p></div>`;
}

export function candidateAssessmentPanel(detail: Detail, zone: string, historyBeforeVersion?: number) {
  const summary = detail.matchAssessment, saved = detail.assessment;
  const base = `${rootPath}/jobs/${encodeURIComponent(detail.id)}`;
  const href = (version?: number, before?: number) => {
    const query = new URLSearchParams();
    if (version !== undefined) query.set("assessmentVersion", String(version));
    if (before !== undefined) query.set("historyBeforeVersion", String(before));
    return e(`${base}${query.size ? `?${query}` : ""}#match-assessment`);
  };
  const viewedHistorical = saved && (saved.recordVersion !== summary.recordVersion || summary.status !== "CURRENT");
  const status = `<section class="panel assessment-panel" id="match-assessment"><p class="overline">CHATGPT · 岗位匹配</p><h2>这个职位适合我吗？</h2>${assessmentListSummary(summary)}
    ${summary.createdAt ? `<p class="assessment-meta">最近评估 ${e(at(summary.createdAt, zone))} · 第 ${summary.recordVersion} 版</p>` : ""}
    <p class="assessment-guidance">${summary.status === "CURRENT" ? "评级依据已保存的岗位与经历资料，用于比较申请优先级。" : summary.status === "MISSING_JD" ? "先补充下方的完整职位描述，再在 ChatGPT 中评估并保存。" : summary.status === "STALE" ? "请在 ChatGPT 中读取更新后的资料并重新评估。原评级保留在历史中。" : "在 ChatGPT 中更新技能与项目库，再结合完整 JD 评估并保存，结果会显示在这里。"}</p>
    <p class="assessment-meta">资料中未找到证据，不等于不具备能力。评级不代表录用概率。</p></section>`;
  let report = "";
  if (saved) {
    const v = saved.recordVersion, assessment = saved.report;
    const sourceAnchor = (id: string) => `assessment-source-${v}-${id}`;
    const requirements = assessment.requirements.map((r, index) => `<article class="assessment-requirement" id="assessment-requirement-${v}-${index}">
      <header><div><p class="overline">${r.importance === "REQUIRED" ? "核心要求" : "优先条件"}</p><h3>${e(r.requirement)}</h3></div><span class="assessment-result">${{ MATCH: "有匹配证据", PARTIAL: "部分匹配", UNKNOWN: "证据待补充" }[r.assessment]}</span></header>
      <p class="assessment-label">岗位原文</p><blockquote>${e(r.jdQuote)}</blockquote>
      <div class="assessment-comparison"><div><h4>${saved.inputs.skillLibrary?.catalog ? "技能与项目证据" : "经历证据"}</h4>${r.evidence.length ? r.evidence.map(citation => {
        if (citation.kind === "SKILL") {
          const skill = saved.inputs.skillLibrary?.catalog?.skills.find(s => s.id === citation.skillId);
          const projects = skill?.projectIds.map(id => saved.inputs.skillLibrary?.catalog?.projects.find(p => p.id === id)).filter(p => !!p) ?? [];
          return `<div class="assessment-citation"><strong>${e(skill?.name ?? citation.skillId ?? "保存的技能")}</strong><p>${e(citation.quote)}</p>${projects.map(p => `<p>项目：${e(p!.name)} · ${e(p!.contribution)}</p>`).join("")}<details><summary>技能的原始依据</summary>${skill?.evidence.map(ref => {
            const origin = saved.inputs.sources.find(s => s.id === ref.sourceId);
            return `<blockquote>${e(ref.quote)}</blockquote><a href="#${sourceAnchor(ref.sourceId)}">${e(origin?.title ?? "保存的来源")} · 版本 ${ref.recordVersion} ↓</a>`;
          }).join("") ?? ""}</details></div>`;
        }
        const source = saved.inputs.sources.find(s => s.id === citation.sourceId);
        const label = citation.kind === "BASE_RESUME" ? `基础简历 · 版本 ${saved.inputs.baseResume?.recordVersion}` : `${source?.title ?? "保存的经历资料"} · 版本 ${source?.record_version}`;
        return `<div class="assessment-citation"><blockquote>${e(citation.quote)}</blockquote><a href="#${citation.kind === "BASE_RESUME" ? `assessment-base-${v}` : sourceAnchor(citation.sourceId!)}">${e(label)} ↓</a></div>`;
      }).join("") : "<p class=\"muted\">当前所选资料未提供足够证据，需要进一步确认。</p>"}</div><div><h4>评估判断</h4><p>${e(r.inference)}</p></div></div></article>`).join("");
    const conclusion = (title: string, items: typeof assessment.strengths) => items.length ? `<section class="assessment-conclusion"><h3>${title}</h3><ul>${items.map(item => {
      const index = assessment.requirements.findIndex(r => r.id === item.requirementId);
      return `<li><a href="#assessment-requirement-${v}-${index}">${e(assessment.requirements[index]?.requirement)}</a><p>${e(item.explanation)}</p></li>`;
    }).join("")}</ul></section>` : "";
    report = `<section class="panel assessment-panel assessment-report"><header class="assessment-report-heading"><div><p class="overline">${viewedHistorical ? "历史评估" : "评估依据"} · 第 ${v} 版</p><h2>${viewedHistorical ? "查看当时的判断与资料" : saved.inputs.skillLibrary?.catalog ? "岗位要求与技能对照" : "岗位要求与经历对照"}</h2></div>${viewedHistorical ? `<span class="assessment-badge historical">历史评级 ${e(assessment.grade ?? "未评级")}</span>` : ""}</header>
      ${viewedHistorical ? `<p class="assessment-history-notice">这份结果基于当时保存的资料，当前状态以上方提示为准。</p><p>${e(assessment.reason)}</p>` : ""}
      ${saved.recordVersion !== summary.recordVersion ? `<a class="text-link" href="${href()}">返回最新评估 ↑</a>` : ""}
      <p class="assessment-meta">由 ChatGPT 评估 · 保存于 ${e(at(saved.createdAt, zone))}</p>
      ${assessment.completeness.missingMaterials.length ? `<div class="assessment-limitations"><h3>仍需补充的资料</h3><ul>${assessment.completeness.missingMaterials.map(item => `<li>${e(missingLabel(item))}</li>`).join("")}</ul></div>` : ""}
      ${requirements || "<p>这次未形成逐项评估，保留了资料缺失说明。</p>"}
      ${conclusion("匹配优势", assessment.strengths)}${conclusion("差距与证据限制", assessment.gaps)}${conclusion("待确认事项", assessment.questions)}
      ${assessment.completeness.limitations.length ? `<details class="assessment-sources"><summary>评估范围与限制</summary><ul>${assessment.completeness.limitations.map(item => `<li>${e(item)}</li>`).join("")}</ul></details>` : ""}
      ${saved.correction ? `<section class="assessment-correction"><h3>你的纠正</h3><blockquote>${e(saved.correction.statement)}</blockquote><p class="assessment-meta">依据：${e(saved.correction.reference)}</p></section>` : ""}
      <div class="assessment-source-ledger"><h3>本次评估使用的资料</h3><p class="assessment-meta">以下正文保留评估时的内容；外部链接打开来源网站的当前页面。</p>
      ${saved.inputs.jd ? `<details class="assessment-sources"><summary>职位描述 · 保存的 JD</summary>${sourceLink(saved.inputs.jd.sourceUrl, "打开职位来源")}<div class="saved-text">${e(saved.inputs.jd.text)}</div></details>` : ""}
      ${saved.inputs.baseResume ? `<details class="assessment-sources" id="assessment-base-${v}"><summary>基础简历 · 版本 ${saved.inputs.baseResume.recordVersion}</summary>${sourceLink(saved.inputs.baseResume.sourceUrl, "打开简历来源")}<div class="saved-text">${e(sourceText(saved.inputs.baseResume.content))}</div></details>` : ""}
      ${saved.inputs.sources.map(source => `<details class="assessment-sources" id="${sourceAnchor(source.id)}"><summary>${e(source.title)} · 版本 ${source.record_version}<span>${source.review_status === "CONFIRMED" ? "已由你核对" : "原始资料，待核对"}</span></summary>${sourceLink(source.source_url, "打开资料来源")}<div class="saved-text">${e(source.content)}</div></details>`).join("")}
      <details class="assessment-sources"><summary>评估来源与标准</summary><p>评级标准：A+、A、A−、B+、B、B− · 第 1 版</p><p>评估来源：${e(assessment.provenance.reference)}</p><p>生成时间：${e(at(assessment.provenance.generatedAt, zone))}</p>${assessment.provenance.model ? `<p>模型：${e(assessment.provenance.model)}</p>` : ""}<p>完整 JD：${assessment.completeness.fullJdReviewed ? "评估方声明已审阅" : "尚未声明完整审阅"}</p></details></div></section>`;
  }
  const history = detail.assessmentHistory;
  return status + report + (history.total ? `<section class="panel assessment-panel"><h2>评估历史 <span class="count">${history.total}</span></h2><p class="assessment-meta">每个版本保留当时的评级与资料。历史评级不表示当前匹配程度。</p><ol class="assessment-history">${history.items.map(item => `<li><a href="${href(item.recordVersion, historyBeforeVersion)}"${item.recordVersion === saved?.recordVersion ? ' aria-current="page"' : ""}><strong>第 ${item.recordVersion} 版 · ${e(item.grade ?? "未评级")}</strong><time datetime="${e(item.createdAt)}">${e(at(item.createdAt, zone))}</time><span>${e(item.reason)}</span></a></li>`).join("")}</ol><nav class="assessment-history-nav" aria-label="评估历史分页">${historyBeforeVersion ? `<a class="button secondary" href="${href(saved?.recordVersion)}">最近记录</a>` : ""}${history.nextBeforeVersion ? `<a class="button secondary" href="${href(saved?.recordVersion, history.nextBeforeVersion)}">更早记录 →</a>` : ""}</nav></section>` : "");
}
