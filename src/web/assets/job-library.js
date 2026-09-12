// Delegation survives the Workspace's partial page refreshes.
let githubCheckRunning = false;
/** @param {HTMLFormElement} form */
async function checkGithubForm(form) {
  const data = new FormData(form);
  const body = { repositoryUrl: String(data.get('repositoryUrl')).trim(), expectedVersion: Number(data.get('expectedVersion')),
    paths: String(data.get('paths')).split(/\r?\n/).map(s => s.trim()).filter(Boolean), idempotencyKey: crypto.randomUUID() };
  const session = await fetch('/api/v1/session', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!session.ok) throw new Error('请重新登录后再操作。');
  const { csrfToken } = await session.json();
  const response = await fetch('/api/v1/job-search/library/github-projects/refresh', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(response.status === 409 ? '来源版本已变化，请刷新页面后再试。' : '未能保存项目，请检查地址和文件路径。');
  const result = await response.json();
  const version = form.elements.namedItem('expectedVersion');
  if (version instanceof HTMLInputElement) version.value = String(result.recordVersion);
  return result;
}

document.addEventListener('click', async event => {
  const button = event.target instanceof Element ? event.target.closest('[data-github-check-all]') : null;
  if (!(button instanceof HTMLButtonElement) || button.disabled || githubCheckRunning) return;
  const panel = button.closest('[data-github-panel]'), status = panel?.querySelector('[data-github-all-result]');
  if (!(panel instanceof HTMLElement) || !(status instanceof HTMLElement)) return;
  const forms = Array.from(panel.querySelectorAll('form[data-github-registered]')).filter(f => f instanceof HTMLFormElement);
  if (!forms.length || forms.some(f => !f.reportValidity())) return;
  githubCheckRunning = true; button.disabled = true;
  let updated = 0, unchanged = 0, failed = 0;
  try {
    for (const [index, form] of forms.entries()) {
      status.textContent = `正在检查 ${index + 1}/${forms.length} 个项目…`;
      const resultLabel = form.querySelector('[data-github-result]');
      try {
        const result = await checkGithubForm(form);
        if (result.status === 'UPDATED') updated++;
        else if (result.status === 'UNCHANGED') unchanged++;
        else failed++;
        if (resultLabel instanceof HTMLElement) resultLabel.textContent = result.status === 'FAILED'
          ? `检查失败，旧证据保留。${result.failure || ''}` : `${result.status === 'UPDATED' ? '项目证据已更新，待同步相关技能' : '没有变化'} · ${result.checkedAt}`;
      } catch (error) {
        failed++;
        if (resultLabel instanceof HTMLElement) resultLabel.textContent = error instanceof Error ? error.message : '未能确认检查结果。';
      }
    }
    status.textContent = `已完成：${updated} 个更新，${unchanged} 个未变，${failed} 个失败。${updated ? '请使用下方项目更新指令同步相关技能。' : '无需重复汇总未变资料。'} 刷新页面可查看已保存的最新状态。`;
  } finally { githubCheckRunning = false; button.disabled = false; }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches('[data-github-project]')) return;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]'), status = form.querySelector('[data-github-result]');
  if (!(button instanceof HTMLButtonElement) || !(status instanceof HTMLElement) || button.disabled || githubCheckRunning) return;
  githubCheckRunning = true; button.disabled = true; status.textContent = '正在检查 GitHub 项目…';
  try {
    const result = await checkGithubForm(form);
    if (result.status === 'FAILED') { status.textContent = `本次检查失败，旧证据保留。${result.failure || ''}`; return; }
    location.reload();
  } catch (error) { status.textContent = error instanceof Error ? error.message : '检查失败，旧证据保留。'; }
  finally { githubCheckRunning = false; button.disabled = false; }
});

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
