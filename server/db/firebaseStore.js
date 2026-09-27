import crypto from 'node:crypto';

/**
 * Cliente de Firebase Realtime Database vía REST (sin SDK).
 * Autenticación con cuenta de servicio (OAuth2 JWT firmado RS256) o, en su
 * defecto, con el "database secret" heredado.
 * Las transacciones usan ETag + If-Match: si otro proceso escribió primero,
 * Firebase responde 412 y se reintenta con el valor más reciente.
 */
export function createFirebaseStore({ databaseUrl, serviceAccount, dbSecret }) {
  let sa = null;
  if (serviceAccount) {
    const raw = serviceAccount.trim().startsWith('{')
      ? serviceAccount
      : Buffer.from(serviceAccount, 'base64').toString('utf8');
    sa = JSON.parse(raw);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }
  if (!sa && !dbSecret) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT o FIREBASE_DB_SECRET');

  let token = null;
  let tokenExp = 0;

  async function accessToken() {
    if (!sa) return null;
    if (token && Date.now() < tokenExp - 60_000) return token;
    const now = Math.floor(Date.now() / 1000);
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned =
      enc({ alg: 'RS256', typ: 'JWT' }) +
      '.' +
      enc({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      });
    const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${signature}`,
      }),
    });
    if (!res.ok) throw new Error(`No se pudo obtener token de Firebase: ${res.status} ${await res.text()}`);
    const json = await res.json();
    token = json.access_token;
    tokenExp = Date.now() + json.expires_in * 1000;
    return token;
  }

  async function url(p) {
    const clean = String(p)
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/');
    const t = await accessToken();
    const q = t ? `access_token=${encodeURIComponent(t)}` : `auth=${encodeURIComponent(dbSecret)}`;
    return `${databaseUrl}/${clean}.json?${q}`;
  }

  async function call(method, p, body, headers = {}) {
    const res = await fetch(await url(p), {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res;
  }

  async function ok(res) {
    if (!res.ok) throw new Error(`Firebase ${res.status}: ${await res.text()}`);
    return res.json();
  }

  const pathLocks = new Map();
  async function locked(key, fn) {
    const prev = pathLocks.get(key) || Promise.resolve();
    let done;
    const cur = new Promise((r) => (done = r));
    pathLocks.set(key, prev.then(() => cur));
    await prev;
    try {
      return await fn();
    } finally {
      done();
    }
  }

  return {
    kind: 'firebase',
    async get(p) {
      return ok(await call('GET', p));
    },
    async set(p, value) {
      if (value === null || value === undefined) return this.remove(p);
      const r = await call('PUT', p, value, { 'X-Firebase-Print': 'silent' });
      if (!r.ok && r.status !== 204) throw new Error(`Firebase ${r.status}: ${await r.text()}`);
    },
    async update(p, values) {
      const r = await call('PATCH', p, values, { 'X-Firebase-Print': 'silent' });
      if (!r.ok && r.status !== 204) throw new Error(`Firebase ${r.status}: ${await r.text()}`);
    },
    async remove(p) {
      const r = await call('DELETE', p);
      if (!r.ok && r.status !== 204) throw new Error(`Firebase ${r.status}: ${await r.text()}`);
    },
    async transaction(p, fn) {
      return locked(p, async () => {
        const res = await call('GET', p, undefined, { 'X-Firebase-ETag': 'true' });
        if (!res.ok) throw new Error(`Firebase ${res.status}: ${await res.text()}`);
        let etag = res.headers.get('etag');
        let current = await res.json();
        for (let attempt = 0; attempt < 15; attempt++) {
          const next = fn(current);
          if (next === undefined) return { committed: false, value: current };
          const w = await call('PUT', p, next, { 'if-match': etag, 'X-Firebase-ETag': 'true' });
          if (w.status === 412) {
            // Otro escritor ganó la carrera: Firebase devuelve el valor actual y su nuevo ETag
            etag = w.headers.get('etag');
            current = await w.json();
            continue;
          }
          if (!w.ok) throw new Error(`Firebase ${w.status}: ${await w.text()}`);
          await w.text();
          return { committed: true, value: next };
        }
        throw new Error('Demasiada concurrencia, intenta de nuevo');
      });
    },
    flush() {},
  };
}
