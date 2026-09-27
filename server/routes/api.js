import { config } from '../config.js';
import { Router, HttpError, createRateLimiter, clientIp } from '../lib/http.js';
import * as auth from '../services/auth.js';
import * as vehicles from '../services/vehicles.js';
import * as rt from '../services/realtime.js';
import { catalogs } from '../services/catalogs.js';

export const api = new Router();
const loginLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 20 });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 10 });

/* ---------- Salud / utilidades ---------- */
api.get('/api/health', async () => ({ ok: true, serverNow: Date.now() }));
api.get('/api/time', async () => ({ serverNow: Date.now() }));
api.get('/api/stats', async () => vehicles.stats());

/* ---------- Autenticación ---------- */
api.post('/api/auth/register', async ({ req, body }) => {
  registerLimiter(clientIp(req));
  return { status: 201, data: await auth.register(body) };
});
api.post('/api/auth/login', async ({ req, body }) => {
  loginLimiter(clientIp(req));
  return auth.login(body);
});
api.get('/api/auth/me', async ({ user }) => ({ user: auth.publicUser(user) }), { auth: true });

/* ---------- Catálogos ---------- */
api.get('/api/catalogs', async () => catalogs());

/* ---------- Vehículos (inventario) ---------- */
api.get('/api/vehicles', async ({ query, user }) => vehicles.search(query, user));
api.get('/api/vehicles/:id', async ({ params, user }) => vehicles.getDetail(params.id, user));
api.post('/api/vehicles', async ({ body, user }) => ({ status: 201, data: await vehicles.create(body, user) }), { auth: true });
api.put('/api/vehicles/:id', async ({ params, body, user }) => vehicles.update(params.id, body, user), { auth: true });
api.delete('/api/vehicles/:id', async ({ params, user }) => vehicles.remove(params.id, user), { auth: true });

/* ---------- Pujas ---------- */
api.get('/api/bids/recent', async ({ query }) => ({ items: await vehicles.recentBids(Math.min(30, Number(query.limit) || 12)), serverNow: Date.now() }));
api.get('/api/vehicles/:id/bids', async ({ params, user }) => ({ items: await vehicles.getHistory(params.id, user) }));
api.post('/api/vehicles/:id/bids', async ({ params, body, user }) => ({ status: 201, data: await vehicles.placeBid(params.id, body.amount, user) }), { auth: true });

/* ---------- Panel del usuario ---------- */
api.get('/api/me/vehicles', async ({ user, query }) => vehicles.myVehicles(user, query), { auth: true });
api.get('/api/me/bids', async ({ user }) => vehicles.myBids(user), { auth: true });

/* ---------- Tiempo real (SSE) ---------- */
api.post('/api/stream/ticket', async ({ user }) => ({ ticket: rt.createTicket(user.id) }), { auth: true });
api.post('/api/stream/watch', async ({ body }) => {
  const ok = rt.watch(String(body.clientId || ''), body.vehicleId ? String(body.vehicleId) : null);
  if (!ok) throw new HttpError(404, 'Conexión en vivo no encontrada');
  return { ok };
});

export { config };
