import { api, session } from '../api.js';
import { esc, fmtQ, fmtDate, statusBadge, damageChip, vehicleTitle, debounce, qs, toast, liveStatus } from '../util.js';
import { countdownHtml } from '../components/clock.js';
import * as rt from '../realtime.js';

export default async function MyListings(root, { query }) {
  const isAdmin = session.user?.role === 'admin';
  root.innerHTML = `
  <div class="container dash">
    <header class="page-head">
      <div><h1>Mis publicaciones</h1><p class="muted">Busca, revisa y edita los vehículos que publicaste.</p></div>
      <a class="btn btn-primary" href="/publicar">Publicar vehículo</a>
    </header>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Buscar por marca, modelo, año o lote" value="${esc(query.get('q') || '')}" aria-label="Buscar en mis publicaciones">
      <select id="estado" aria-label="Estado">
        <option value="">Todos los estados</option><option value="en-vivo">En vivo</option><option value="proxima">Próximas</option><option value="cerrada">Finalizadas</option>
      </select>
      ${isAdmin ? '<label class="check"><input type="checkbox" id="all"> Ver todas (administrador)</label>' : ''}
    </div>
    <div id="summary" class="summary"></div>
    <div id="list" class="rows"><div class="page-loading"><span class="spinner"></span></div></div>
  </div>`;

  const list = root.querySelector('#list');
  const q = root.querySelector('#q');
  const estado = root.querySelector('#estado');
  const all = root.querySelector('#all');

  async function load() {
    const params = { q: q.value.trim(), estado: estado.value, all: all?.checked ? '1' : '' };
    history.replaceState({}, '', '/mis-publicaciones' + qs({ q: params.q }));
    try {
      const data = await api('/api/me/vehicles' + qs(params));
      const live = data.items.filter((v) => liveStatus(v) === 'en-vivo');
      root.querySelector('#summary').innerHTML = `
        <div><b>${data.total}</b><span>publicaciones</span></div>
        <div><b>${live.length}</b><span>en vivo</span></div>
        <div><b>${data.items.reduce((a, v) => a + v.bidCount, 0)}</b><span>ofertas recibidas</span></div>
        <div><b>${fmtQ(live.reduce((a, v) => a + (v.currentBid || 0), 0))}</b><span>en ofertas activas</span></div>`;
      list.innerHTML = data.items.length
        ? data.items.map(row).join('')
        : `<div class="empty-state"><h3>${params.q || params.estado ? 'Ninguna publicación coincide con tu búsqueda' : 'Todavía no has publicado vehículos'}</h3>
           <p>${params.q || params.estado ? 'Prueba con otro término o estado.' : 'Publica tu primer vehículo y empieza a recibir ofertas en vivo.'}</p>
           <a class="btn btn-primary" href="/publicar">Publicar vehículo</a></div>`;
    } catch (e) {
      list.innerHTML = `<div class="empty-state"><h3>No se pudieron cargar tus publicaciones</h3><p>${esc(e.message)}</p></div>`;
    }
  }

  function row(v) {
    const st = liveStatus(v);
    const canEdit = st !== 'cerrada';
    const canDelete = v.bidCount === 0 || isAdmin;
    return `<article class="row" data-vid="${esc(v.id)}">
      <img src="${esc(v.cover)}" alt="" loading="lazy">
      <div class="row-main">
        <div class="row-badges">${statusBadge(v)}${damageChip(v.danio)}<span class="lot-inline">Lote ${esc(v.lote)}</span></div>
        <h3><a href="/vehiculo/${esc(v.id)}">${esc(vehicleTitle(v))}</a></h3>
        <small class="muted">${v.ownerName ? `Publicado por ${esc(v.ownerName)} · ` : ''}Cierre ${fmtDate(v.cierre)}</small>
      </div>
      <div class="row-num"><small>${v.bidCount ? 'Oferta actual' : 'Monto base'}</small><b data-price>${fmtQ(v.bidCount ? v.currentBid : v.precioBase)}</b><small data-bids>${v.bidCount} ofertas</small></div>
      <div class="row-num">${countdownHtml(v)}</div>
      <div class="row-actions">
        <a class="btn btn-ghost btn-sm" href="/vehiculo/${esc(v.id)}">Ver</a>
        ${canEdit ? `<a class="btn btn-ghost btn-sm" href="/editar/${esc(v.id)}">Editar</a>` : ''}
        ${canDelete ? `<button class="btn btn-danger btn-sm" data-del="${esc(v.id)}">Eliminar</button>` : ''}
      </div>
    </article>`;
  }

  list.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    if (!confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.')) return;
    b.disabled = true;
    try {
      await api(`/api/vehicles/${b.dataset.del}`, { method: 'DELETE' });
      toast('Publicación eliminada.', { type: 'success' });
      load();
    } catch (ex) {
      toast(ex.message, { type: 'error' });
      b.disabled = false;
    }
  });

  const d = debounce(load, 250);
  q.addEventListener('input', d);
  estado.addEventListener('change', load);
  all?.addEventListener('change', load);
  const offs = [
    rt.on('bid', (ev) => {
      const r = list.querySelector(`.row[data-vid="${CSS.escape(ev.vehicleId)}"]`);
      if (!r) return;
      r.querySelector('[data-price]').textContent = fmtQ(ev.currentBid);
      r.querySelector('[data-bids]').textContent = `${ev.bidCount} ofertas`;
      r.classList.remove('flash');
      void r.offsetWidth;
      r.classList.add('flash');
    }),
    rt.on('closed', debounce(load, 500)),
  ];
  await load();
  return () => offs.forEach((o) => o());
}
