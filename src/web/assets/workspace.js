// Progressive enhancement: normal links and GET forms also work without JS.
const main = /** @type {HTMLElement} */ (document.querySelector('#main'));
const notice = /** @type {HTMLElement} */ (document.querySelector('#notice'));
let dirty = false;
let loggingOut = false;
let completing = false;
let deciding = false;
let linking = false;
const completionIntents = new Map();
const decisionIntents = new Map();
const linkIntents = new Map();
/** @type {AbortController | undefined} */
let pending;

/** @param {string} message */
function announce(message) {
  notice.textContent = message;
  notice.hidden = !message;
}
function firstPageUrl() {
  const url = new URL(location.href);
  url.searchParams.delete('cursor');
  return url;
}
/** @param {Document} page */
function signedOut(page) {
  pending?.abort();
  main.replaceChildren(...(page.querySelector('#main')?.childNodes ?? []));
  document.body.dataset.authenticated = 'false';
  document.querySelector('[data-logout]')?.remove();
  dirty = false;
  announce('登录已失效，请重新登录后继续。');
}
/** @param {HTMLButtonElement} control */
async function completeTask(control) {
  if (completing || !navigator.onLine) {
    if (!navigator.onLine) announce('网络已断开，联网后再完成任务。');
    return;
  }
  const taskId = control.dataset.taskId;
  const expectedRecordVersion = Number(control.dataset.recordVersion);
  if (!taskId || !Number.isInteger(expectedRecordVersion)) return;
  const intentSlot = `${taskId}:${expectedRecordVersion}`;
  const intentKey = completionIntents.get(intentSlot) ?? crypto.randomUUID();
  completionIntents.set(intentSlot, intentKey);
  completing = true;
  control.disabled = true;
  control.setAttribute('aria-busy', 'true');
  announce('正在完成任务…');
  try {
    const session = await fetch('/api/v1/session', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (session.status === 401) { main.replaceChildren(); location.replace(location.pathname); return; }
    if (!session.ok) throw new Error('session unavailable');
    const { csrfToken } = await session.json();
    const response = await fetch(`/api/v1/job-search/tasks/${encodeURIComponent(taskId)}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ expectedRecordVersion, intentKey }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) { main.replaceChildren(); location.replace(location.pathname); return; }
    if (response.status === 409) {
      completionIntents.delete(intentSlot);
      announce('任务已在别处更新，正在读取最新状态。');
      await readPage(firstPageUrl());
      return;
    }
    if (response.status === 422) {
      completionIntents.delete(intentSlot);
      announce('当前状态不允许完成，正在读取最新状态。');
      await readPage(firstPageUrl());
      return;
    }
    if (!response.ok) throw new Error('completion unavailable');
    completionIntents.delete(intentSlot);
    await readPage(firstPageUrl());
    announce('任务已完成。');
  } catch {
    announce('尚未确认完成结果。请重试同一操作，或刷新查看最新状态。');
  } finally {
    completing = false;
    if (control.isConnected) {
      control.disabled = !navigator.onLine;
      control.removeAttribute('aria-busy');
    }
  }
}
/** @param {HTMLButtonElement} control */
async function decideCandidate(control) {
  if (deciding || !navigator.onLine) {
    if (!navigator.onLine) announce('网络已断开，联网后再修改决策。');
    return;
  }
  const candidateId = control.dataset.candidateId;
  const action = control.dataset.action;
  const expectedRecordVersion = Number(control.dataset.recordVersion);
  if (!candidateId || !action || !Number.isInteger(expectedRecordVersion)) return;
  const intentSlot = `${candidateId}:${action}:${expectedRecordVersion}`;
  const intentKey = decisionIntents.get(intentSlot) ?? crypto.randomUUID();
  decisionIntents.set(intentSlot, intentKey);
  deciding = true;
  control.disabled = true;
  control.setAttribute('aria-busy', 'true');
  announce('正在保存决策…');
  try {
    const session = await fetch('/api/v1/session', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (session.status === 401) { main.replaceChildren(); location.replace(location.pathname); return; }
    if (!session.ok) throw new Error('session unavailable');
    const { csrfToken } = await session.json();
    const response = await fetch(`/api/v1/job-search/${control.hasAttribute('data-library-decision') ? 'library/' : ''}candidates/${encodeURIComponent(candidateId)}/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ action, expectedRecordVersion, intentKey }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) { main.replaceChildren(); location.replace(location.pathname); return; }
    if (response.status === 409 || response.status === 422) {
      decisionIntents.delete(intentSlot);
      announce('决策已在别处更新，正在读取最新状态。');
      await readPage(firstPageUrl());
      return;
    }
    if (!response.ok) throw new Error('decision unavailable');
    decisionIntents.delete(intentSlot);
    await readPage(firstPageUrl());
    announce('决策已保存。');
  } catch {
    announce('尚未确认保存结果。请重试同一操作，或刷新查看最新状态。');
  } finally {
    deciding = false;
    if (control.isConnected) {
      control.disabled = !navigator.onLine;
      control.removeAttribute('aria-busy');
    }
  }
}
/** @param {HTMLButtonElement} control */
async function linkCandidate(control) {
  if (linking || !navigator.onLine) {
    if (!navigator.onLine) announce('网络已断开，联网后再关联申请。');
    return;
  }
  const candidateId = control.dataset.candidateId;
  const select = /** @type {HTMLSelectElement | null} */ (main.querySelector('[data-link-target]'));
  const projectId = select?.value;
  if (!candidateId || !projectId) return;
  const intentSlot = `${candidateId}:${projectId}`;
  const intentKey = linkIntents.get(intentSlot) ?? crypto.randomUUID();
  linkIntents.set(intentSlot, intentKey);
  linking = true;
  control.disabled = true;
  control.setAttribute('aria-busy', 'true');
  announce('正在关联申请…');
  try {
    const session = await fetch('/api/v1/session', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (session.status === 401) { main.replaceChildren(); location.replace(location.pathname); return; }
    if (!session.ok) throw new Error('session unavailable');
    const { csrfToken } = await session.json();
    const response = await fetch(`/api/v1/job-search/candidates/${encodeURIComponent(candidateId)}/link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ projectId, intentKey }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) { main.replaceChildren(); location.replace(location.pathname); return; }
    if (response.status === 409 || response.status === 422) {
      linkIntents.delete(intentSlot);
      announce('关联未能完成，正在读取最新状态。');
      await readPage(firstPageUrl());
      return;
    }
    if (!response.ok) throw new Error('link unavailable');
    linkIntents.delete(intentSlot);
    await readPage(firstPageUrl());
    announce('已关联申请。');
  } catch {
    announce('尚未确认关联结果。请重试同一操作，或刷新查看最新状态。');
  } finally {
    linking = false;
    if (control.isConnected) {
      control.disabled = !navigator.onLine;
      control.removeAttribute('aria-busy');
    }
  }
}
/** @param {URL} url @param {boolean} [append] */
async function readPage(url, append = false) {
  if (loggingOut || document.body.dataset.authenticated !== 'true') return;
  pending?.abort();
  const controller = new AbortController();
  pending = controller;
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), 15000);
  main.setAttribute('aria-busy', 'true');
  announce('正在读取最新状态…');
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', headers: { accept: 'text/html' } });
    const html = await response.text();
    if (pending !== controller || loggingOut) return;
    const page = new DOMParser().parseFromString(html, 'text/html');
    if (response.status === 401) { signedOut(page); return; }
    if (response.status === 409) {
      announce('列表已更新或分页已过期。请点击“刷新状态”从第一页重新读取。');
      return;
    }
    const nextMain = page.querySelector('#main');
    if (!response.ok || !nextMain) throw new Error('read failed');
    if (append) {
      const items = main.querySelector('[data-page-items]');
      const nextItems = page.querySelector('[data-page-items]');
      const pagination = page.querySelector('[data-pagination]');
      if (!items || !nextItems || !pagination) throw new Error('Invalid page');
      items.append(...nextItems.children);
      main.querySelector('[data-pagination]')?.replaceWith(pagination);
      const note = pagination.querySelector('p');
      if (note) note.textContent = `共 ${pagination.getAttribute('data-total')} 项 · 本页已加载 ${items.children.length} 项`;
      // Keep the first-page URL so a reload obtains a fresh, coherent list.
    } else {
      main.replaceChildren(...nextMain.childNodes);
      history.replaceState(null, '', url);
      document.title = page.title;
      dirty = false;
      void gmailBatch();
    }
    announce(append ? '已加载更多记录。' : '已读取最新状态。');
  } catch (error) {
    if (pending !== controller || loggingOut) return;
    announce(navigator.onLine ? '暂时无法读取，当前内容可能已过时。请稍后刷新重试。' : '网络已断开，当前内容可能已过时。联网后可刷新。');
  } finally {
    clearTimeout(timeout);
    if (pending === controller) { main.removeAttribute('aria-busy'); pending = undefined; }
  }
}

let gmailBusy = false;
let batchPolling = false;
let batchStarting = false;
/** @param {boolean} [start] */
async function gmailBatch(start = false) {
  if (loggingOut || !main.querySelector('[data-gmail-batch]')) return;
  if (start && batchStarting) return;
  if (!start && batchPolling) return;
  const endpoint = '/api/v1/gmail/check-all';
  const status = (/** @type {string} */ text) => {
    const node = main.querySelector('[data-gmail-batch-status]');
    if (node) node.textContent = text;
  };
  try {
    if (start) {
      batchStarting = true;
      const session = await fetch('/api/v1/session', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (session.status === 401) { location.reload(); return; }
      if (!session.ok) throw new Error();
      const { csrfToken } = await session.json();
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: '{}', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error();
      status('已开始检查进行中的岗位。');
    }
    if (batchPolling) return;
    batchPolling = true;
    do {
      if (loggingOut || !main.querySelector('[data-gmail-batch]')) return;
      const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (response.status === 401) { location.reload(); return; }
      if (!response.ok) throw new Error();
      const { batch } = await response.json();
      if (!batch) { status('尚未发起批量检查。'); return; }
      const results = /** @type {{projectId:string,company:string,role:string,outcome:string}[]} */ (batch.results);
      const updated = results.filter(r => r.outcome === 'UPDATED').length;
      const unresolved = results.filter(r => r.outcome === 'FAILED' || r.outcome === 'PARTIAL').length;
      status(`${batch.state === 'RUNNING' ? '正在检查' : batch.state === 'DONE' ? '本批检查结束' : '批量检查中断'}：${results.length}/${batch.total} · 有新增邮件 ${updated} · 未完成或失败 ${unresolved} · 发起于 ${new Date(batch.startedAt).toLocaleString()}`);
      const list = main.querySelector('[data-gmail-batch-results]');
      if (list) {
        const labels = /** @type {Record<string,string>} */ ({ UPDATED: '发现新增邮件', NO_UPDATE: '无新增邮件', PARTIAL: '检查不完整', FAILED: '检查失败', SKIPPED: '已停止追踪，跳过' });
        list.replaceChildren(...results.map(r => {
          const row = document.createElement('p'), link = document.createElement('a');
          link.href = `/workspace/job-search/applications/${encodeURIComponent(r.projectId)}`;
          link.textContent = `${r.company} · ${r.role}：${labels[r.outcome] ?? '检查未完成'}`;
          row.append(link); return row;
        }));
      }
      const button = main.querySelector('[data-gmail-check-all]');
      if (button instanceof HTMLButtonElement) button.disabled = batch.state === 'RUNNING';
      if (batch.state !== 'RUNNING') return;
      await new Promise(resolve => setTimeout(resolve, 3000));
    } while (true);
  } catch { status('暂时无法读取批量进度，后台可能仍在检查。刷新页面后可继续查看，不代表没有更新。'); }
  finally { batchStarting = false; batchPolling = false; }
}
void gmailBatch();
/** @param {HTMLButtonElement} control */
async function gmailAction(control) {
  if (gmailBusy) return;
  const panel = control.closest('[data-gmail-panel]');
  const projectId = panel?.getAttribute('data-project-id');
  if (!projectId) return;
  gmailBusy = true;
  const action = control.getAttribute('data-gmail-action');
  const message = (/** @type {string} */ text) => {
    announce(text);
    const status = document.querySelector('[data-gmail-status]');
    if (status) status.textContent = text;
  };
  control.disabled = true;
  try {
    const session = await fetch('/api/v1/session', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (session.status === 401) { location.reload(); return; }
    if (!session.ok) throw new Error('session unavailable');
    const { csrfToken } = await session.json();
    const endpoint = `/api/v1/gmail/applications/${encodeURIComponent(projectId)}/check`;
    const response = await fetch(action === 'check' ? endpoint : `/api/v1/gmail/${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(action === 'check' ? {} : { slot: Number(control.getAttribute('data-slot')),
        ...(action === 'connect' ? { projectId } : {}) }), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Gmail operation failed');
    if (action === 'connect') { const { url } = await response.json(); location.assign(url); return; }
    if (action === 'disconnect') { await readPage(firstPageUrl()); return; }
    const started = await response.json();
    message('正在检查两个邮箱，完成后会自动显示结果。');
    for (let attempt = 0; attempt < 100; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (loggingOut) return;
      const result = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (result.status === 401) { location.reload(); return; }
      if (!result.ok) throw new Error('Cannot read check status');
      const { run } = await result.json();
      if (!run || run.id !== started.id || run.state === 'FAILED') throw new Error('Check result unavailable');
      if (run.state === 'DONE') {
        await readPage(firstPageUrl());
        message('本次检查结果已保存，请查看下方结果和检查时间。');
        return;
      }
    }
    throw new Error('Check timeout');
  } catch {
    message('暂时无法确认检查结果。请刷新查看最新检查时间，或稍后重试；这不代表没有新邮件。');
  } finally { gmailBusy = false; control.disabled = false; }
}

document.addEventListener('input', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-filter-form]')) {
    dirty = true;
    // A foreground read must never replace a filter draft being edited.
    pending?.abort(); pending = undefined;
    main.removeAttribute('aria-busy');
    announce('筛选条件尚未应用。点击筛选按钮查看结果。');
  }
});
document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches('[data-filter-form]')) return;
  event.preventDefault();
  const url = new URL(location.pathname, location.origin);
  for (const [key, value] of new FormData(form)) if (typeof value === 'string' && value) url.searchParams.set(key, value);
  void readPage(url);
});

document.addEventListener('click', async (event) => {
  if (!(event.target instanceof Element)) return;
  const control = event.target.closest('button, a');
  if (!control) return;
  if (control instanceof HTMLButtonElement && control.matches('[data-gmail-check-all]')) {
    await gmailBatch(true);
  } else if (control instanceof HTMLButtonElement && control.matches('[data-gmail-action]')) {
    await gmailAction(control);
  } else if (control instanceof HTMLButtonElement && control.matches('[data-complete-task]')) {
    await completeTask(control);
  } else if (control instanceof HTMLButtonElement && control.matches('[data-decide-candidate]')) {
    await decideCandidate(control);
  } else if (control instanceof HTMLButtonElement && control.matches('[data-link-candidate]')) {
    await linkCandidate(control);
  } else if (control.matches('[data-refresh]')) {
    if (dirty) { announce('请先应用筛选条件，再刷新状态。'); return; }
    void readPage(firstPageUrl());
  } else if (control instanceof HTMLAnchorElement && control.matches('[data-more]')) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (dirty) { announce('请先应用筛选条件，再加载更多。'); return; }
    void readPage(new URL(control.href), true);
  } else if (control.matches('[data-copy]')) {
    const reference = /** @type {HTMLTextAreaElement | null} */ (main.querySelector('#context-reference'));
    if (!reference) return;
    try { await navigator.clipboard.writeText(reference.value); announce('已复制引用，可粘贴到 ChatGPT 继续。'); }
    catch { reference.focus(); reference.select(); announce('请手动复制已选中的引用。'); }
  } else if (control instanceof HTMLButtonElement && control.matches('[data-logout]')) {
    loggingOut = true; pending?.abort(); control.disabled = true;
    try {
      const session = await fetch('/api/v1/session', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (session.status !== 401) {
        if (!session.ok) throw new Error('session unavailable');
        const { csrfToken } = await session.json();
        const response = await fetch('/auth/logout', { method: 'POST', headers: { 'x-csrf-token': csrfToken }, signal: AbortSignal.timeout(15000) });
        if (!response.ok && response.status !== 401) throw new Error('logout failed');
      }
      main.replaceChildren();
      location.replace(location.pathname);
    } catch { loggingOut = false; control.disabled = false; announce('暂时无法退出登录，请联网后重试。'); }
  }
});
async function resume() {
  if (document.querySelector("[data-resume-editor]")) return;
  void gmailBatch();
  if (!dirty) { void readPage(firstPageUrl()); return; }
  announce('筛选条件尚未应用，已保留你的输入。应用筛选后会读取最新状态。');
  // Validate identity even when preserving an unfinished filter draft.
  try {
    const response = await fetch('/api/v1/session', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (response.status === 401) { main.replaceChildren(); location.replace(location.pathname); }
  } catch { announce('暂时无法验证登录，已保留筛选输入。请联网后重试。'); }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void resume();
  }
});
window.addEventListener('offline', () => {
  for (const control of document.querySelectorAll('[data-complete-task], [data-decide-candidate], [data-link-candidate]')) {
    if (control instanceof HTMLButtonElement) control.disabled = true;
  }
  announce('网络已断开，当前内容可能已过时。联网后可刷新。');
});
window.addEventListener('online', () => {
  for (const control of document.querySelectorAll('[data-complete-task], [data-decide-candidate], [data-link-candidate]')) {
    if (control instanceof HTMLButtonElement) control.disabled = false;
  }
  void resume();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) { main.replaceChildren(); location.reload(); }
});
