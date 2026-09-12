import type { WorkspaceService } from "../application/workspace-service.js";
import { escapeHtml as e, safeExternalUrl } from "./views.js";
import { updateSkillLibraryPrompt, dailyGithubUpdatePrompt } from "./skill-library-prompts.js";

export function skillLibraryPanel(service: WorkspaceService) {
  const data = service.skillLibraryService.read();
  const sourcesById = new Map(service.jobLibraryService.sources().map(s => [s.id, s]));
  const status = { MISSING: "待汇总", INVALID: "需要修复", STALE: "来源有变化，待更新相关内容", CURRENT: "已汇总" }[data.status];
  const sourceLink = (id: string, quote: string) => {
    const source = sourcesById.get(id);
    return `<blockquote>${e(quote)}</blockquote><a href="#source-${e(id)}">${e(source?.title ?? "来源已不可用")} ↓</a>`;
  };
  const handoff = (id: string, title: string, prompt: string, button: string) => `<details><summary>${e(title)}</summary><section class="candidate-chatgpt-handoff" data-chatgpt-handoff><label for="${id}">复制后在 ChatGPT 中通过 @ 选择 Personal AI Workspace</label><textarea id="${id}" data-chatgpt-prompt readonly rows="8">${e(prompt)}</textarea><button type="button" class="button secondary" data-copy-candidate-prompt>${e(button)}</button><p data-chatgpt-copy-status role="status" aria-live="polite"></p></section></details>`;
  const githubForm = (repo?: typeof data.githubProjects[number]) => `<form data-github-project${repo ? ' data-github-registered' : ''} class="library-form">
    <input type="hidden" name="expectedVersion" value="${repo?.recordVersion ?? 0}">
    <label>GitHub 项目地址<input name="repositoryUrl" type="url" required value="${e(repo?.repositoryUrl ?? "")}" placeholder="https://github.com/owner/repository"${repo ? " readonly" : ""}></label>
    <label>用于技能证据的文件（每行一个，最多 8 个）<textarea name="paths" rows="3" required>${e((repo?.paths ?? ["README.md"]).join("\n"))}</textarea></label>
    <button type="submit" class="button secondary">${repo ? "检查项目更新" : "添加并读取项目"}</button><p data-github-result role="status"></p></form>`;
  const skills = `<section class="panel library-panel"><h2>我的技能与项目库</h2><p>${status} · ${data.catalog?.skills.length ?? 0} 项技能与事实 · ${data.catalog?.projects.length ?? 0} 个项目</p>
    <p>所有职位共用这份技能库。平时分析 JD 直接读取；新增资料、补充经历或纠正事实时，再更新受影响内容。资料不足保留未知。</p>
    ${(data.catalog?.skills ?? []).map(skill => `<details class="library-source"><summary>${e(skill.name)} · ${{ SUPPORTED: "有资料支持", UNKNOWN: "未知", CONFLICT: "来源冲突" }[skill.status]}${data.staleSkillIds.includes(skill.id) ? " · 证据已更新" : ""}</summary><p>${e(skill.summary)}</p><p>别名：${e(skill.aliases.join("、") || "—")}</p><p>项目：${e(skill.projectIds.map(id => data.catalog?.projects.find(p => p.id === id)?.name ?? id).join("、") || "未关联")}</p>${skill.evidence.map(ref => sourceLink(ref.sourceId, ref.quote)).join("")}</details>`).join("")}
    ${(data.catalog?.projects ?? []).map(project => `<details class="library-source"><summary>项目 · ${e(project.name)}</summary><p>${e(project.contribution)}</p>${project.evidence.map(ref => sourceLink(ref.sourceId, ref.quote)).join("")}</details>`).join("")}
    ${data.catalog?.limitations.length ? `<details><summary>待核对与范围限制</summary><ul>${data.catalog.limitations.map(t => `<li>${e(t)}</li>`).join("")}</ul></details>` : ""}
    ${handoff("skill-library-prompt", data.catalog ? "更新技能库 · 新增资料或纠正信息时使用" : "首次汇总技能库", updateSkillLibraryPrompt, data.catalog ? "复制技能更新指令" : "复制汇总指令")}
    </section>`;
  return `<section class="panel library-panel" data-github-panel><h2>GitHub 项目与更新</h2><p>每天检查一次项目更新，供多个 JD 共用。有变化才读取选定文件；没有变化直接复用。仅支持公开仓库，不会执行仓库代码。</p>
    ${data.githubProjects.map(repo => `<details class="library-source" id="source-${e(repo.sourceId)}"><summary>${e(repo.repositoryUrl ?? "GitHub 项目")} · ${repo.lastCheck?.status === "FAILED" ? "检查失败" : repo.lastCheck?.status === "UNCHANGED" ? "没有变化" : repo.lastCheck?.status === "UPDATED" ? "项目证据已更新" : "待检查"}</summary><p>已保存 commit：${e(repo.commit ?? "未知")}</p><p>证据保存时间：${e(repo.capturedAt)}</p><p>最近检查：${e(repo.lastCheck?.checkedAt ?? "未检查")}</p>${repo.lastCheck?.failure ? `<p>${e(repo.lastCheck.failure)}</p>` : ""}${repo.repositoryUrl && safeExternalUrl(repo.repositoryUrl) ? `<a href="${e(repo.repositoryUrl)}" target="_blank" rel="noopener noreferrer">打开项目 ↗</a>` : ""}${githubForm(repo)}</details>`).join("") || "<p>尚未登记 GitHub 项目。</p>"}
    <div><button type="button" class="button secondary" data-github-check-all${data.githubProjects.length ? "" : " disabled"}>检查全部项目更新</button><p data-github-all-result role="status" aria-live="polite"></p></div>
    <p>检查按钮保存项目证据。有变化时，再用下方指令让 ChatGPT 更新相关技能；已有技能会保留。</p>
    ${handoff("github-update-prompt", "在 ChatGPT 中检查项目并更新相关技能", dailyGithubUpdatePrompt, "复制项目更新指令")}
    <details><summary>添加 GitHub 项目</summary>${githubForm()}</details></section>${skills}`;
}
