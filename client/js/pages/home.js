import { api, getCatalogs, session } from '../api.js';
import { esc, fmtQ, qs, debounce, timeAgo, DANIO, fmtNum } from '../util.js';
import { cardHtml, patchCard } from '../components/card.js';
import * as rt from '../realtime.js';

const MULTI = ['estado', 'danio', 'combustible', 'traccion', 'transmision'];
const SINGLE = ['q', 'marca', 'modelo', 'tipo', 'cilindros', 'anioMin', 'anioMax', 'precioMin', 'precioMax', 'sort'];
const ESTADOS = { 'en-vivo': 'En vivo', proxima: 'Próximas', cerrada: 'Finalizadas' };
const SORTS = {
  relevancia: 'Relevancia (en vivo primero)',
  'cierre-asc': 'Cierran primero',
  'precio-asc': 'Precio: menor a mayor',
  'precio-desc': 'Precio: mayor a menor',
  'anio-desc': 'Año más reciente',
  pujas: 'Más ofertas',
  recientes: 'Publicados recientemente',
};

function readFilters(query) {
  const f = {};
  for (const k of MULTI) f[k] = query.get(k) ? query.get(k).split(',') : [];
  for (const k of SINGLE) f[k] = query.get(k) || '';
  return f;
}

export default async function Home(root, { query }) {
  const cat = await getCatalogs();
  const f = readFilters(query);
  const year = new Date().getFullYear() + 1;
  const years = Array.from({ length: year - 1989 }, (_, i) => year - i);

  root.innerHTML = `
  <section class="hero">
    <div class="container hero-grid">
      <div class="hero-copy">
        <h1>Autos de subasta de Estados Unidos, en vivo desde Guatemala.</h1>
        <p class="lead">Revisa la ficha y las fotos de cada lote, oferta en quetzales y mira cómo cambia el precio al instante, sin recargar la página.</p>
        <form class="hero-search" role="search">
          <input type="search" name="q" placeholder="Busca por marca, modelo, año o número de lote" value="${esc(f.q)}" aria-label="Buscar vehículos">
          <button class="btn btn-primary" type="submit">Buscar</button>
        </form>
        <dl class="hero-stats" id="stats">
          <div><dt>En vivo ahora</dt><dd data-s="en-vivo">—</dd></div>
          <div><dt>Próximas</dt><dd data-s="proxima">—</dd></div>
          <div><dt>Ofertas realizadas</dt><dd data-s="bids">—</dd></div>
          <div><dt>Conectados</dt><dd data-s="online">—</dd></div>
        </dl>
      </div>
      <aside class="floor" aria-label="Últimas ofertas en vivo">
        <header class="floor-head"><h2>Piso de subasta</h2><span class="floor-live"><i class="pulse"></i>Últimas ofertas</span></header>
        <ol class="floor-list" id="floor"><li class="floor-empty">Cargando ofertas…</li></ol>
      </aside>
    </div>
  </section>

  <section class="container inventory" id="inventario">
    <aside class="filters" id="filters" aria-label="Filtros">
      <div class="filters-head">
        <h2>Filtros</h2>
        <button class="link-btn" type="button" id="clear">Limpiar</button>
        <button class="icon-btn filters-close" type="button" aria-label="Cerrar filtros">×</button>
      </div>
      <form id="ff" autocomplete="off">
        <fieldset class="fgroup"><legend>Estado de la subasta</legend>
          <div class="chips">${Object.entries(ESTADOS).map(([k, l]) => chip('estado', k, l, f.estado)).join('')}</div>
        </fieldset>
        <fieldset class="fgroup"><legend>Nivel de daño</legend>
          <div class="dmg-toggles">${Object.entries(DANIO).map(([k, d]) => `
            <label class="dmg-toggle dmg-${k}"><input type="checkbox" name="danio" value="${k}" ${f.danio.includes(k) ? 'checked' : ''}><i></i><span><b>${d.label}</b><small>${d.desc}</small></span><em data-count="danio-${k}"></em></label>`).join('')}
          </div>
        </fieldset>
        <fieldset class="fgroup"><legend>Marca y modelo</legend>
          <select name="marca" aria-label="Marca"><option value="">Todas las marcas</option>${Object.keys(cat.marcas).sort().map((m) => `<option ${f.marca === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
          <select name="modelo" aria-label="Modelo" ${f.marca ? '' : 'disabled'}><option value="">Todos los modelos</option>${(cat.marcas[f.marca] || []).map((m) => `<option ${f.modelo === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
        </fieldset>
        <fieldset class="fgroup"><legend>Año</legend>
          <div class="row2">
            <select name="anioMin" aria-label="Año desde"><option value="">Desde</option>${years.map((y) => `<option ${String(y) === f.anioMin ? 'selected' : ''}>${y}</option>`).join('')}</select>
            <select name="anioMax" aria-label="Año hasta"><option value="">Hasta</option>${years.map((y) => `<option ${String(y) === f.anioMax ? 'selected' : ''}>${y}</option>`).join('')}</select>
          </div>
        </fieldset>
        <fieldset class="fgroup"><legend>Precio (Q)</legend>
          <div class="row2">
            <input type="number" name="precioMin" min="0" step="1000" placeholder="Mínimo" value="${esc(f.precioMin)}" aria-label="Precio mínimo">
            <input type="number" name="precioMax" min="0" step="1000" placeholder="Máximo" value="${esc(f.precioMax)}" aria-label="Precio máximo">
          </div>
        </fieldset>
        <fieldset class="fgroup"><legend>Combustible</legend>
          <div class="chips">${cat.combustibles.map((c) => chip('combustible', c, c, f.combustible)).join('')}</div>
        </fieldset>
        <fieldset class="fgroup"><legend>Tren de manejo</legend>
          <div class="chips">${cat.tracciones.map((c) => chip('traccion', c, c, f.traccion)).join('')}</div>
        </fieldset>
        <fieldset class="fgroup"><legend>Transmisión</legend>
          <div class="chips">${cat.transmisiones.map((c) => chip('transmision', c, c, f.transmision)).join('')}</div>
        </fieldset>
        <fieldset class="fgroup"><legend>Tipo y cilindros</legend>
          <select name="tipo" aria-label="Tipo de artículo"><option value="">Todos los tipos</option>${cat.tipos.map((t) => `<option ${f.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <select name="cilindros" aria-label="Cilindros"><option value="">Cualquier cilindraje</option>${cat.cilindros.map((c) => `<option value="${c}" ${String(c) === f.cilindros ? 'selected' : ''}>${c === 0 ? 'Eléctrico (0)' : c + ' cilindros'}</option>`).join('')}</select>
        </fieldset>
      </form>
    </aside>

    <div class="results">
      <div class="results-head">
        <div>
          <h2 id="count" aria-live="polite">Inventario</h2>
          <div class="active-filters" id="active"></div>
        </div>
        <div class="results-tools">
          <button class="btn btn-ghost filters-open" type="button">Filtros</button>
          <label class="sort"><span>Ordenar</span>
            <select id="sort">${Object.entries(SORTS).map(([k, l]) => `<option value="${k}" ${(f.sort || 'relevancia') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </label>
        </div>
      </div>
      <div class="grid" id="grid" aria-busy="true">${'<div class="vcard skeleton"></div>'.repeat(6)}</div>
    </div>
  </section>`;

  const form = root.querySelector('#ff');
  const grid = root.querySelector('#grid');
  const filtersEl = root.querySelector('#filters');
  let ctrl = null;

  function collect() {
    const fd = new FormData(form);
    const out = {};
    for (const k of MULTI) out[k] = fd.getAll(k);
    for (const k of ['marca', 'modelo', 'tipo', 'cilindros', 'anioMin', 'anioMax', 'precioMin', 'precioMax']) out[k] = fd.get(k) || '';
    out.q = root.querySelector('.hero-search input').value.trim();
    out.sort = root.querySelector('#sort').value === 'relevancia' ? '' : root.querySelector('#sort').value;
    return out;
  }

  async function load() {
    const params = collect();
    history.replaceState({}, '', '/' + qs(params) + (location.hash || ''));
    ctrl?.abort();
    ctrl = new AbortController();
    grid.setAttribute('aria-busy', 'true');
    try {
      const data = await api('/api/vehicles' + qs({ ...params, size: 60 }), { signal: ctrl.signal });
      renderResults(data, params);
    } catch (e) {
      if (e.name === 'AbortError') return;
      grid.innerHTML = `<div class="empty-state"><h3>No se pudo cargar el inventario</h3><p>${esc(e.message)}</p></div>`;
    } finally {
      grid.setAttribute('aria-busy', 'false');
    }
  }

  function renderResults(data, params) {
    root.querySelector('#count').textContent = `${data.total} ${data.total === 1 ? 'vehículo' : 'vehículos'}`;
    for (const k of Object.keys(DANIO)) {
      const el = root.querySelector(`[data-count="danio-${k}"]`);
      if (el) el.textContent = data.facets.danio[k] || 0;
    }
    grid.innerHTML = data.items.length
      ? data.items.map(cardHtml).join('')
      : `<div class="empty-state"><h3>Ningún vehículo coincide con estos filtros</h3><p>Quita alguno de los filtros activos o prueba otra búsqueda.</p><button class="btn btn-ghost" type="button" data-clear>Quitar todos los filtros</button></div>`;
    renderActive(params);
  }

  function renderActive(p) {
    const tags = [];
    const add = (k, v, label) => tags.push(`<button type="button" class="ftag" data-k="${esc(k)}" data-v="${esc(v)}">${esc(label)} <span aria-hidden="true">×</span></button>`);
    if (p.q) add('q', p.q, `“${p.q}”`);
    p.estado.forEach((v) => add('estado', v, ESTADOS[v]));
    p.danio.forEach((v) => add('danio', v, `Daño ${DANIO[v].label.toLowerCase()}`));
    ['marca', 'modelo', 'tipo'].forEach((k) => p[k] && add(k, p[k], p[k]));
    ['combustible', 'traccion', 'transmision'].forEach((k) => p[k].forEach((v) => add(k, v, v)));
    if (p.cilindros) add('cilindros', p.cilindros, p.cilindros === '0' ? 'Eléctrico' : `${p.cilindros} cil.`);
    if (p.anioMin) add('anioMin', p.anioMin, `Desde ${p.anioMin}`);
    if (p.anioMax) add('anioMax', p.anioMax, `Hasta ${p.anioMax}`);
    if (p.precioMin) add('precioMin', p.precioMin, `≥ ${fmtQ(p.precioMin)}`);
    if (p.precioMax) add('precioMax', p.precioMax, `≤ ${fmtQ(p.precioMax)}`);
    root.querySelector('#active').innerHTML = tags.join('');
  }

  function clearAll() {
    form.reset();
    form.querySelectorAll('input[type=checkbox]').forEach((c) => (c.checked = false));
    form.querySelectorAll('input[type=number]').forEach((c) => (c.value = ''));
    form.querySelectorAll('select').forEach((s) => (s.value = ''));
    root.querySelector('.hero-search input').value = '';
    syncModelos();
    load();
  }

  function syncModelos() {
    const marca = form.marca.value;
    const sel = form.modelo;
    sel.disabled = !marca;
    sel.innerHTML = `<option value="">Todos los modelos</option>` + (cat.marcas[marca] || []).map((m) => `<option>${esc(m)}</option>`).join('');
  }

  const debounced = debounce(load, 300);
  form.addEventListener('change', (e) => {
    if (e.target.name === 'marca') syncModelos();
    load();
  });
  form.addEventListener('input', (e) => e.target.type === 'number' && debounced());
  root.querySelector('#sort').addEventListener('change', load);
  root.querySelector('.hero-search').addEventListener('submit', (e) => {
    e.preventDefault();
    load();
    root.querySelector('#inventario').scrollIntoView({ behavior: 'smooth' });
  });
  root.querySelector('.hero-search input').addEventListener('input', debounced);
  root.querySelector('#clear').addEventListener('click', clearAll);
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear]')) return clearAll();
    const tag = e.target.closest('.ftag');
    if (tag) {
      const { k, v } = tag.dataset;
      if (k === 'q') root.querySelector('.hero-search input').value = '';
      else {
        const inputs = form.querySelectorAll(`[name="${k}"]`);
        inputs.forEach((i) => {
          if (i.type === 'checkbox') {
            if (i.value === v) i.checked = false;
          } else i.value = '';
        });
        if (k === 'marca') syncModelos();
      }
      load();
    }
  });
  const openBtn = root.querySelector('.filters-open');
  openBtn.addEventListener('click', () => filtersEl.classList.add('open'));
  root.querySelector('.filters-close').addEventListener('click', () => filtersEl.classList.remove('open'));

  /* ---------- Estadísticas y piso de subasta ---------- */
  async function loadStats() {
    try {
      const s = await api('/api/stats');
      root.querySelectorAll('[data-s]').forEach((el) => (el.textContent = fmtNum(s[el.dataset.s])));
    } catch {}
  }
  const floor = root.querySelector('#floor');
  let floorItems = [];
  function renderFloor() {
    floor.innerHTML = floorItems.length
      ? floorItems
          .slice(0, 7)
          .map(
            (b, k) => `<li class="${k === 0 && b.fresh ? 'fresh' : ''}"><a href="/vehiculo/${esc(b.vehicleId)}">
            <span class="floor-dot dmg-${esc(b.danio)}"></span>
            <span class="floor-title"><b>${esc(b.title)}</b><small>Lote ${esc(b.lote)} <time data-at="${b.at}">${timeAgo(b.at)}</time></small></span>
            <strong>${fmtQ(b.amount)}</strong></a></li>`
          )
          .join('')
      : '<li class="floor-empty">Todavía no hay ofertas. ¡Sé el primero!</li>';
  }
  api('/api/bids/recent?limit=10')
    .then((d) => {
      floorItems = d.items;
      renderFloor();
    })
    .catch(() => (floor.innerHTML = '<li class="floor-empty">No disponible</li>'));

  const onTick = () => floor.querySelectorAll('time[data-at]').forEach((t) => (t.textContent = timeAgo(Number(t.dataset.at))));
  document.addEventListener('tick', onTick);

  const offs = [
    rt.on('bid', (d) => {
      patchCard(root, d);
      floorItems.unshift({ vehicleId: d.vehicleId, title: d.title, lote: d.lote, danio: d.danio, amount: d.currentBid, at: d.lastBidAt, fresh: true });
      floorItems = floorItems.slice(0, 10);
      renderFloor();
      loadStats();
    }),
    rt.on('catalog', debounce(() => {
      load();
      loadStats();
    }, 600)),
    rt.on('closed', debounce(() => {
      load();
      loadStats();
    }, 600)),
    rt.on('started', debounce(load, 600)),
  ];
  rt.watch(null);

  loadStats();
  await load();
  const statsTimer = setInterval(loadStats, 30_000);

  return () => {
    offs.forEach((o) => o());
    document.removeEventListener('tick', onTick);
    clearInterval(statsTimer);
    ctrl?.abort();
  };
}

function chip(name, value, label, selected) {
  return `<label class="chip"><input type="checkbox" name="${name}" value="${esc(value)}" ${selected.includes(value) ? 'checked' : ''}><span>${esc(label)}</span></label>`;
}
