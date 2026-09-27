/* Reloj global: actualiza cada segundo todos los contadores [data-end] del DOM */
import { countdownParts, now } from '../util.js';

export function countdownHtml(v, { big = false } = {}) {
  return `<span class="cd${big ? ' cd-big' : ''}" data-start="${v.inicio}" data-end="${v.cierre}" data-closed="${v.status === 'cerrada' ? 1 : 0}">${countdownText(v.inicio, v.cierre, v.status === 'cerrada')}</span>`;
}

function countdownText(start, end, closed) {
  const t = now();
  if (closed || t >= end) return 'Oferta cerrada';
  if (t < start) return 'Inicia en ' + countdownParts(start - t).text;
  return countdownParts(end - t).text;
}

function tick() {
  const t = now();
  document.querySelectorAll('.cd[data-end]').forEach((el) => {
    const start = Number(el.dataset.start);
    const end = Number(el.dataset.end);
    const closed = el.dataset.closed === '1';
    const txt = countdownText(start, end, closed);
    if (el.textContent !== txt) el.textContent = txt;
    const left = end - t;
    el.classList.toggle('is-closed', closed || left <= 0);
    el.classList.toggle('is-soon', !closed && t < start);
    el.classList.toggle('is-urgent', !closed && t >= start && left > 0 && left < 3_600_000);
    el.classList.toggle('is-critical', !closed && t >= start && left > 0 && left < 300_000);
  });
  document.dispatchEvent(new CustomEvent('tick', { detail: t }));
}

let started = false;
export function startClock() {
  if (started) return;
  started = true;
  const loop = () => {
    tick();
    setTimeout(loop, 1000 - (now() % 1000) + 5);
  };
  loop();
}
