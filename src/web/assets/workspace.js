// Progressive enhancement: normal links and GET forms also work without JS.
const main = /** @type {HTMLElement} */ (document.querySelector('#main'));
const notice = /** @type {HTMLElement} */ (document.querySelector('#notice'));
let dirty = false;
let loggingOut = false;
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
  if (control.matches('[data-refresh]')) {
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
window.addEventListener('offline', () => announce('网络已断开，当前内容可能已过时。联网后可刷新。'));
window.addEventListener('online', () => { void resume(); });
window.addEventListener('pageshow', (event) => {
  if (event.persisted) { main.replaceChildren(); location.reload(); }
});
