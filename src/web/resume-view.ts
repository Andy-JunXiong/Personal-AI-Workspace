import type {WorkspaceService} from "../application/workspace-service.js";
import {document,escapeHtml as e} from "./views.js";

function field(label:string,path:string,value:string,rows=0,readonly=false){
  const id=`resume-${path.replaceAll(".","-")}`;
  return `<label for="${id}">${e(label)}${rows?`<textarea id="${id}" data-resume-field="${path}" rows="${rows}" ${readonly?"readonly":""}>${e(value)}</textarea>`
    :`<input id="${id}" data-resume-field="${path}" value="${e(value)}" ${/^projects\.\d+\.name$/u.test(path)?"required":""} ${readonly?"readonly":""} ${path.endsWith(".github")||path.endsWith(".demo")?'type="url"':""}>`}</label>`;
}
const section=(number:number,title:string,content:string)=>`<section class="resume-section" id="region-${number}"><header><span class="resume-number">${number.toString().padStart(2,"0")}</span><h2>${title}</h2></header>${content}</section>`;
export function resumeView(service:WorkspaceService){
  const saved=service.resumeService.get();
  if(!saved)return document("简历",`<header class="page-heading"><div><p class="eyebrow">RESUME STUDIO</p><h1>我的简历</h1><p class="subtitle">尚未导入默认 Word 模板。导入后可在这里编辑、保存和导出。</p></div></header>`,true,"resume");
  const c=saved.content;
  const projects=Array.from({length:5},(_,i)=>{const p=c.projects[i]??{name:"",github:"",demo:"",demoLabel:"Demo",bullets:[]};return `<fieldset class="resume-block" data-project="${i}" ${i>=c.projects.length?"hidden disabled":""}><legend>项目 ${i+1}</legend>${field("项目名称",`projects.${i}.name`,p.name)}<div class="resume-grid">${field("GitHub 地址",`projects.${i}.github`,p.github)}${field("Demo 地址",`projects.${i}.demo`,p.demo)}</div>${field("Demo 链接显示名称",`projects.${i}.demoLabel`,p.demoLabel)}${field("项目内容 · 每行一条",`projects.${i}.bullets`,p.bullets.join("\n"),6)}${i>=3?'<button type="button" class="text-button" data-remove-project>移除此项目</button>':""}</fieldset>`;}).join("");
  const content=section(1,"姓名",field("姓名 · 固定", "name",c.name,0,true))
    +section(2,"职业标题",field("简历第二行", "headline",c.headline))
    +section(3,"联系方式",field("联系方式 · 固定", "contact",c.contact,2,true))
    +section(4,"Professional Summary",field("章节标题", "summaryHeading",c.summaryHeading)+field("个人简介", "summary",c.summary,7))
    +section(5,"Core Skills",field("章节标题", "skillsHeading",c.skillsHeading)+`<p class="muted">每组按“分组名称：内容”填写，冒号前的名称在预览和导出时自动加粗。空白分组不导出。</p>${c.skills.map((s,i)=>`<fieldset class="resume-block"><legend>技能 ${i+1}</legend>${field("技能内容（分组名称：内容）",`skills.${i}`,s.name?`${s.name}: ${s.content}`:s.content,4)}</fieldset>`).join("")}`)
    +section(6,"项目经历",`${field("章节标题", "projectsHeading",c.projectsHeading)}${projects}<button type="button" class="button secondary" data-add-project ${c.projects.length===5?"disabled":""}>＋ 添加项目（最多 5 个）</button>`)
    +section(7,"Professional Experience",field("章节标题", "experienceHeading",c.experienceHeading)+c.experience.map((p,i)=>`<fieldset class="resume-block"><legend>经历 ${i+1}</legend>${field("职位与公司",`experience.${i}.title`,p.title)}<div class="resume-grid">${field("地点",`experience.${i}.location`,p.location)}${field("起止时间",`experience.${i}.dates`,p.dates)}</div>${field("工作概述",`experience.${i}.summary`,p.summary,3)}${field("工作内容 · 每行一条",`experience.${i}.bullets`,p.bullets.join("\n"),7)}</fieldset>`).join(""))
    +section(8,"Certifications",field("章节标题", "certificationsHeading",c.certificationsHeading)+field("认证 · 每行一条", "certifications",c.certifications.join("\n"),4))
    +section(9,"Education",field("章节标题", "educationHeading",c.educationHeading)+c.education.map((p,i)=>`<fieldset class="resume-block"><legend>教育 ${i+1}</legend>${field("学校",`education.${i}.school`,p.school)}<div class="resume-grid">${field("地点",`education.${i}.location`,p.location)}${field("起止时间",`education.${i}.dates`,p.dates)}</div>${field("学位",`education.${i}.degree`,p.degree)}${field("专业",`education.${i}.detail`,p.detail,2)}</fieldset>`).join(""));
  return document("简历编辑",`<header class="page-heading"><div><p class="eyebrow">RESUME STUDIO</p><h1>我的简历</h1><p class="subtitle">逐区编辑，预览排版，保存后导出。</p></div><div class="resume-header-actions"><a class="button secondary" href="${e(saved.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看原始模板 ↗</a><button class="button secondary" type="button" data-resume-preview>Preview · 预览排版</button></div></header>
  <nav class="resume-jump" aria-label="简历区域">${["姓名","标题","联系","简介","技能","项目","经历","认证","教育"].map((t,i)=>`<a href="#region-${i+1}">${i+1}. ${t}</a>`).join("")}</nav>
  <form data-resume-editor data-version="${saved.recordVersion}" data-content="${e(JSON.stringify(c))}"><div class="resume-actions"><button class="button primary" type="submit">保存简历</button><button class="button secondary" type="button" data-resume-export="docx">导出 Word</button><button class="button secondary" type="button" data-resume-export="pdf">导出 PDF</button><p data-resume-status role="status" aria-live="polite">已保存 · 版本 ${saved.recordVersion}</p></div><fieldset class="resume-fields">${content}</fieldset></form>
  <dialog class="resume-preview-dialog" data-resume-dialog aria-labelledby="resume-preview-title"><header><div><h2 id="resume-preview-title">排版预览</h2><p data-preview-status role="status">正在生成预览…</p></div><button class="button secondary" type="button" data-preview-close>继续调整</button></header><iframe title="简历 PDF 排版预览" data-preview-frame hidden></iframe><footer><button class="button primary" type="button" data-preview-export="docx" disabled>保存并导出 Word</button><button class="button secondary" type="button" data-preview-export="pdf" disabled>保存并导出 PDF</button></footer></dialog>`,true,"resume");
}
