import crypto from 'node:crypto';

/* ---------- JWT HS256 implementado con crypto nativo ---------- */
const b64u = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

export function signJwt(payload, secret, expiresInSec) {
  const now = Math.floor(Date.now() / 1000);
  const data = b64u({ alg: 'HS256', typ: 'JWT' }) + '.' + b64u({ ...payload, iat: now, exp: now + expiresInSec });
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyJwt(token, secret) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();
  let given;
  try {
    given = Buffer.from(s, 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const header = JSON.parse(Buffer.from(h, 'base64url').toString());
    if (header.alg !== 'HS256') return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------- Contraseñas con scrypt (sal aleatoria por usuario) ---------- */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => {
      if (err) return reject(err);
      resolve(`scrypt$${SCRYPT.N}$${salt.toString('base64')}$${key.toString('base64')}`);
    });
  });
}

export function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    try {
      const [alg, n, saltB64, hashB64] = String(stored).split('$');
      if (alg !== 'scrypt') return resolve(false);
      const hash = Buffer.from(hashB64, 'base64');
      crypto.scrypt(password, Buffer.from(saltB64, 'base64'), hash.length, { N: Number(n), r: 8, p: 1 }, (err, key) => {
        if (err) return resolve(false);
        resolve(crypto.timingSafeEqual(key, hash));
      });
    } catch {
      resolve(false);
    }
  });
}

/* ---------- IDs ordenables en el tiempo (estilo push-id de Firebase) ---------- */
const ALPHABET = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let lastTime = 0;
let lastRand = [];
export function newId() {
  let now = Date.now();
  const dup = now === lastTime;
  lastTime = now;
  const time = new Array(8);
  for (let i = 7; i >= 0; i--) {
    time[i] = ALPHABET.charAt(now % 64);
    now = Math.floor(now / 64);
  }
  if (!dup) {
    lastRand = Array.from(crypto.randomBytes(12), (b) => b % 64);
  } else {
    let i = 11;
    for (; i >= 0 && lastRand[i] === 63; i--) lastRand[i] = 0;
    lastRand[i]++;
  }
  return time.join('') + lastRand.map((r) => ALPHABET.charAt(r)).join('');
}

export const emailKey = (email) => Buffer.from(String(email).trim().toLowerCase()).toString('base64url');

/** Mutex por clave: serializa operaciones críticas (pujas, cierres) dentro del proceso */
const locks = new Map();
export async function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((r) => (release = r));
  const chain = prev.then(() => current);
  locks.set(key, chain);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === chain) locks.delete(key);
  }
}
