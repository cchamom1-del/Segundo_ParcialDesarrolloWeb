/* Cliente de la API REST (fetch) + estado de sesión */
import { syncClock } from './util.js';

const TOKEN_KEY = 'autopuja.token';
const USER_KEY = 'autopuja.user';
const listeners = new Set();

export const session = {
  token: localStorage.getItem(TOKEN_KEY),
  user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  get isAuth() {
    return !!this.token && !!this.user;
  },
  set(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    listeners.forEach((fn) => fn(this));
  },
  clear() {
    this.set(null, null);
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `Error ${status}`);
    this.status = status;
    this.data = data || {};
    this.fields = data?.fields || {};
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, { error: 'Sin conexión con el servidor. Revisa tu internet.' });
  }
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (data?.serverNow) syncClock(data.serverNow);
  if (res.status === 401 && session.token && !path.startsWith('/api/auth/login')) {
    session.clear();
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

let catalogPromise = null;
export const getCatalogs = () => (catalogPromise ||= api('/api/catalogs'));
