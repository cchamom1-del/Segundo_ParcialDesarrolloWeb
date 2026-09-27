/* Conexión en vivo con el servidor (Server-Sent Events) */
import { api, session } from './api.js';
import { syncClock } from './util.js';

const handlers = new Map(); // event -> Set(fn)
let es = null;
let clientId = null;
let watching = null;
let retry = 0;
let reconnectTimer = null;
let state = 'connecting';

const EVENTS = ['hello', 'bid', 'outbid', 'closed', 'started', 'catalog', 'viewers'];

export function on(event, fn) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(fn);
  return () => handlers.get(event)?.delete(fn);
}

function emit(event, data) {
  handlers.get(event)?.forEach((fn) => {
    try {
      fn(data);
    } catch (e) {
      console.error(e);
    }
  });
}

function setState(s) {
  state = s;
  emit('status', s);
}
export const getState = () => state;

export async function connect() {
  clearTimeout(reconnectTimer);
  if (es) {
    es.close();
    es = null;
  }
  setState('connecting');
  let url = '/api/stream';
  if (session.isAuth) {
    try {
      const { ticket } = await api('/api/stream/ticket', { method: 'POST' });
      url += `?ticket=${encodeURIComponent(ticket)}`;
    } catch {
      /* se conecta como anónimo */
    }
  }
  es = new EventSource(url);
  EVENTS.forEach((ev) =>
    es.addEventListener(ev, (e) => {
      const data = JSON.parse(e.data);
      if (data.serverNow) syncClock(data.serverNow);
      if (ev === 'hello') {
        clientId = data.clientId;
        retry = 0;
        setState('online');
        if (watching) sendWatch(watching);
      }
      emit(ev, data);
    })
  );
  es.onerror = () => {
    // Reconexión manual con backoff (el ticket es de un solo uso)
    es?.close();
    es = null;
    setState('offline');
    const wait = Math.min(15000, 1000 * 2 ** retry++);
    reconnectTimer = setTimeout(connect, wait);
  };
}

async function sendWatch(vehicleId) {
  if (!clientId) return;
  try {
    await api('/api/stream/watch', { method: 'POST', body: { clientId, vehicleId } });
  } catch {}
}

/** Indica al servidor qué subasta está viendo esta pestaña (para "personas viendo") */
export function watch(vehicleId) {
  watching = vehicleId;
  sendWatch(vehicleId);
}

// Al iniciar/cerrar sesión se reabre el canal para personalizar los mensajes
session.onChange(() => connect());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !es) connect();
});
