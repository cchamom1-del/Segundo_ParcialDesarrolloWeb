import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

// Carga opcional de un archivo .env (sin dependencias)
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT) || 3000,
  isProd,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion',
  jwtExpiresSec: 60 * 60 * 12, // 12 horas
  minIncrementPct: 10, // 10 %
  maxPhotos: 12,
  minPhotos: 5,
  bodyLimit: 30 * 1024 * 1024,
  clientDir: path.join(ROOT, 'client'),
  dataFile: process.env.DATA_FILE || path.join(ROOT, 'data', 'db.json'),
  seedOnStart: process.env.SEED_ON_START !== 'false',
  firebase: {
    databaseUrl: (process.env.FIREBASE_DATABASE_URL || '').replace(/\/+$/, ''),
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || '',
    dbSecret: process.env.FIREBASE_DB_SECRET || '',
  },
};

if (isProd && config.jwtSecret.startsWith('dev-')) {
  console.warn('[config] ADVERTENCIA: JWT_SECRET no está configurado en producción.');
}
