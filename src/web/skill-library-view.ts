import type { WorkspaceService } from "../application/workspace-service.js";
import { escapeHtml as e, safeExternalUrl } from "./views.js";

export function skillLibraryPanel(service: WorkspaceService) {
  const data = service.skillLibraryService.read();
  const sourcesById = new Map(service.jobLibraryService.sources().map(s => [s.id, s]));
  const status = { MISSING: "待汇总", INVALID: "需要重新汇总", STALE: "来源已更新，待重新汇总", CURRENT: "已汇总" }[data.status];
  const sourceLink = (id: string, quote: string) => {
    const source = sourcesById.get(id);
    return `<blockquote>${e(quote)}</blockquote><a href="#source-${e(id)}">${e(source?.title ?? "来源已不可用")} ↓</a>`;
  };
  const prompt = `请使用 Personal AI Workspace 更新我的技能与项目库。本消息授权保存有依据的资料汇总和 GitHub 项目检查，不确认未知个人事实。
先调用 workspace_get_skill_library，分页读取来源目录并按 sourceIds 取得相关上传简历、Drive 文档及已确认事实全文。若我提供新的文档或 Drive 链接，先用对应读取工具取得真实正文，再用 workspace_record_skill_source 保存；不要只依赖对话记忆。
逐个调用 workspace_refresh_github_project 检查已登记的 GitHub 项目，使用最新 recordVersion、原有 paths 和本次新 idempotencyKey。未变 commit 可复用证据；失败必须报告上次检查时间，不能声称已更新。只审阅选定文件，项目技术栈不是个人贡献、熟练程度或 commercial SWE 年限的证明。
按技能与项目合并重复资料，保留稳定 ID、别名、使用场景、具体贡献（不清楚则 UNKNOWN）、来源冲突和待确认问题。学历与经历事实单独分类；约 6.1 年岗位跨度不能变成 SWE 年限或上限。
读取最新工具 schema，用 workspace_record_skill_library 保存完整 catalog：reviewedSources 列出实际审阅的全部当前有效来源及版本/hash，每条 SUPPORTED 技能及项目引用原文、sourceId、recordVersion、hash；UNKNOWN/CONFLICT 不伪装成满足。保留仍有效条目，不把本次未读资料当作不存在。未完成来源审阅时说明阻塞，不虚报覆盖。保存后读回，汇报技能、项目数量、缺失来源和待核对事项。`;
  const githubForm = (repo?: typeof data.githubProjects[number]) => `<form data-github-project class="library-form">
    <input type="hidden" name="expectedVersion" value="${repo?.recordVersion ?? 0}">
    <label>GitHub 项目地址<input name="repositoryUrl" type="url" required value="${e(repo?.repositoryUrl ?? "")}" placeholder="https://github.com/owner/repository"${repo ? " readonly" : ""}></label>
    <label>用于技能证据的文件（每行一个，最多 8 个）<textarea name="paths" rows="3" required>${e((repo?.paths ?? ["README.md"]).join("\n"))}</textarea></label>
    <button type="submit" class="button secondary">${repo ? "检查项目更新" : "添加并读取项目"}</button><p data-github-result role="status"></p></form>`;
  return `<section class="panel library-panel"><h2>技能与项目库</h2><p>${status} · ${data.catalog?.skills.length ?? 0} 项技能与事实 · ${data.catalog?.projects.length ?? 0} 个项目</p>
    <p>从上传资料、Google Drive 文档和项目证据汇总，供每个 JD 逐项匹配。资料不足保留未知；汇总不等于个人事实已确认。</p>
    <details><summary>在 ChatGPT 中汇总或更新技能库</summary><section class="candidate-chatgpt-handoff" data-chatgpt-handoff><label for="skill-library-prompt">复制后在 ChatGPT 中通过 @ 选择 Personal AI Workspace</label><textarea id="skill-library-prompt" data-chatgpt-prompt readonly rows="8">${e(prompt)}</textarea><button type="button" class="button secondary" data-copy-candidate-prompt>复制汇总指令</button><p data-chatgpt-copy-status role="status" aria-live="polite"></p></section></details>
    ${(data.catalog?.skills ?? []).map(skill => `<details class="library-source"><summary>${e(skill.name)} · ${{ SUPPORTED: "有资料支持", UNKNOWN: "未知", CONFLICT: "来源冲突" }[skill.status]}${data.staleSkillIds.includes(skill.id) ? " · 证据已更新" : ""}</summary><p>${e(skill.summary)}</p><p>别名：${e(skill.aliases.join("、") || "—")}</p><p>项目：${e(skill.projectIds.map(id => data.catalog?.projects.find(p => p.id === id)?.name ?? id).join("、") || "未关联")}</p>${skill.evidence.map(ref => sourceLink(ref.sourceId, ref.quote)).join("")}</details>`).join("")}
    ${(data.catalog?.projects ?? []).map(project => `<details class="library-source"><summary>项目 · ${e(project.name)}</summary><p>${e(project.contribution)}</p>${project.evidence.map(ref => sourceLink(ref.sourceId, ref.quote)).join("")}</details>`).join("")}
    ${data.catalog?.limitations.length ? `<details><summary>待核对与范围限制</summary><ul>${data.catalog.limitations.map(t => `<li>${e(t)}</li>`).join("")}</ul></details>` : ""}
    </section><section class="panel library-panel"><h2>GitHub 项目来源</h2><p>每次分析前检查默认分支的最新 commit；有变化时读取选定文件并重新汇总相关技能。仅支持可公开读取的仓库；无法读取时保留原证据并报告失败。不会执行仓库代码。</p>
    ${data.githubProjects.map(repo => `<details class="library-source" id="source-${e(repo.sourceId)}"><summary>${e(repo.repositoryUrl ?? "GitHub 项目")} · ${repo.lastCheck?.status === "FAILED" ? "本次更新失败" : "已登记"}</summary><p>已保存 commit：${e(repo.commit ?? "未知")}</p><p>证据保存时间：${e(repo.capturedAt)}</p><p>上次检查：${e(repo.lastCheck?.checkedAt ?? "未检查")}</p>${repo.lastCheck?.failure ? `<p>${e(repo.lastCheck.failure)}</p>` : ""}${repo.repositoryUrl && safeExternalUrl(repo.repositoryUrl) ? `<a href="${e(repo.repositoryUrl)}" target="_blank" rel="noopener noreferrer">打开项目 ↗</a>` : ""}${githubForm(repo)}</details>`).join("")}
    <details><summary>添加 GitHub 项目</summary>${githubForm()}</details></section>`;
}
