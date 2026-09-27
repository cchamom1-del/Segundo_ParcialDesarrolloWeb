/* Utilidades compartidas del SPA */

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const fmtQ = (n) => 'Q ' + Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 0 });
export const fmtNum = (n) => Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 0 });

/* ---------- Reloj sincronizado con el servidor ---------- */
let offset = 0;
export function syncClock(serverNow) {
  if (typeof serverNow === 'number') offset = serverNow - Date.now();
}
export const now = () => Date.now() + offset;

export function fmtDate(ms, opts = {}) {
  return new Date(ms).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', ...opts });
}

export function timeAgo(ms) {
  const s = Math.max(0, Math.round((now() - ms) / 1000));
  if (s < 5) return 'justo ahora';
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** Texto de cuenta regresiva: "2d 04:12:09" / "04:12:09" */
export function countdownParts(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return { d, h, m, s, text: `${d ? d + 'd ' : ''}${pad(h)}:${pad(m)}:${pad(s)}` };
}

/** Estado calculado en el cliente con el reloj del servidor */
export function liveStatus(v) {
  const t = now();
  if (v.status === 'cerrada' || t >= v.cierre) return 'cerrada';
  if (t < v.inicio) return 'proxima';
  return 'en-vivo';
}

export const DANIO = {
  verde: { label: 'Verde', desc: 'Daño menor / Limpio' },
  amarillo: { label: 'Amarillo', desc: 'Daño medio / Reparable' },
  rojo: { label: 'Rojo', desc: 'Daño severo / Salvamento' },
};

export function statusBadge(v) {
  const st = liveStatus(v);
  if (st === 'en-vivo') return `<span class="badge badge-live"><i class="pulse"></i>En vivo</span>`;
  if (st === 'proxima') return `<span class="badge badge-soon">Próxima</span>`;
  const res = v.resultado || (v.bidCount > 0 ? 'vendido' : 'desierto');
  return res === 'vendido' ? `<span class="badge badge-sold">Vendido</span>` : `<span class="badge badge-void">Desierta</span>`;
}

export function damageChip(d, withDesc = false) {
  const m = DANIO[d] || DANIO.verde;
  return `<span class="dmg dmg-${esc(d)}" title="${esc(m.desc)}"><i></i>${withDesc ? esc(m.desc) : esc(m.label)}</span>`;
}

export const debounce = (fn, ms = 250) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

/* ---------- Notificaciones tipo toast ---------- */
export function toast(message, { type = 'info', title = '', timeout = 5000, action } = {}) {
  let wrap = document.getElementById('toasts');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toasts';
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<div class="toast-body">${title ? `<strong>${esc(title)}</strong>` : ''}<span>${esc(message)}</span></div>
    ${action ? `<a class="toast-action" href="${esc(action.href)}">${esc(action.label)}</a>` : ''}
    <button class="toast-close" aria-label="Cerrar">×</button>`;
  el.querySelector('.toast-close').onclick = () => el.remove();
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  if (timeout) setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, timeout);
  return el;
}

/* ---------- Sonido corto (Web Audio, sin archivos) ---------- */
let audioCtx;
export function beep(kind = 'alert') {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    const seq = kind === 'win' ? [660, 880, 1100] : kind === 'ok' ? [880, 1175] : [520, 390];
    const t0 = audioCtx.currentTime;
    seq.forEach((f, i) => o.frequency.setValueAtTime(f, t0 + i * 0.12));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + seq.length * 0.12 + 0.1);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + seq.length * 0.12 + 0.12);
  } catch {}
}

/* ---------- Parpadeo del título de la pestaña ---------- */
let titleTimer = null;
const baseTitle = document.title;
export function flashTitle(msg) {
  if (!document.hidden) return;
  clearInterval(titleTimer);
  let on = false;
  titleTimer = setInterval(() => {
    document.title = (on = !on) ? msg : baseTitle;
  }, 1000);
  const stop = () => {
    clearInterval(titleTimer);
    document.title = baseTitle;
    document.removeEventListener('visibilitychange', stop);
  };
  document.addEventListener('visibilitychange', stop);
}

export function vehicleTitle(v) {
  return `${v.anio} ${v.marca} ${v.modelo}`;
}

export function specsLine(v) {
  return [v.transmision, v.combustible, v.traccion].filter(Boolean).join(' · ');
}

export function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : v);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
