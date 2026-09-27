import crypto from 'node:crypto';

/**
 * Hub de tiempo real con Server-Sent Events (SSE).
 * - Cada pestaña abre UNA conexión (EventSource) que se reconecta sola.
 * - Los mensajes se personalizan por conexión: el servidor sabe quién es el
 *   usuario y calcula "vas ganando" / "te superaron" SIN revelar a otros
 *   quién es el líder (privacidad del postor).
 */
const clients = new Map(); // id -> { id, res, userId, vehicleId }
const tickets = new Map(); // ticket -> { userId, exp }

export function createTicket(userId) {
  const t = crypto.randomBytes(18).toString('base64url');
  tickets.set(t, { userId, exp: Date.now() + 60_000 });
  return t;
}

function consumeTicket(t) {
  const v = tickets.get(t);
  if (!v) return null;
  tickets.delete(t);
  return v.exp > Date.now() ? v.userId : null;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tickets) if (v.exp < now) tickets.delete(k);
}, 60_000).unref();

function write(client, event, data) {
  try {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    /* conexión cerrada */
  }
}

export function openStream(req, res, ticket) {
  const userId = ticket ? consumeTicket(ticket) : null;
  const id = crypto.randomUUID();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 4000\n\n');
  const client = { id, res, userId, vehicleId: null };
  clients.set(id, client);
  write(client, 'hello', { clientId: id, serverNow: Date.now(), authenticated: !!userId });

  const ping = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    } catch {}
  }, 20_000);

  req.on('close', () => {
    clearInterval(ping);
    const prev = client.vehicleId;
    clients.delete(id);
    if (prev) emitViewers(prev);
  });
}

export function watch(clientId, vehicleId) {
  const c = clients.get(clientId);
  if (!c) return false;
  const prev = c.vehicleId;
  c.vehicleId = vehicleId || null;
  if (prev && prev !== c.vehicleId) emitViewers(prev);
  if (c.vehicleId) emitViewers(c.vehicleId);
  return true;
}

export function viewersOf(vehicleId) {
  let n = 0;
  for (const c of clients.values()) if (c.vehicleId === vehicleId) n++;
  return n;
}

function emitViewers(vehicleId) {
  const count = viewersOf(vehicleId);
  for (const c of clients.values()) if (c.vehicleId === vehicleId) write(c, 'viewers', { vehicleId, count });
}

/**
 * Nueva puja aceptada.
 * @param {object} v   vehículo ya actualizado (incluye leaderId, solo en servidor)
 * @param {Set} bidders ids de usuarios que han pujado en este vehículo
 */
export function broadcastBid(v, { prevLeader, bidders, bid, minNext, title, lote, danio }) {
  const serverNow = Date.now();
  for (const c of clients.values()) {
    let you = null;
    if (c.userId && c.userId === v.leaderId) you = 'leading';
    else if (c.userId && bidders.has(c.userId)) you = 'outbid';
    write(c, 'bid', {
      vehicleId: v.id,
      currentBid: v.currentBid,
      bidCount: v.bidCount,
      minNext,
      lastBidAt: v.lastBidAt,
      serverNow,
      you,
      title,
      lote,
      danio,
      entry: { id: bid.id, amount: bid.amount, at: bid.at, mine: c.userId === bid.userId },
    });
    if (prevLeader && prevLeader !== v.leaderId && c.userId === prevLeader) {
      write(c, 'outbid', { vehicleId: v.id, title, currentBid: v.currentBid, minNext });
    }
  }
}

export function broadcastClosed(v, { title, bidders }) {
  for (const c of clients.values()) {
    let you = null;
    if (c.userId) {
      if (c.userId === v.ownerId) you = 'owner';
      else if (c.userId === v.leaderId && v.resultado === 'vendido') you = 'won';
      else if (bidders.has(c.userId)) you = 'lost';
    }
    write(c, 'closed', {
      vehicleId: v.id,
      title,
      resultado: v.resultado,
      currentBid: v.currentBid || 0,
      bidCount: v.bidCount || 0,
      you,
      serverNow: Date.now(),
    });
  }
}

export function broadcast(event, data) {
  for (const c of clients.values()) write(c, event, { ...data, serverNow: Date.now() });
}

export function stats() {
  return { connections: clients.size };
}
