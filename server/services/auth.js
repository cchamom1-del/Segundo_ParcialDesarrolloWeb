import { getStore } from '../db/index.js';
import { config } from '../config.js';
import { HttpError } from '../lib/http.js';
import { emailKey, hashPassword, newId, signJwt, verifyJwt, verifyPassword } from '../lib/security.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,40}$/;

export function passwordIssues(pw) {
  const issues = [];
  if (typeof pw !== 'string' || pw.length < 8) issues.push('mínimo 8 caracteres');
  if (!/[a-z]/.test(pw || '')) issues.push('una minúscula');
  if (!/[A-Z]/.test(pw || '')) issues.push('una mayúscula');
  if (!/\d/.test(pw || '')) issues.push('un número');
  if (!/[^A-Za-z0-9]/.test(pw || '')) issues.push('un símbolo');
  return issues;
}

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, telefono: u.telefono, role: u.role, createdAt: u.createdAt };
}

function issueToken(u) {
  return signJwt({ sub: u.id, role: u.role, name: `${u.nombre} ${u.apellido}` }, config.jwtSecret, config.jwtExpiresSec);
}

export async function register(body) {
  const db = getStore();
  const nombre = String(body.nombre || '').trim();
  const apellido = String(body.apellido || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const telefono = String(body.telefono || '').replace(/[\s-]/g, '');
  const password = body.password;

  const errors = {};
  if (!NAME_RE.test(nombre)) errors.nombre = 'Ingresa un nombre válido (solo letras).';
  if (!NAME_RE.test(apellido)) errors.apellido = 'Ingresa un apellido válido (solo letras).';
  if (!EMAIL_RE.test(email) || email.length > 120) errors.email = 'Correo electrónico inválido.';
  if (!/^(\+?502)?\d{8}$/.test(telefono)) errors.telefono = 'Teléfono de 8 dígitos (puede iniciar con +502).';
  const pwIssues = passwordIssues(password);
  if (pwIssues.length) errors.password = `La contraseña necesita: ${pwIssues.join(', ')}.`;
  if (Object.keys(errors).length) throw new HttpError(422, 'Revisa los datos del formulario.', { fields: errors });

  const key = emailKey(email);
  if (await db.get(`usersByEmail/${key}`)) {
    throw new HttpError(409, 'Ya existe una cuenta con ese correo.', { fields: { email: 'Este correo ya está registrado.' } });
  }

  const user = {
    id: newId(),
    nombre,
    apellido,
    email,
    telefono,
    role: 'usuario',
    passwordHash: await hashPassword(password),
    createdAt: Date.now(),
  };
  await db.update('', { [`users/${user.id}`]: user, [`usersByEmail/${key}`]: user.id });
  return { token: issueToken(user), user: publicUser(user) };
}

export async function login(body) {
  const db = getStore();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const uid = email ? await db.get(`usersByEmail/${emailKey(email)}`) : null;
  const user = uid ? await db.get(`users/${uid}`) : null;
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!valid) throw new HttpError(401, 'Correo o contraseña incorrectos.');
  return { token: issueToken(user), user: publicUser(user) };
}

/** Devuelve el usuario autenticado (o null) leyendo el header Authorization */
export async function userFromRequest(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const payload = verifyJwt(token, config.jwtSecret);
  if (!payload) return null;
  const hit = userCache.get(payload.sub);
  if (hit && hit.exp > Date.now()) return hit.user;
  const user = await getStore().get(`users/${payload.sub}`);
  if (user) userCache.set(payload.sub, { user, exp: Date.now() + 60_000 });
  return user || null;
}
const userCache = new Map();

export async function getUser(id) {
  return publicUser(await getStore().get(`users/${id}`));
}
