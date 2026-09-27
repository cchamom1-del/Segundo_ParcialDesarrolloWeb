import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { api } from './routes/api.js';
import { HttpError, readJson, sendJson } from './lib/http.js';
import { userFromRequest } from './services/auth.js';
import { openStream } from './services/realtime.js';
import { closeDue, announceStarts } from './services/vehicles.js';
import { getStore } from './db/index.js';
import { seedIfEmpty } from './seed/seed.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  let file = path.normalize(path.join(config.clientDir, rel));
  if (!file.startsWith(config.clientDir)) {
    res.writeHead(403).end();
    return;
  }
  let stat = fs.existsSync(file) ? fs.statSync(file) : null;
  if (!stat || stat.isDirectory()) {
    // Fallback del SPA: rutas sin extensión → index.html
    if (path.extname(rel)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('No encontrado');
      return;
    }
    file = path.join(config.clientDir, 'index.html');
    stat = fs.statSync(file);
  }
  const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag }).end();
    return;
  }
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
    ETag: etag,
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;
  const started = Date.now();

  // CORS (útil si el frontend se aloja en otro dominio)
  const origin = req.headers.origin;
  if (origin && pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
  }

  try {
    if (pathname === '/api/stream' && req.method === 'GET') {
      return openStream(req, res, url.searchParams.get('ticket'));
    }

    if (pathname.startsWith('/api/')) {
      const m = api.match(req.method, pathname);
      if (!m) throw new HttpError(404, 'Ruta no encontrada');
      if (m.methodNotAllowed) throw new HttpError(405, 'Método no permitido');
      const user = await userFromRequest(req);
      if (m.route.opts.auth && !user) throw new HttpError(401, 'Debes iniciar sesión para realizar esta acción.');
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readJson(req, config.bodyLimit) : {};
      const query = Object.fromEntries(url.searchParams);
      const out = await m.route.handler({ req, res, params: m.params, query, body, user });
      if (out && typeof out === 'object' && 'status' in out && 'data' in out) sendJson(res, out.status, out.data);
      else sendJson(res, 200, out ?? { ok: true });
      if (!config.isProd) console.log(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - started}ms`);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Método no permitido');
    serveStatic(req, res, pathname);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'Error interno del servidor' : err.message, ...(err.details || {}) });
    else res.end();
  }
});

async function main() {
  getStore();
  if (config.seedOnStart) await seedIfEmpty();

  // Motor de cierre: revisa cada segundo las subastas vencidas
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await closeDue();
      await announceStarts();
    } catch (e) {
      console.error('[scheduler]', e.message);
    } finally {
      busy = false;
    }
  }, 1000);

  server.listen(config.port, () => console.log(`🚗 AutoPuja GT escuchando en http://localhost:${config.port}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    getStore().flush?.();
    process.exit(0);
  });
}
