import { api } from '../api.js';
import { esc, fmtQ, statusBadge, damageChip, vehicleTitle, liveStatus, debounce } from '../util.js';
import { countdownHtml } from '../components/clock.js';
import * as rt from '../realtime.js';

export default async function MyBids(root) {
  root.innerHTML = `
  <div class="container dash">
    <header class="page-head">
      <div><h1>Mis pujas</h1><p class="muted">Sigue en vivo cada subasta en la que ofertaste.</p></div>
      <a class="btn btn-ghost" href="/">Explorar inventario</a>
    </header>
    <div id="summary" class="summary"></div>
    <div id="list" class="rows"><div class="page-loading"><span class="spinner"></span></div></div>
  </div>`;
  const list = root.querySelector('#list');
  let items = [];

  function stateOf(v) {
    const st = liveStatus(v);
    if (st === 'cerrada') return v.isLeader && v.resultado !== 'desierto' ? ['won', 'Ganaste'] : ['lost', 'No ganaste'];
    return v.isLeader ? ['lead', 'Vas ganando'] : ['outbid', 'Te superaron'];
  }

  function render() {
    const lead = items.filter((v) => liveStatus(v) !== 'cerrada' && v.isLeader).length;
    const outbid = items.filter((v) => liveStatus(v) !== 'cerrada' && !v.isLeader).length;
    const won = items.filter((v) => liveStatus(v) === 'cerrada' && v.isLeader && v.resultado !== 'desierto').length;
    root.querySelector('#summary').innerHTML = `
      <div class="s-lead"><b>${lead}</b><span>vas ganando</span></div>
      <div class="s-outbid"><b>${outbid}</b><span>te superaron</span></div>
      <div><b>${won}</b><span>subastas ganadas</span></div>
      <div><b>${items.length}</b><span>subastas con ofertas tuyas</span></div>`;
    list.innerHTML = items.length
      ? items
          .map((v) => {
            const [cls, label] = stateOf(v);
            const st = liveStatus(v);
            return `<article class="row bidrow st-${cls}" data-vid="${esc(v.id)}">
            <img src="${esc(v.cover)}" alt="" loading="lazy">
            <div class="row-main">
              <div class="row-badges">${statusBadge(v)}${damageChip(v.danio)}<span class="lot-inline">Lote ${esc(v.lote)}</span></div>
              <h3><a href="/vehiculo/${esc(v.id)}">${esc(vehicleTitle(v))}</a></h3>
              <span class="you you-${cls}">${label}</span>
            </div>
            <div class="row-num"><small>Tu oferta</small><b>${fmtQ(v.myMax)}</b></div>
            <div class="row-num"><small>${st === 'cerrada' ? 'Oferta final' : 'Oferta actual'}</small><b>${fmtQ(v.currentBid)}</b></div>
            <div class="row-num">${countdownHtml(v)}</div>
            <div class="row-actions"><a class="btn ${cls === 'outbid' ? 'btn-accent' : 'btn-ghost'} btn-sm" href="/vehiculo/${esc(v.id)}">${cls === 'outbid' ? 'Ofertar de nuevo' : 'Ver subasta'}</a></div>
          </article>`;
          })
          .join('')
      : `<div class="empty-state"><h3>Aún no has ofertado en ninguna subasta</h3><p>Explora el inventario y haz tu primera oferta.</p><a class="btn btn-primary" href="/">Ver vehículos en vivo</a></div>`;
  }

  async function load() {
    try {
      items = (await api('/api/me/bids')).items;
      render();
    } catch (e) {
      list.innerHTML = `<div class="empty-state"><h3>No se pudieron cargar tus pujas</h3><p>${esc(e.message)}</p></div>`;
    }
  }

  const offs = [
    rt.on('bid', (d) => {
      const v = items.find((x) => x.id === d.vehicleId);
      if (!v) return;
      v.currentBid = d.currentBid;
      v.bidCount = d.bidCount;
      if (d.you === 'leading') v.isLeader = true;
      if (d.you === 'outbid') v.isLeader = false;
      render();
    }),
    rt.on('closed', debounce(load, 400)),
  ];
  await load();
  return () => offs.forEach((o) => o());
}
