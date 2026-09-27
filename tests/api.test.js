// Pruebas de integración de reglas de negocio: node --test tests/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3999;
const B = `http://localhost:${PORT}`;
const dataFile = path.join(os.tmpdir(), `autopuja-test-${Date.now()}.json`);
let srv;

const j = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(B + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
};
const login = async (email) => (await j('/api/auth/login', { method: 'POST', body: { email, password: 'Subasta#2026' } })).data.token;
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

before(async () => {
  srv = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT, DATA_FILE: dataFile, FIREBASE_DATABASE_URL: '' }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(B + '/api/health')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('El servidor no arrancó');
});
after(() => {
  srv.kill();
  fs.rmSync(dataFile, { force: true });
});

test('registro valida contraseña segura y campos', async () => {
  const bad = await j('/api/auth/register', { method: 'POST', body: { nombre: 'Test', apellido: 'User', email: 'x@y.com', telefono: '12345678', password: 'abc' } });
  assert.equal(bad.status, 422);
  assert.ok(bad.data.fields.password);
  const ok = await j('/api/auth/register', { method: 'POST', body: { nombre: 'Test', apellido: 'User', email: 'nuevo@test.gt', telefono: '12345678', password: 'Segura#123' } });
  assert.equal(ok.status, 201);
  assert.ok(ok.data.token);
  assert.equal(ok.data.user.passwordHash, undefined);
});

test('anónimo solo lee: no puede publicar ni ofertar', async () => {
  const list = await j('/api/vehicles');
  assert.equal(list.status, 200);
  assert.ok(list.data.items.length > 0);
  assert.equal((await j('/api/vehicles', { method: 'POST', body: {} })).status, 401);
  assert.equal((await j(`/api/vehicles/${list.data.items[0].id}/bids`, { method: 'POST', body: { amount: 1 } })).status, 401);
});

test('nunca se expone la identidad del líder', async () => {
  const list = await j('/api/vehicles');
  for (const v of list.data.items) {
    assert.equal(v.leaderId, undefined);
    assert.equal(v.ownerId, undefined);
  }
  const d = await j(`/api/vehicles/${list.data.items[0].id}`);
  for (const h of d.data.history) assert.equal(h.userId, undefined);
});

test('reglas de puja: base, incremento 10 %, pujas simultáneas', async () => {
  const ana = await login('ana@autopuja.gt');
  const carlos = await login('carlos@autopuja.gt');
  const lucia = await login('lucia@autopuja.gt');
  const nuevo = (await j('/api/auth/login', { method: 'POST', body: { email: 'nuevo@test.gt', password: 'Segura#123' } })).data.token;
  const now = Date.now();
  const photos = Array(5).fill(photo);
  const created = await j('/api/vehicles', {
    method: 'POST', token: ana,
    body: { anio: 2020, tipo: 'Automóvil', marca: 'Toyota', modelo: 'Yaris', motor: '1.5L', transmision: 'Manual', combustible: 'Gasolina', traccion: 'FWD', cilindros: 4, danio: 'verde', precioBase: 20000, inicio: now, cierre: now + 3600_000, photos },
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.id;

  assert.equal((await j(`/api/vehicles/${id}/bids`, { method: 'POST', token: ana, body: { amount: 30000 } })).status, 403, 'dueño no puede ofertar');
  assert.equal((await j(`/api/vehicles/${id}/bids`, { method: 'POST', token: carlos, body: { amount: 19999 } })).status, 422, 'menor al base');
  assert.equal((await j(`/api/vehicles/${id}/bids`, { method: 'POST', token: carlos, body: { amount: 20000 } })).status, 201);
  const low = await j(`/api/vehicles/${id}/bids`, { method: 'POST', token: lucia, body: { amount: 21999 } });
  assert.equal(low.status, 422, 'menos de 10 %');
  assert.equal(low.data.minNext, 22000);

  // Dos postores envían la misma oferta al mismo tiempo: solo una puede ganar
  const [a, b] = await Promise.all([
    j(`/api/vehicles/${id}/bids`, { method: 'POST', token: lucia, body: { amount: 22000 } }),
    j(`/api/vehicles/${id}/bids`, { method: 'POST', token: nuevo, body: { amount: 22000 } }),
  ]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [201, 422], 'la segunda oferta simultánea debe rechazarse');

  const d = await j(`/api/vehicles/${id}`);
  assert.equal(d.data.currentBid, 22000);
  assert.equal(d.data.bidCount, 2);
  assert.equal(d.data.minNext, 24200);
});

test('validación de publicación: mínimo 5 fotos y campos obligatorios', async () => {
  const ana = await login('ana@autopuja.gt');
  const r = await j('/api/vehicles', { method: 'POST', token: ana, body: { anio: 2020, photos: [photo] } });
  assert.equal(r.status, 422);
  assert.ok(r.data.fields.photos);
  assert.ok(r.data.fields.marca);
  assert.ok(r.data.fields.danio);
});

test('filtros multitarea', async () => {
  const r = await j('/api/vehicles?danio=rojo,amarillo&combustible=Gasolina&anioMin=2017');
  assert.equal(r.status, 200);
  for (const v of r.data.items) {
    assert.ok(['rojo', 'amarillo'].includes(v.danio));
    assert.equal(v.combustible, 'Gasolina');
    assert.ok(v.anio >= 2017);
  }
  const q = await j('/api/vehicles?q=tacoma');
  assert.ok(q.data.items.every((v) => v.modelo === 'Tacoma'));
});

test('subastas finalizadas no aceptan ofertas', async () => {
  const carlos = await login('carlos@autopuja.gt');
  const closed = (await j('/api/vehicles?estado=cerrada')).data.items;
  assert.ok(closed.length >= 1);
  const r = await j(`/api/vehicles/${closed[0].id}/bids`, { method: 'POST', token: carlos, body: { amount: 999999 } });
  assert.equal(r.status === 403 ? 409 : r.status, 409);
});
