/** @returns {HTMLFormElement|null} */
const editor=()=>document.querySelector('form[data-resume-editor]');
/** @type {string|null} */
let previewUrl=null;
document.addEventListener('close',event=>{
  if(!(event.target instanceof HTMLDialogElement)||!event.target.matches('[data-resume-dialog]'))return;
  const frame=event.target.querySelector('iframe');if(frame){frame.removeAttribute('src');frame.hidden=true;}
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
  delete event.target.dataset.ready;
},true);
function changed(){const f=editor();if(!f)return;f.dataset.dirty='true';
  const status=f.querySelector('[data-resume-status]');if(status)status.textContent='有未保存的修改';
  for(const b of f.querySelectorAll('[data-resume-export]'))if(b instanceof HTMLButtonElement)b.disabled=true;
}
document.addEventListener('input',event=>{if(event.target instanceof Element&&event.target.closest('[data-resume-editor]'))changed();});
window.addEventListener('beforeunload',event=>{if(editor()?.dataset.dirty==='true'){event.preventDefault();event.returnValue='';}});
/** @param {HTMLFormElement} form */
function readContent(form){
  const content=JSON.parse(form.dataset.content||'{}');
  content.projects=[];
  for(const field of form.querySelectorAll('[data-resume-field]')){
    if(!(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement)||field.matches(':disabled'))continue;
    const path=(field.dataset.resumeField||'').split('.');
    let parent=content;
    for(const key of path.slice(0,-1)){parent[key]??={};parent=parent[key];}
    const key=path.at(-1)||'';
    if(path[0]==='skills'&&path.length===2){
      const previous=parent[key],combined=previous.name?`${previous.name}: ${previous.content}`:previous.content;
      // Preserve existing split fields exactly when the combined input is untouched.
      if(field.value!==combined){
        const value=field.value.trim(),separator=value.search(/[:：]/u);
        parent[key]=separator<0?{name:'',content:value}:{name:value.slice(0,separator).trim(),content:value.slice(separator+1).trim()};
      }
      continue;
    }
    parent[key]=key==='bullets'||key==='certifications'?field.value.split('\n').map(s=>s.trim()).filter(Boolean):field.value;
  }
  // Removed blocks can leave index gaps; preserve the visible project order.
  content.projects=content.projects.filter(Boolean);
  return content;
}
/** @param {string} path @param {unknown} body */
async function request(path,body){
  const session=await fetch('/api/v1/session',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!session.ok)throw new Error('登录已失效。请保留当前输入，重新登录后再保存。');
  const {csrfToken}=await session.json();
  const response=await fetch('/api/v1/job-search/resume'+path,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrfToken},body:JSON.stringify(body),signal:AbortSignal.timeout(100000)});
  if(!response.ok)throw new Error(response.status===409?'简历已在其他窗口更新，或正在导出。当前输入已保留，请稍后重试；若版本冲突，请保留输入后重新打开页面。':response.status===422?'请检查链接、内容长度和必需区域。当前输入已保留。':'操作未完成，当前输入已保留，请稍后重试。');
  return response;
}
/** @param {HTMLFormElement} form @param {boolean} busy */
function setBusy(form,busy){
  form.dataset.busy=String(busy);
  const fields=form.querySelector('.resume-fields');if(fields instanceof HTMLFieldSetElement)fields.disabled=busy;
  for(const b of form.querySelectorAll('.resume-actions button'))if(b instanceof HTMLButtonElement)b.disabled=busy||(b.hasAttribute('data-resume-export')&&form.dataset.dirty==='true');
  for(const b of document.querySelectorAll('[data-resume-preview], [data-preview-export]'))if(b instanceof HTMLButtonElement)b.disabled=busy||(b.hasAttribute('data-preview-export')&&document.querySelector('[data-resume-dialog]')?.getAttribute('data-ready')!=='true');
}
document.addEventListener('submit',async event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement)||!form.matches('[data-resume-editor]'))return;
  event.preventDefault();if(form.dataset.busy==='true')return;
  const status=form.querySelector('[data-resume-status]');if(!status)return;
  const content=readContent(form);setBusy(form,true);status.textContent='正在保存…';
  try{const response=await request('',{content,expectedVersion:Number(form.dataset.version)});const saved=await response.json();
    form.dataset.version=String(saved.recordVersion);form.dataset.content=JSON.stringify(saved.content);delete form.dataset.dirty;
    status.textContent=`已保存 · 版本 ${saved.recordVersion}`;
  }catch(error){status.textContent=error instanceof Error?error.message:'保存失败，输入已保留。';}
  finally{setBusy(form,false);}
});
document.addEventListener('click',async event=>{
  const button=event.target instanceof Element?event.target.closest('button'):null,form=editor();
  if(button instanceof HTMLButtonElement&&button.matches('[data-preview-close]')){
    const dialog=button.closest('dialog');if(dialog instanceof HTMLDialogElement)dialog.close();return;
  }
  if(!(button instanceof HTMLButtonElement)||!form||button.disabled||form.dataset.busy==='true')return;
  if(button.matches('[data-resume-preview]')){
    if(!form.reportValidity())return;
    const dialog=document.querySelector('[data-resume-dialog]'),frame=dialog?.querySelector('[data-preview-frame]'),status=dialog?.querySelector('[data-preview-status]');
    if(!(dialog instanceof HTMLDialogElement)||!(frame instanceof HTMLIFrameElement)||!status)return;
    const content=readContent(form);delete dialog.dataset.ready;setBusy(form,true);
    status.textContent='正在生成当前内容的排版预览…';frame.hidden=true;dialog.showModal();
    try{
      const response=await request('/preview',{content,version:Number(form.dataset.version)});
      const blob=await response.blob();if(!dialog.open)return;
      previewUrl=URL.createObjectURL(blob);frame.src=previewUrl;frame.hidden=false;dialog.dataset.ready='true';
      status.textContent=form.dataset.dirty==='true'?'包含当前未保存的修改。预览不会保存简历。':'当前已保存简历的实际 PDF 排版。';
    }catch(error){status.textContent=error instanceof Error?error.message:'预览未能生成，请继续调整或稍后重试。';}
    finally{setBusy(form,false);}
  }else if(button.matches('[data-add-project]')){
    const block=form.querySelector('[data-project][hidden]');
    if(block instanceof HTMLFieldSetElement){block.hidden=false;block.disabled=false;block.querySelector('input')?.focus();changed();}
  }else if(button.matches('[data-remove-project]')){
    const block=button.closest('[data-project]');if(block instanceof HTMLFieldSetElement){block.hidden=true;block.disabled=true;changed();}
  }else if(button.dataset.resumeExport||button.dataset.previewExport){
    if(form.dataset.dirty==='true'&&!button.dataset.previewExport)return;
    const draft=button.dataset.previewExport&&form.dataset.dirty==='true'?readContent(form):null;
    const status=button.dataset.previewExport?document.querySelector('[data-preview-status]'):form.querySelector('[data-resume-status]');if(!status)return;
    setBusy(form,true);status.textContent='正在生成文件…';
    try{
      if(draft){
        const saved=await (await request('',{content:draft,expectedVersion:Number(form.dataset.version)})).json();
        form.dataset.version=String(saved.recordVersion);form.dataset.content=JSON.stringify(saved.content);delete form.dataset.dirty;
        const savedStatus=form.querySelector('[data-resume-status]');if(savedStatus)savedStatus.textContent=`已保存 · 版本 ${saved.recordVersion}`;
      }
      const format=button.dataset.resumeExport||button.dataset.previewExport||'pdf',response=await request('/export',{format,version:Number(form.dataset.version)});
      const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`Resume-v${form.dataset.version}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent=`已导出 ${format.toUpperCase()} · 版本 ${form.dataset.version}`;
    }catch(error){status.textContent=error instanceof Error?error.message:'导出失败，请稍后重试。';}
    finally{setBusy(form,false);}
  }
  const add=form.querySelector('[data-add-project]');if(add instanceof HTMLButtonElement)add.disabled=!form.querySelector('[data-project][hidden]');
});
