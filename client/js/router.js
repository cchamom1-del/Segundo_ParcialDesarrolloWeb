/* Enrutador del SPA con History API */
const routes = [];
let current = null; // { cleanup }
let outlet = null;

export function route(pattern, loader, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$');
  routes.push({ re, keys, loader, opts });
}

export function navigate(to, { replace = false } = {}) {
  if (to === location.pathname + location.search && !replace) return render();
  history[replace ? 'replaceState' : 'pushState']({}, '', to);
  render();
}

export async function render() {
  const path = location.pathname;
  let match = null;
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      match = { r, params };
      break;
    }
  }
  if (!match) match = { r: routes.find((r) => r.opts.notFound), params: {} };

  if (current?.cleanup) {
    try {
      current.cleanup();
    } catch {}
  }
  current = null;

  const guard = match.r.opts.guard;
  if (guard) {
    const redirect = guard();
    if (redirect) return navigate(redirect, { replace: true });
  }

  window.scrollTo({ top: 0 });
  outlet.innerHTML = '<div class="page-loading"><span class="spinner"></span></div>';
  document.dispatchEvent(new CustomEvent('route', { detail: { path } }));
  const token = {};
  current = token;
  try {
    const mod = await match.r.loader();
    if (current !== token) return;
    const cleanup = await mod.default(outlet, { params: match.params, query: new URLSearchParams(location.search) });
    if (current === token) token.cleanup = cleanup;
    else cleanup?.();
  } catch (e) {
    console.error(e);
    if (current === token) {
      outlet.innerHTML = `<section class="container empty-state"><h1>No se pudo cargar esta página</h1><p>${e.message || ''}</p><a class="btn btn-primary" href="/">Volver al inventario</a></section>`;
    }
  }
}

export function start(el) {
  outlet = el;
  window.addEventListener('popstate', render);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
    e.preventDefault();
    navigate(url.pathname + url.search);
  });
  render();
}
