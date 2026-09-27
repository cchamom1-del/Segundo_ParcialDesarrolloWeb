import { api, session, ApiError } from '../api.js';
import { esc, fmtQ, fmtNum, fmtDate, timeAgo, liveStatus, damageChip, statusBadge, vehicleTitle, toast, beep, DANIO, now } from '../util.js';
import { mountCarousel } from '../components/carousel.js';
import { countdownHtml } from '../components/clock.js';
import * as rt from '../realtime.js';

export default async function Detail(root, { params }) {
  let v;
  try {
    v = await api(`/api/vehicles/${encodeURIComponent(params.id)}`);
  } catch (e) {
    root.innerHTML = `<section class="container empty-state"><h1>${e.status === 404 ? 'Este vehículo ya no está disponible' : 'No se pudo cargar el vehículo'}</h1><p>${esc(e.message)}</p><a class="btn btn-primary" href="/">Volver al inventario</a></section>`;
    return;
  }
  const title = vehicleTitle(v);
  document.title = `${title} · Lote ${v.lote} · AutoPuja GT`;
  let history = v.history || [];
  let participated = v.myMax != null;
  let lastStatus = liveStatus(v);
  let confirmTimer = null;

  root.innerHTML = `
  <div class="container detail">
    <nav class="crumbs" aria-label="Ruta"><a href="/">Inventario</a><span>/</span><span>Lote ${esc(v.lote)}</span></nav>
    <header class="detail-head">
      <div>
        <h1>${esc(title)}</h1>
        <div class="detail-meta" id="meta"></div>
      </div>
      <div class="viewers" id="viewers" title="Personas viendo esta subasta ahora"><i class="eye"></i><span>${v.viewers || 1}</span> viendo ahora</div>
    </header>
    <div class="detail-grid">
      <div class="detail-main">
        <div id="carousel"></div>
        <section class="panel">
          <h2>Ficha técnica</h2>
          <dl class="spec-grid">
            ${spec('Año', v.anio)}${spec('Tipo de artículo', v.tipo)}${spec('Marca', v.marca)}${spec('Modelo', v.modelo)}
            ${spec('Motor', v.motor)}${spec('Transmisión', v.transmision)}${spec('Combustible', v.combustible)}${spec('Tren de manejo', v.traccion)}
            ${spec('Cilindros', v.cilindros === 0 ? 'Eléctrico (0)' : v.cilindros)}${spec('Color', v.color || '—')}
            ${spec('Kilometraje', v.kilometraje != null ? fmtNum(v.kilometraje) + ' km' : '—')}${spec('VIN', v.vin || '—')}
          </dl>
          <div class="damage-box dmg-box-${esc(v.danio)}">
            ${damageChip(v.danio)}
            <div><strong>${esc(DANIO[v.danio].desc)}</strong><p>${damageHelp(v.danio)}</p></div>
          </div>
        </section>
        ${v.descripcion ? `<section class="panel"><h2>Descripción del publicador</h2><p class="desc">${esc(v.descripcion)}</p></section>` : ''}
        <section class="panel">
          <div class="panel-head"><h2>Historial de ofertas</h2><small>La identidad de los postores es privada</small></div>
          <ol class="history" id="history"></ol>
        </section>
      </div>
      <aside class="bid-panel" id="panel" aria-live="polite"></aside>
    </div>
  </div>`;

  mountCarousel(root.querySelector('#carousel'), v.photos, title);
  const panel = root.querySelector('#panel');

  function renderMeta() {
    root.querySelector('#meta').innerHTML = `${statusBadge(v)}${damageChip(v.danio, true)}<span class="lot-inline">Lote ${esc(v.lote)}</span>`;
  }

  function indicator(st) {
    if (v.isOwner) return `<div class="state state-owner"><strong>Esta es tu publicación</strong><span>Los demás usuarios pueden ofertar; tú ves la actividad en vivo.</span></div>`;
    if (st === 'cerrada') {
      if (v.isLeader && v.resultado !== 'desierto') return `<div class="state state-win"><strong>¡Ganaste esta subasta!</strong><span>Tu oferta de ${fmtQ(v.currentBid)} fue la más alta.</span></div>`;
      if (participated) return `<div class="state state-lost"><strong>La subasta terminó</strong><span>Otra oferta fue más alta esta vez.</span></div>`;
      return '';
    }
    if (!session.isAuth) return '';
    if (v.isLeader) return `<div class="state state-lead" role="status"><strong>¡Vas ganando esta subasta!</strong><span>Tienes la oferta más alta. Te avisaremos si alguien te supera.</span></div>`;
    if (participated) return `<div class="state state-outbid" role="alert"><strong>Tu oferta ha sido superada.</strong><span>¡Haz tu oferta ahora antes de que termine el tiempo!</span></div>`;
    return '';
  }

  function renderPanel() {
    const st = liveStatus(v);
    const typed = panel.querySelector('#amount')?.value;
    const hadFocus = document.activeElement?.id === 'amount';
    const hasBids = v.bidCount > 0;
    let body = '';

    if (st === 'cerrada') {
      const res = v.resultado || (hasBids ? 'vendido' : 'desierto');
      body = `<div class="closed-box"><strong>Oferta cerrada</strong><p>${res === 'vendido' ? `Vendido por ${fmtQ(v.currentBid)} tras ${v.bidCount} ${v.bidCount === 1 ? 'oferta' : 'ofertas'}.` : 'Subasta desierta: no se alcanzó el monto base.'}</p></div>`;
    } else if (st === 'proxima') {
      body = `<div class="closed-box soon"><strong>La subasta aún no inicia</strong><p>Abre el ${fmtDate(v.inicio, { weekday: 'long' })}. Podrás ofertar desde ese momento.</p></div>`;
    } else if (v.isOwner) {
      body = `<a class="btn btn-ghost btn-block" href="/editar/${esc(v.id)}">Editar publicación</a>`;
    } else if (!session.isAuth) {
      body = `<div class="login-cta"><p>Inicia sesión para ofertar por este vehículo.</p>
        <a class="btn btn-primary btn-block" href="/login?next=${encodeURIComponent(location.pathname)}">Iniciar sesión para ofertar</a>
        <a class="btn btn-ghost btn-block" href="/registro?next=${encodeURIComponent(location.pathname)}">Crear cuenta gratis</a></div>`;
    } else if (v.isLeader) {
      body = `<p class="hint">Ya tienes la oferta más alta. Podrás volver a ofertar si alguien te supera.</p>`;
    } else {
      const q = (p) => Math.ceil((v.minNext * (100 + p)) / 100 / 100) * 100;
      body = `<form class="bid-form" id="bidForm" novalidate>
        <label for="amount">Tu oferta</label>
        <div class="money-input"><span>Q</span><input id="amount" name="amount" inputmode="numeric" autocomplete="off" placeholder="${fmtNum(v.minNext)}" aria-describedby="bidHelp bidErr"></div>
        <div class="quick">
          <button type="button" data-q="${v.minNext}">Mínimo ${fmtQ(v.minNext)}</button>
          <button type="button" data-q="${q(5)}">${fmtQ(q(5))}</button>
          <button type="button" data-q="${q(15)}">${fmtQ(q(15))}</button>
        </div>
        <p class="field-error" id="bidErr" role="alert"></p>
        <button class="btn btn-accent btn-block btn-lg" type="submit" id="bidBtn">Ofertar</button>
        <p class="hint" id="bidHelp">${hasBids ? `Debe superar ${fmtQ(v.currentBid)} por al menos 10 %.` : `La oferta mínima es el monto base.`}</p>
      </form>`;
    }

    panel.innerHTML = `
      <div class="board">
        <div class="board-row">
          <span class="board-label">${st === 'proxima' ? 'Inicia en' : st === 'cerrada' ? 'Estado' : 'Tiempo restante'}</span>
          ${countdownHtml(v, { big: true })}
        </div>
        <div class="board-price">
          <span class="board-label">${hasBids ? (st === 'cerrada' ? 'Oferta ganadora' : 'Oferta actual') : 'Monto base'}</span>
          <strong id="price">${fmtQ(hasBids ? v.currentBid : v.precioBase)}</strong>
          <small>${hasBids ? `${v.bidCount} ${v.bidCount === 1 ? 'oferta' : 'ofertas'} · base ${fmtQ(v.precioBase)}` : 'Sin ofertas todavía'}</small>
        </div>
        ${st === 'en-vivo' ? `<div class="board-next"><span>Próxima oferta mínima</span><b>${fmtQ(v.minNext)}</b></div>` : ''}
      </div>
      ${indicator(st)}
      ${body}
      <dl class="times">
        <div><dt>Inicio</dt><dd>${fmtDate(v.inicio, { year: 'numeric' })}</dd></div>
        <div><dt>Cierre</dt><dd>${fmtDate(v.cierre, { year: 'numeric' })}</dd></div>
        ${v.myMax != null ? `<div><dt>Tu oferta más alta</dt><dd>${fmtQ(v.myMax)}</dd></div>` : ''}
      </dl>`;

    const input = panel.querySelector('#amount');
    if (input) {
      if (typed) input.value = typed;
      if (hadFocus) input.focus();
      input.addEventListener('input', () => {
        const digits = input.value.replace(/\D/g, '');
        input.value = digits ? Number(digits).toLocaleString('es-GT') : '';
        panel.querySelector('#bidErr').textContent = '';
        resetConfirm();
      });
      panel.querySelectorAll('[data-q]').forEach((b) =>
        b.addEventListener('click', () => {
          input.value = Number(b.dataset.q).toLocaleString('es-GT');
          panel.querySelector('#bidErr').textContent = '';
          resetConfirm();
          input.focus();
        })
      );
      panel.querySelector('#bidForm').addEventListener('submit', submitBid);
    }
  }

  function resetConfirm() {
    clearTimeout(confirmTimer);
    const btn = panel.querySelector('#bidBtn');
    if (btn) {
      btn.dataset.confirm = '';
      btn.textContent = 'Ofertar';
      btn.classList.remove('confirming');
    }
  }

  async function submitBid(e) {
    e.preventDefault();
    const input = panel.querySelector('#amount');
    const err = panel.querySelector('#bidErr');
    const btn = panel.querySelector('#bidBtn');
    const amount = Number(input.value.replace(/\D/g, ''));
    if (!amount) {
      err.textContent = 'Escribe el monto de tu oferta.';
      return input.focus();
    }
    if (amount < v.minNext) {
      err.textContent = v.bidCount
        ? `Tu oferta debe superar la actual por al menos 10 %: mínimo ${fmtQ(v.minNext)}.`
        : `La oferta no puede ser menor al monto base (${fmtQ(v.minNext)}).`;
      return input.focus();
    }
    // Confirmación en dos pasos para evitar ofertas accidentales
    if (btn.dataset.confirm !== String(amount)) {
      btn.dataset.confirm = String(amount);
      btn.textContent = `Confirmar oferta de ${fmtQ(amount)}`;
      btn.classList.add('confirming');
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(resetConfirm, 5000);
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      const res = await api(`/api/vehicles/${v.id}/bids`, { method: 'POST', body: { amount } });
      Object.assign(v, res.vehicle);
      v.myMax = amount;
      participated = true;
      if (!history.some((h) => h.id === res.bid.id)) history.unshift(res.bid);
      renderAll();
      beep('ok');
      toast(`Registramos tu oferta de ${fmtQ(amount)}.`, { type: 'success', title: '¡Vas ganando!' });
    } catch (ex) {
      if (ex instanceof ApiError && ex.data.minNext) {
        v.minNext = ex.data.minNext;
        if (ex.data.currentBid) v.currentBid = ex.data.currentBid;
      }
      renderPanel();
      const e2 = panel.querySelector('#bidErr');
      if (e2) e2.textContent = ex.message;
      else toast(ex.message, { type: 'error' });
    }
  }

  function renderHistory() {
    const el = root.querySelector('#history');
    el.innerHTML = history.length
      ? history
          .map(
            (h, k) => `<li class="${h.mine ? 'mine' : ''} ${k === 0 ? 'top' : ''}${h.fresh ? ' fresh' : ''}">
          <span class="who">${h.mine ? 'Tú' : 'Postor anónimo'}${k === 0 ? '<em>Más alta</em>' : ''}</span>
          <strong>${fmtQ(h.amount)}</strong><time data-at="${h.at}">${timeAgo(h.at)}</time></li>`
          )
          .join('')
      : '<li class="empty">Aún no hay ofertas. La primera debe ser al menos el monto base.</li>';
  }

  function renderAll() {
    renderMeta();
    renderPanel();
    renderHistory();
  }
  renderAll();

  /* ---------- Tiempo real ---------- */
  rt.watch(v.id);
  const offs = [
    rt.on('bid', (d) => {
      if (d.vehicleId !== v.id) return;
      v.currentBid = d.currentBid;
      v.bidCount = d.bidCount;
      v.minNext = d.minNext;
      v.lastBidAt = d.lastBidAt;
      if (d.you === 'leading') v.isLeader = true;
      if (d.you === 'outbid') {
        v.isLeader = false;
        participated = true;
      }
      if (!history.some((h) => h.id === d.entry.id)) history.unshift({ ...d.entry, fresh: true });
      renderAll();
      const price = panel.querySelector('#price');
      price?.classList.add('bump');
      if (d.you === 'outbid') beep('alert');
    }),
    rt.on('viewers', (d) => {
      if (d.vehicleId === v.id) root.querySelector('#viewers span').textContent = d.count;
    }),
    rt.on('closed', (d) => {
      if (d.vehicleId !== v.id) return;
      v.status = 'cerrada';
      v.resultado = d.resultado;
      v.currentBid = d.currentBid;
      v.bidCount = d.bidCount;
      if (d.you === 'won') {
        v.isLeader = true;
        beep('win');
      }
      renderAll();
    }),
    rt.on('catalog', async (d) => {
      if (d.vehicleId !== v.id) return;
      if (d.type === 'deleted') {
        toast('El publicador retiró este vehículo.', { type: 'error' });
        return;
      }
      try {
        const fresh = await api(`/api/vehicles/${v.id}`);
        Object.assign(v, fresh);
        renderAll();
      } catch {}
    }),
  ];

  const onTick = () => {
    const st = liveStatus(v);
    if (st !== lastStatus) {
      lastStatus = st;
      renderAll();
    }
    root.querySelectorAll('#history time[data-at]').forEach((t) => (t.textContent = timeAgo(Number(t.dataset.at))));
  };
  document.addEventListener('tick', onTick);

  return () => {
    offs.forEach((o) => o());
    document.removeEventListener('tick', onTick);
    clearTimeout(confirmTimer);
    rt.watch(null);
    document.title = 'AutoPuja GT · Subastas de vehículos en vivo';
  };
}

function spec(k, val) {
  return `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`;
}

function damageHelp(d) {
  return {
    verde: 'Detalles estéticos o golpes leves. Normalmente listo para circular con reparaciones menores.',
    amarillo: 'Requiere reparación de carrocería o componentes. Costo de reparación moderado.',
    rojo: 'Daño estructural o mecánico importante. Ideal para partes o reconstrucción profesional.',
  }[d];
}
