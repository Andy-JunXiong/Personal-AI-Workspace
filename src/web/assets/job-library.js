// Delegation survives the Workspace's partial page refreshes.
document.addEventListener('click', async (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-screening-override]') : null;
  if (!(button instanceof HTMLButtonElement) || button.disabled) return;
  const status = button.parentElement?.querySelector('[data-screening-result]');
  if (!(status instanceof HTMLElement)) return;
  button.disabled = true; status.textContent = '正在保存你的选择…';
  button.dataset.intentKey ||= crypto.randomUUID();
  const body = { mode: button.dataset.mode, expectedCandidateVersion: Number(button.dataset.candidateVersion),
    expectedScreeningVersion: Number(button.dataset.screeningVersion), expectedOverrideVersion: Number(button.dataset.overrideVersion),
    intentKey: button.dataset.intentKey };
  try {
    const session = await fetch('/api/v1/session', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!session.ok) throw new Error('请重新登录后再保存。');
    const { csrfToken } = await session.json();
    const response = await fetch(`/api/v1/job-search/library/candidates/${encodeURIComponent(button.dataset.candidateId || '')}/screening-override`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(response.status === 409 ? '职位或筛选结果已变化，请刷新后重新选择。' : '未能确认保存成功，请稍后重试。');
    location.reload();
  } catch (error) { status.textContent = error instanceof Error ? error.message : '保存失败，请稍后重试。'; }
  finally { button.disabled = false; }
});

document.addEventListener('click', async (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-copy-candidate-prompt]') : null;
  if (!(button instanceof HTMLButtonElement) || button.disabled) return;
  const panel = button.closest('[data-chatgpt-handoff]');
  const prompt = panel?.querySelector('[data-chatgpt-prompt]');
  const status = panel?.querySelector('[data-chatgpt-copy-status]');
  if (!(prompt instanceof HTMLTextAreaElement) || !(status instanceof HTMLElement)) return;
  button.disabled = true;
  try {
    await navigator.clipboard.writeText(prompt.value);
    status.textContent = '已复制。请粘贴到 ChatGPT，并通过 @ 选择 Personal AI Workspace。';
  } catch {
    prompt.focus(); prompt.select();
    status.textContent = '未能自动复制，已选中指令，请手动复制。';
  } finally { button.disabled = false; }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches('[data-library-source], [data-library-compare], [data-library-draft], [data-library-jd]')) return;
  event.preventDefault();
  if (form.dataset.busy) return;
  const status = form.querySelector('[data-library-result]');
  const button = form.querySelector('button');
  if (!(status instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return;
  const values = Object.fromEntries(new FormData(form));
  let path = '/api/v1/job-search/library/sources';
  /** @type {Record<string, unknown>} */
  let body;
  if (form.matches('[data-library-source]')) body = {...values, sourceKey: values.sourceKey || `manual:${crypto.randomUUID()}`, sourceUrl: values.sourceUrl || null, expectedVersion: Number(values.expectedVersion)};
  else if (form.matches('[data-library-compare], [data-library-jd]')) {
    path = `/api/v1/job-search/library/candidates/${encodeURIComponent(form.dataset.candidateId || '')}/${form.matches('[data-library-jd]')?'description':'compare'}`;
    body = {...values, sourceUrl: values.sourceUrl || null};
  } else {
    path = `/api/v1/job-search/library/candidates/${encodeURIComponent(form.dataset.candidateId || '')}/draft`;
    body = values;
  }
  form.dataset.busy = 'true'; button.disabled = true;
  status.textContent = form.matches('[data-library-compare]') ? '正在逐项对比资料，可能需要一两分钟…' : '正在保存…';
  try {
    const session = await fetch('/api/v1/session', {cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!session.ok) throw new Error('登录已失效，请重新登录。正文仍保留在当前页面。');
    const {csrfToken} = await session.json();
    const response = await fetch(path, {method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrfToken},body:JSON.stringify(body),signal:AbortSignal.timeout(135000)});
    if (!response.ok) throw new Error(response.status === 409 ? '资料已更新或正在匹配。请保留当前内容，刷新后重试。' : response.status === 422 ? '请检查完整 JD、资料长度和匹配服务配置。' : '本次操作未能确认成功。当前输入已保留，请稍后重试。');
    status.textContent = '已保存。正在显示最新结果…';
    location.reload();
  } catch (error) { status.textContent = error instanceof Error ? error.message : '操作失败，当前输入已保留。'; }
  finally { delete form.dataset.busy; button.disabled = false; }
});

document.addEventListener('click', async (event) => {
  const button=event.target instanceof Element?event.target.closest('[data-discover-jobs]'):null;
  const status=document.querySelector('[data-discovery-status]');
  if(!(button instanceof HTMLButtonElement)||!(status instanceof HTMLElement)||button.disabled)return;
  button.disabled=true;status.textContent='正在同步 Job Alert…';
  try{
    const session=await fetch('/api/v1/session',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!session.ok)throw new Error('请重新登录后同步。');
    const {csrfToken}=await session.json();
    const response=await fetch('/api/v1/job-search/library/discovery',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrfToken},body:'{}',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('无法开始同步，请检查邮箱连接后重试。');
    status.textContent='同步已开始。正在读取候选职位，完成后会显示结果。';
    for(let i=0;i<180&&status.isConnected;i++){
      await new Promise(resolve=>setTimeout(resolve,5000));
      const checked=await fetch('/api/v1/job-search/library/discovery',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!checked.ok)throw new Error('暂时无法读取同步结果，请稍后刷新。');
      const {run}=await checked.json();
      if(run?.status!=='RUNNING'){location.reload();return;}
    }
    status.textContent='同步仍在进行，请稍后刷新查看。';
  }catch(error){status.textContent=error instanceof Error?error.message:'同步失败，请稍后重试。';}
  finally{button.disabled=false;}
});
