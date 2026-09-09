import type {WorkspaceService} from "../application/workspace-service.js";
import type {LibrarySource} from "../application/job-library-service.js";
import {jobFitSchema} from "../domain/job-fit.js";
import {document,escapeHtml as e,rootPath} from "./views.js";

function sourceForm(source?:LibrarySource){
  return `<form data-library-source class="library-form">
  <input type="hidden" name="sourceKey" value="${e(source?.source_key??"")}">
  <input type="hidden" name="expectedVersion" value="${source?.record_version??0}">
  <label>资料标题<input name="title" required maxlength="500" value="${e(source?.title??"")}" placeholder="项目经历、简历版本或面试案例"></label>
  <label>原始链接<input name="sourceUrl" type="url" maxlength="2000" value="${e(source?.source_url??"")}"></label>
  <label>资料正文<textarea name="content" required maxlength="50000" rows="12">${e(source?.content??"")}</textarea></label>
  <label>核对状态<select name="reviewStatus">${[["SOURCE","原始资料 · 尚未核对"],["CONFIRMED","已由我核对"],["EXCLUDED","暂不用于匹配"]].map(([v,l])=>`<option value="${v}"${(source?.review_status??"SOURCE")===v?" selected":""}>${l}</option>`).join("")}</select></label>
  <button class="button primary" type="submit">保存资料</button><p data-library-result role="status"></p></form>`;
}

export function libraryView(service:WorkspaceService,q=""){
  const all=service.jobLibraryService.sources(),sources=all.filter(s=>`${s.title}\n${s.content}`.toLocaleLowerCase().includes(q.toLocaleLowerCase()));
  return document("求职／面试资料库",`<p class="eyebrow">CAREER LIBRARY</p><h1>求职／面试资料库</h1>
  <p class="subtitle">汇总各版简历、项目证据和面试案例。每个岗位从这里选取相关内容，生成匹配清单与定制简历草稿。</p>
  <div class="detail-summary"><div><strong>${all.length}</strong><p>资料来源</p></div><div><strong>${all.filter(s=>s.review_status==="CONFIRMED").length}</strong><p>已核对</p></div><a class="button secondary" href="${rootPath}/jobs">查看候选职位 →</a></div>
  <section class="panel library-panel"><h2>添加资料</h2><p>保留原来的项目、雇主、日期和成果数字。历史简历只是来源；有分歧的经历先核对，再用于投递。</p><details><summary>新增项目、简历或面试案例</summary>${sourceForm()}</details></section>
  <form class="filters" method="get"><label class="search-label">查找技能、经历或素材<input type="search" name="q" value="${e(q)}" maxlength="500"></label><button class="button secondary">搜索</button></form>
  <section class="panel library-panel"><h2>资料来源 · ${sources.length}</h2>${sources.map(s=>`<details class="library-source" id="source-${e(s.id)}"><summary>${e(s.title)} <small>${s.review_status==="CONFIRMED"?"已核对":s.review_status==="EXCLUDED"?"已排除":"待核对"}</small></summary>${sourceForm(s)}</details>`).join("")||"<p>暂无匹配资料。</p>"}</section>`,true,"library");
}

export function fitPanel(service:WorkspaceService,id:string,sourceUrl:string|null){
  const library=service.jobLibraryService,fit=library.fit(id),snapshot=library.snapshot();
  const description=library.description(id);
  const stale=fit&&fit.library_hash!==snapshot.hash;
  const report=fit?jobFitSchema.parse(JSON.parse(fit.assessment_json)):null;
  const rows=report?.requirements.map(r=>`<tr><td>${e(r.requirement)}<small>${r.importance==="REQUIRED"?"必需":"优先"}</small></td><td>${r.assessment==="MATCH"?"有匹配证据":r.assessment==="PARTIAL"?"部分匹配":"尚无足够证据"}</td><td>${e(r.evidenceQuote)||"待补充"}${r.sourceId?`<br><a href="${rootPath}/library#source-${e(r.sourceId)}">查看来源</a>`:""}</td><td>${e(r.explanation)}</td></tr>`).join("");
  return `<section class="panel library-panel"><h2>JD 与我的背景</h2><p>使用 <a href="${rootPath}/library">求职／面试资料库</a> 的 ${snapshot.sources.length} 份有效资料。请粘贴此岗位完整 JD，避免把 Job Alert 摘要当作全部要求。</p>
  <form data-library-compare data-candidate-id="${e(id)}" class="library-form"><label>职位来源链接<input type="url" name="sourceUrl" maxlength="2000" value="${e(fit?.jd_source_url??description?.source_url??sourceUrl??"")}"></label><label>完整职位描述<textarea name="jd" required minlength="200" maxlength="50000" rows="10">${e(fit?.jd_text??description?.jd_text??"")}</textarea></label><button class="button primary" ${snapshot.sources.length?"":"disabled"}>匹配背景并准备简历</button><p data-library-result role="status"></p></form>
  ${report?`<h3>${stale?"资料库已更新 · 请重新匹配":fit!.score===null?"存在待核对信息 · 暂不评分":`有证据的匹配度 ${fit!.score}%`}</h3><p>${e(report.summary)}</p><p class="muted">证据覆盖 ${fit!.coverage}%。必需项权重 3、优先项权重 1；匹配得全分，部分匹配得半分，未知得 0。此分数是资料匹配参考，不是录用概率。</p>${report.conflicts.length?`<ul>${report.conflicts.map(c=>`<li>${e(c)}</li>`).join("")}</ul>`:""}<div class="library-table"><table><thead><tr><th>Job requirement</th><th>匹配情况</th><th>我的技能／经历证据</th><th>差距与说明</th></tr></thead><tbody>${rows}</tbody></table></div>`:""}</section>
  ${fit?`<section class="panel library-panel"><h2>此岗位的简历草稿</h2><p>按岗位选取资料库原文，请核对经历归属、时间和数字后再投递。下载文件名包含公司与岗位。</p><form data-library-draft data-candidate-id="${e(id)}" class="library-form"><input type="hidden" name="expectedUpdatedAt" value="${e(fit.updated_at)}"><label>编辑草稿<textarea name="draft" rows="20" maxlength="50000">${e(fit.resume_draft)}</textarea></label><button class="button secondary">保存草稿</button><p data-library-result role="status"></p></form>${stale?"<p>请先重新匹配，再下载草稿。</p>":`<a class="button primary" download href="/api/v1/job-search/library/candidates/${e(id)}/resume">下载已保存的简历草稿</a>`}</section>`:""}`;
}

export function discoveryPanel(service:WorkspaceService){
  const run=service.jobLibraryService.recentRun();
  const receipt=run?JSON.parse(run.result_json) as {candidateCount?:number;jdCount?:number;matchedCount?:number;missingJd?:number;limited?:boolean;error?:string;mailboxes?:{complete:boolean;error:boolean}[]}:null;
  return `<section class="panel library-panel"><h2>从 Job Alert 发现职位</h2><p>读取两个已连接邮箱最近 7 天的 LinkedIn／SEEK 职位提醒，每个邮箱最多 20 封。每次导入最多 10 个职位，有 JD 的前 3 个待评职位自动匹配资料库；其余可在详情页继续。</p><p>需要登录或无法读取的 JD 会标为待补充。投递时跳转原网站。</p><button class="button primary" data-discover-jobs${run?.status==="RUNNING"?" disabled":""}>${run?.status==="RUNNING"?"同步进行中":"同步 Job Alert 并匹配"}</button><p data-discovery-status role="status">${run?.status==="RUNNING"?"正在导入并匹配，可稍后刷新查看结果。":receipt?.error?e(receipt.error):receipt?`上次导入 ${receipt.candidateCount??0} 个候选职位，取得 ${receipt.jdCount??0} 份 JD，完成 ${receipt.matchedCount??0} 份匹配，${receipt.missingJd??0} 份 JD 待补充。${receipt.limited?"已达到本次处理上限。":""}${receipt.mailboxes?.some(m=>!m.complete||m.error)?"部分邮箱读取不完整。":""}`:""}</p><a class="text-link" href="${rootPath}/library">管理求职／面试资料库 →</a></section>`;
}
