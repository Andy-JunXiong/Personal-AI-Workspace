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
    const response = await fetch(`/api/v1/job-search/candidates/${encodeURIComponent(candidateId)}/decide`, {
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
  if (control instanceof HTMLButtonElement && control.matches('[data-complete-task]')) {
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
