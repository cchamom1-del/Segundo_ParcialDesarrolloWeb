import crypto from 'node:crypto';
import { getStore } from '../db/index.js';
import { config } from '../config.js';
import { HttpError } from '../lib/http.js';
import { newId, withLock } from '../lib/security.js';
import { COMBUSTIBLES, CILINDROS, DANIOS, TIPOS, TRACCIONES, TRANSMISIONES } from './catalogs.js';
import * as rt from './realtime.js';

const db = () => getStore();
const fmtQ = (n) => 'Q ' + Number(n).toLocaleString('es-GT', { maximumFractionDigits: 0 });

/* ======================= Reglas de negocio ======================= */

export function minNextBid(v) {
  if (!v.bidCount) return Math.ceil(v.precioBase);
  // Debe superar la oferta actual por al menos 10 %
  return Math.ceil((v.currentBid * (100 + config.minIncrementPct)) / 100);
}

export function statusOf(v, now = Date.now()) {
  if (v.status === 'cerrada' || now >= v.cierre) return 'cerrada';
  if (now < v.inicio) return 'proxima';
  return 'en-vivo';
}

export function resultOf(v) {
  return v.bidCount > 0 && v.currentBid >= v.precioBase ? 'vendido' : 'desierto';
}

export const titleOf = (v) => `${v.anio} ${v.marca} ${v.modelo}`;

/** Vista pública: NUNCA incluye leaderId ni datos del dueño */
export function publicVehicle(v, user) {
  const now = Date.now();
  const status = statusOf(v, now);
  const uid = user?.id;
  const out = {
    id: v.id,
    lote: v.lote,
    anio: v.anio,
    tipo: v.tipo,
    marca: v.marca,
    modelo: v.modelo,
    motor: v.motor,
    transmision: v.transmision,
    combustible: v.combustible,
    traccion: v.traccion,
    cilindros: v.cilindros,
    danio: v.danio,
    color: v.color || '',
    kilometraje: v.kilometraje ?? null,
    vin: v.vin ? maskVin(v.vin) : '',
    descripcion: v.descripcion || '',
    cover: v.cover,
    photoCount: v.photoCount || 0,
    precioBase: v.precioBase,
    inicio: v.inicio,
    cierre: v.cierre,
    currentBid: v.currentBid || 0,
    bidCount: v.bidCount || 0,
    lastBidAt: v.lastBidAt || null,
    minNext: minNextBid(v),
    status,
    resultado: status === 'cerrada' ? v.resultado || resultOf(v) : null,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    isOwner: !!uid && v.ownerId === uid,
    isLeader: !!uid && v.leaderId === uid,
  };
  return out;
}

const maskVin = (vin) => (vin.length > 6 ? vin.slice(0, vin.length - 6) + '******' : vin);

/* ======================= Validación ======================= */

const IMG_RE = /^data:image\/(jpeg|jpg|png|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const URL_RE = /^https:\/\/[^\s"'<>]+$/i;

function validPhoto(p) {
  if (typeof p !== 'string') return false;
  if (p.startsWith('data:')) return p.length < 2_000_000 && IMG_RE.test(p);
  return p.length < 2000 && URL_RE.test(p);
}

function validateInput(body, existing) {
  const e = {};
  const year = new Date().getFullYear() + 1;
  const str = (k, max = 60) => String(body[k] ?? '').trim().slice(0, max);

  const v = {
    anio: Number(body.anio),
    tipo: str('tipo'),
    marca: str('marca', 40),
    modelo: str('modelo', 40),
    motor: str('motor', 40),
    transmision: str('transmision'),
    combustible: str('combustible'),
    traccion: str('traccion'),
    cilindros: Number(body.cilindros),
    danio: str('danio'),
    color: str('color', 30),
    kilometraje: body.kilometraje === '' || body.kilometraje == null ? null : Number(body.kilometraje),
    vin: str('vin', 17).toUpperCase(),
    descripcion: str('descripcion', 1500),
    precioBase: Number(body.precioBase),
    inicio: Number(body.inicio),
    cierre: Number(body.cierre),
  };

  if (!Number.isInteger(v.anio) || v.anio < 1980 || v.anio > year) e.anio = `Año entre 1980 y ${year}.`;
  if (!TIPOS.includes(v.tipo)) e.tipo = 'Selecciona el tipo de artículo.';
  if (v.marca.length < 2) e.marca = 'Selecciona o escribe la marca.';
  if (v.modelo.length < 1) e.modelo = 'Indica el modelo.';
  if (v.motor.length < 2) e.motor = 'Describe el motor (ej. 2.0L I4).';
  if (!TRANSMISIONES.includes(v.transmision)) e.transmision = 'Selecciona la transmisión.';
  if (!COMBUSTIBLES.includes(v.combustible)) e.combustible = 'Selecciona el combustible.';
  if (!TRACCIONES.includes(v.traccion)) e.traccion = 'Selecciona el tren de manejo.';
  if (!CILINDROS.includes(v.cilindros)) e.cilindros = 'Selecciona el número de cilindros.';
  if (!DANIOS[v.danio]) e.danio = 'Clasifica el estado de daño.';
  if (v.kilometraje !== null && (!Number.isFinite(v.kilometraje) || v.kilometraje < 0 || v.kilometraje > 2_000_000)) e.kilometraje = 'Kilometraje inválido.';
  if (existing && (body.vin === undefined || body.vin === null)) v.vin = existing.vin || '';
  else if (v.vin && !/^[A-HJ-NPR-Z0-9]{11,17}$/.test(v.vin)) e.vin = 'VIN inválido (11 a 17 caracteres, sin I, O, Q).';

  if (!Number.isFinite(v.precioBase) || v.precioBase < 1000 || v.precioBase > 50_000_000) e.precioBase = 'Monto base entre Q 1,000 y Q 50,000,000.';
  v.precioBase = Math.round(v.precioBase);

  const now = Date.now();
  if (!Number.isFinite(v.inicio)) e.inicio = 'Fecha y hora de inicio requerida.';
  if (!Number.isFinite(v.cierre)) e.cierre = 'Fecha y hora de cierre requerida.';
  if (!e.inicio && !e.cierre) {
    if (v.cierre <= v.inicio) e.cierre = 'El cierre debe ser posterior al inicio.';
    else if (v.cierre - v.inicio < 5 * 60_000) e.cierre = 'La subasta debe durar al menos 5 minutos.';
    else if (v.cierre - v.inicio > 60 * 86_400_000) e.cierre = 'La subasta no puede durar más de 60 días.';
    if (v.cierre <= now + 60_000 && (!existing || v.cierre !== existing.cierre)) e.cierre = 'El cierre debe estar en el futuro.';
    if (!existing && v.inicio < now - 10 * 60_000) e.inicio = 'El inicio no puede estar en el pasado.';
  }

  // Fotos
  let photos = body.photos;
  if (photos !== undefined || !existing) {
    if (!Array.isArray(photos)) photos = [];
    if (photos.length < config.minPhotos) e.photos = `Se requieren mínimo ${config.minPhotos} fotografías.`;
    else if (photos.length > config.maxPhotos) e.photos = `Máximo ${config.maxPhotos} fotografías.`;
    else if (!photos.every(validPhoto)) e.photos = 'Alguna fotografía no es válida (JPG, PNG, WEBP o URL https).';
  }
  let cover = body.cover;
  if (cover !== undefined && cover !== null && !validPhoto(cover)) cover = null;

  // Reglas de edición cuando ya hay ofertas
  if (existing) {
    const status = statusOf(existing);
    if (status === 'cerrada') throw new HttpError(409, 'La subasta ya finalizó; no se puede editar.');
    if (existing.bidCount > 0) {
      if (v.precioBase !== existing.precioBase) e.precioBase = 'No puedes cambiar el monto base: ya hay ofertas.';
      if (v.inicio !== existing.inicio) e.inicio = 'No puedes cambiar el inicio: ya hay ofertas.';
      if (v.cierre < existing.cierre) e.cierre = 'Con ofertas activas solo puedes extender el cierre.';
    } else if (status === 'en-vivo' && v.inicio !== existing.inicio && v.inicio < now - 10 * 60_000) {
      e.inicio = 'El inicio no puede estar en el pasado.';
    }
  }

  if (Object.keys(e).length) throw new HttpError(422, 'Revisa los campos marcados.', { fields: e });
  return { data: v, photos, cover };
}

/* ======================= CRUD ======================= */

/* Caché en memoria del inventario: el servidor es el único escritor, así que
   se mantiene sincronizada en cada escritura y se refresca cada 5 minutos.
   Evita leer toda la base en cada petición (ahorra cuota de Firebase). */
let cache = null;
let cacheLoading = null;
async function loadCache() {
  const all = (await db().get('vehicles')) || {};
  cache = new Map(Object.entries(all));
}
export async function listAll() {
  if (!cache) await (cacheLoading ||= loadCache().finally(() => (cacheLoading = null)));
  return [...cache.values()];
}
const cachePut = (v) => cache && v && cache.set(v.id, v);
const cacheDel = (id) => cache && cache.delete(id);
export function invalidateCache() {
  cache = null;
}
setInterval(() => loadCache().catch(() => {}), 5 * 60_000).unref();

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function applyFilters(items, q) {
  const list = (k) => (q[k] ? String(q[k]).split(',').filter(Boolean) : null);
  const danios = list('danio');
  const estados = list('estado');
  const marcas = list('marca');
  const combustibles = list('combustible');
  const transmisiones = list('transmision');
  const tracciones = list('traccion');
  const tipos = list('tipo');
  const cilindros = list('cilindros')?.map(Number);
  const text = norm(q.q).trim();
  const num = (k) => (q[k] !== undefined && q[k] !== '' && !isNaN(q[k]) ? Number(q[k]) : null);
  const anioMin = num('anioMin'), anioMax = num('anioMax'), precioMin = num('precioMin'), precioMax = num('precioMax');

  return items.filter((v) => {
    if (danios && !danios.includes(v.danio)) return false;
    if (estados && !estados.includes(v.status)) return false;
    if (marcas && !marcas.includes(v.marca)) return false;
    if (q.modelo && v.modelo !== q.modelo) return false;
    if (combustibles && !combustibles.includes(v.combustible)) return false;
    if (transmisiones && !transmisiones.includes(v.transmision)) return false;
    if (tracciones && !tracciones.includes(v.traccion)) return false;
    if (tipos && !tipos.includes(v.tipo)) return false;
    if (cilindros && !cilindros.includes(v.cilindros)) return false;
    if (anioMin !== null && v.anio < anioMin) return false;
    if (anioMax !== null && v.anio > anioMax) return false;
    const price = v.currentBid || v.precioBase;
    if (precioMin !== null && price < precioMin) return false;
    if (precioMax !== null && price > precioMax) return false;
    if (text) {
      const hay = norm(`${v.anio} ${v.marca} ${v.modelo} ${v.motor} ${v.tipo} ${v.color} ${v.lote} ${v.combustible} ${v.transmision}`);
      if (!text.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

const STATUS_ORDER = { 'en-vivo': 0, proxima: 1, cerrada: 2 };
export function sortItems(items, sort = 'relevancia') {
  const price = (v) => v.currentBid || v.precioBase;
  const cmp = {
    relevancia: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.status === 'cerrada' ? b.cierre - a.cierre : (a.status === 'proxima' ? a.inicio - b.inicio : a.cierre - b.cierre)),
    'cierre-asc': (a, b) => a.cierre - b.cierre,
    'precio-asc': (a, b) => price(a) - price(b),
    'precio-desc': (a, b) => price(b) - price(a),
    'anio-desc': (a, b) => b.anio - a.anio,
    recientes: (a, b) => b.createdAt - a.createdAt,
    pujas: (a, b) => b.bidCount - a.bidCount,
  }[sort] || (() => 0);
  return [...items].sort(cmp);
}

function facets(items) {
  const count = (k) => items.reduce((acc, v) => ((acc[v[k]] = (acc[v[k]] || 0) + 1), acc), {});
  return {
    marca: count('marca'),
    danio: count('danio'),
    status: count('status'),
    combustible: count('combustible'),
    transmision: count('transmision'),
    traccion: count('traccion'),
    tipo: count('tipo'),
  };
}

export async function search(query, user) {
  const all = (await listAll()).map((v) => publicVehicle(v, user));
  const filtered = sortItems(applyFilters(all, query), query.sort);
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(60, Math.max(1, Number(query.size) || 24));
  return {
    total: filtered.length,
    page,
    size,
    items: filtered.slice((page - 1) * size, page * size),
    facets: facets(all),
    serverNow: Date.now(),
  };
}

export async function getRaw(id) {
  await listAll();
  const v = cache.get(id) || null;
  if (!v) throw new HttpError(404, 'Vehículo no encontrado.');
  return v;
}

export async function getDetail(id, user) {
  const v = await getRaw(id);
  const photos = normArr(await db().get(`photos/${id}`));
  const credits = normArr(await db().get(`photoCredits/${id}`));
  const history = await getHistory(id, user);
  const out = publicVehicle(v, user);
  let myMax = null;
  if (user) {
    const b = await db().get(`bidders/${id}/${user.id}`);
    myMax = b?.max ?? null;
  }
  return { ...out, photos, credits, history, myMax, viewers: rt.viewersOf(id), serverNow: Date.now() };
}

const normArr = (x) => (Array.isArray(x) ? x.filter(Boolean) : x && typeof x === 'object' ? Object.values(x) : []);

async function uniqueLote() {
  for (let i = 0; i < 10; i++) {
    const lote = String(crypto.randomInt(40_000_000, 99_999_999));
    const all = await listAll();
    if (!all.some((v) => v.lote === lote)) return lote;
  }
  return String(Date.now()).slice(-8);
}

export async function create(body, user) {
  const { data, photos, cover } = validateInput(body, null);
  const id = newId();
  const now = Date.now();
  const v = {
    ...data,
    id,
    lote: await uniqueLote(),
    ownerId: user.id,
    cover: cover || photos[0],
    photoCount: photos.length,
    currentBid: 0,
    bidCount: 0,
    status: 'activa',
    createdAt: now,
    updatedAt: now,
  };
  await db().update('', { [`vehicles/${id}`]: v, [`photos/${id}`]: photos });
  cachePut(v);
  rt.broadcast('catalog', { type: 'created', vehicleId: id });
  return publicVehicle(v, user);
}

function assertCanManage(v, user) {
  if (v.ownerId !== user.id && user.role !== 'admin') throw new HttpError(403, 'Solo el publicador puede modificar este vehículo.');
}

export async function update(id, body, user) {
  return withLock(`bid:${id}`, async () => {
    const existing = await getRaw(id);
    assertCanManage(existing, user);
    const { data, photos, cover } = validateInput(body, existing);
    const res = await db().transaction(`vehicles/${id}`, (cur) => {
      if (!cur) return undefined;
      if (cur.bidCount !== existing.bidCount && (data.precioBase !== cur.precioBase || data.inicio !== cur.inicio)) return undefined;
      return {
        ...cur,
        ...data,
        cover: photos ? cover || photos[0] : cover || cur.cover,
        photoCount: photos ? photos.length : cur.photoCount,
        updatedAt: Date.now(),
      };
    });
    if (!res.committed) throw new HttpError(409, 'El vehículo recibió ofertas mientras editabas. Recarga e intenta de nuevo.');
    cachePut(res.value);
    if (photos) {
      // Conserva los créditos de las fotos que se mantienen (alineados por posición)
      const oldPhotos = normArr(await db().get(`photos/${id}`));
      const oldCredits = normArr(await db().get(`photoCredits/${id}`));
      const credits = photos.map((p) => oldCredits[oldPhotos.indexOf(p)] || { none: true });
      await db().set(`photos/${id}`, photos);
      if (credits.some((c) => !c.none)) await db().set(`photoCredits/${id}`, credits);
      else await db().remove(`photoCredits/${id}`);
    }
    rt.broadcast('catalog', { type: 'updated', vehicleId: id });
    return publicVehicle(res.value, user);
  });
}

export async function remove(id, user) {
  return withLock(`bid:${id}`, async () => {
    const v = await getRaw(id);
    assertCanManage(v, user);
    if (v.bidCount > 0 && user.role !== 'admin') throw new HttpError(409, 'No puedes eliminar una publicación que ya tiene ofertas.');
    await db().update('', { [`vehicles/${id}`]: null, [`photos/${id}`]: null, [`photoCredits/${id}`]: null, [`bids/${id}`]: null, [`bidders/${id}`]: null });
    cacheDel(id);
    rt.broadcast('catalog', { type: 'deleted', vehicleId: id });
    return { ok: true };
  });
}

export async function myVehicles(user, query) {
  let all = await listAll();
  if (!(user.role === 'admin' && query.all === '1')) all = all.filter((v) => v.ownerId === user.id);
  const items = all.map((v) => publicVehicle(v, user));
  let owners = {};
  if (user.role === 'admin' && query.all === '1') {
    const users = (await db().get('users')) || {};
    for (const v of all) {
      const u = users[v.ownerId];
      owners[v.id] = u ? `${u.nombre} ${u.apellido}` : '—';
    }
  }
  const filtered = sortItems(applyFilters(items, query), query.sort || 'recientes').map((v) => ({ ...v, ownerName: owners[v.id] }));
  return { total: filtered.length, items: filtered, serverNow: Date.now() };
}

/* ======================= Pujas ======================= */

export async function getHistory(id, user) {
  const bids = (await db().get(`bids/${id}`)) || {};
  return Object.values(bids)
    .sort((a, b) => b.at - a.at)
    .slice(0, 25)
    .map((b) => ({ id: b.id, amount: b.amount, at: b.at, mine: !!user && b.userId === user.id }));
}

export async function placeBid(id, rawAmount, user) {
  const amount = Number(String(rawAmount ?? '').replace(/[, ]/g, ''));
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0 || amount > 1e10) {
    throw new HttpError(422, 'Ingresa un monto entero válido en quetzales.');
  }

  return withLock(`bid:${id}`, async () => {
    let fail = null;
    let prevLeader = null;
    const now = Date.now();
    const res = await db().transaction(`vehicles/${id}`, (v) => {
      fail = null;
      if (!v) return void (fail = [404, 'Vehículo no encontrado.']);
      if (v.ownerId === user.id) return void (fail = [403, 'No puedes ofertar en tu propio vehículo.']);
      const status = statusOf(v, now);
      if (status === 'proxima') return void (fail = [409, 'La subasta aún no ha iniciado.']);
      if (status === 'cerrada') return void (fail = [409, 'Oferta cerrada: el tiempo de la subasta terminó.']);
      if (v.leaderId === user.id) return void (fail = [409, 'Ya tienes la oferta más alta en esta subasta.']);
      const min = minNextBid(v);
      if (amount < min) {
        const msg = v.bidCount
          ? `Tu oferta debe superar la actual (${fmtQ(v.currentBid)}) por al menos 10 %: mínimo ${fmtQ(min)}.`
          : `La oferta no puede ser menor al monto base: mínimo ${fmtQ(min)}.`;
        return void (fail = [422, msg, { minNext: min, currentBid: v.currentBid || 0 }]);
      }
      prevLeader = v.leaderId || null;
      return { ...v, currentBid: amount, bidCount: (v.bidCount || 0) + 1, leaderId: user.id, lastBidAt: now, updatedAt: now };
    });
    if (!res.committed) throw new HttpError(...(fail || [409, 'No se pudo registrar la oferta.']));

    const v = res.value;
    cachePut(v);
    const bid = { id: newId(), amount, at: now, userId: user.id };
    const prevMine = await db().get(`bidders/${id}/${user.id}`);
    await db().update('', {
      [`bids/${id}/${bid.id}`]: bid,
      [`bidders/${id}/${user.id}`]: { max: amount, at: now, count: (prevMine?.count || 0) + 1 },
      [`userBids/${user.id}/${id}`]: { max: amount, at: now },
    });
    const bidders = new Set(Object.keys((await db().get(`bidders/${id}`)) || {}));
    const minNext = minNextBid(v);
    pushRecent(v, bid);
    rt.broadcastBid(v, { prevLeader, bidders, bid, minNext, title: titleOf(v), lote: v.lote, danio: v.danio });
    return { ok: true, vehicle: publicVehicle(v, user), bid: { id: bid.id, amount, at: now, mine: true } };
  });
}

export async function myBids(user) {
  const mine = (await db().get(`userBids/${user.id}`)) || {};
  const out = [];
  for (const [vid, info] of Object.entries(mine)) {
    const v = (await getRaw(vid).catch(() => null));
    if (!v) continue;
    const pv = publicVehicle(v, user);
    out.push({ ...pv, myMax: info.max, myLastAt: info.at });
  }
  out.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.cierre - b.cierre);
  return { items: out, serverNow: Date.now() };
}

/* ======================= Cierre automático ======================= */

export async function closeDue() {
  const now = Date.now();
  const due = (await listAll()).filter((v) => v.status !== 'cerrada' && now >= v.cierre);
  for (const d of due) {
    await withLock(`bid:${d.id}`, async () => {
      const res = await db().transaction(`vehicles/${d.id}`, (v) => {
        if (!v || v.status === 'cerrada' || Date.now() < v.cierre) return undefined;
        return { ...v, status: 'cerrada', resultado: resultOf(v), closedAt: Date.now() };
      });
      if (res.committed) {
        const v = res.value;
        cachePut(v);
        const bidders = new Set(Object.keys((await db().get(`bidders/${v.id}`)) || {}));
        rt.broadcastClosed(v, { title: titleOf(v), bidders });
        console.log(`[subasta] Lote ${v.lote} cerrado → ${v.resultado}${v.bidCount ? ' por ' + fmtQ(v.currentBid) : ''}`);
      }
    });
  }
}

/** Avisa a los clientes cuando una subasta programada entra en vivo */
const announced = new Set();
export async function announceStarts() {
  const now = Date.now();
  for (const v of await listAll()) {
    if (v.status !== 'cerrada' && v.inicio <= now && now - v.inicio < 30_000 && !announced.has(v.id)) {
      announced.add(v.id);
      rt.broadcast('started', { vehicleId: v.id, title: titleOf(v) });
    }
  }
}

/** Últimas pujas de toda la plataforma (para el tablero en vivo del Home) */
let recentCache = { at: 0, items: [] };
export async function recentBids(limit = 12) {
  if (Date.now() - recentCache.at > 10_000) {
    const all = (await db().get('bids')) || {};
    const vehiclesById = new Map((await listAll()).map((v) => [v.id, v]));
    const items = [];
    for (const [vid, bids] of Object.entries(all)) {
      const v = vehiclesById.get(vid);
      if (!v) continue;
      for (const b of Object.values(bids)) items.push({ vehicleId: vid, lote: v.lote, title: titleOf(v), danio: v.danio, amount: b.amount, at: b.at });
    }
    items.sort((a, b) => b.at - a.at);
    recentCache = { at: Date.now(), items: items.slice(0, 30) };
  }
  return recentCache.items.slice(0, limit);
}
export function pushRecent(v, bid) {
  recentCache.items.unshift({ vehicleId: v.id, lote: v.lote, title: titleOf(v), danio: v.danio, amount: bid.amount, at: bid.at });
  recentCache.items = recentCache.items.slice(0, 30);
}

export async function stats() {
  const all = await listAll();
  const now = Date.now();
  const byStatus = { 'en-vivo': 0, proxima: 0, cerrada: 0 };
  let bids = 0;
  let volume = 0;
  for (const v of all) {
    byStatus[statusOf(v, now)]++;
    bids += v.bidCount || 0;
    if (statusOf(v, now) === 'en-vivo') volume += v.currentBid || 0;
  }
  return { total: all.length, ...byStatus, bids, volumeLive: volume, online: rt.stats().connections, serverNow: now };
}
