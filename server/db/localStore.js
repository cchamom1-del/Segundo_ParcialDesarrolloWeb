import fs from 'node:fs';
import path from 'node:path';

/**
 * Almacén local en archivo JSON con la MISMA interfaz de rutas que Firebase
 * Realtime Database. Se usa en desarrollo o si no hay credenciales de Firebase.
 */
export function createLocalStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let root = {};
  if (fs.existsSync(file)) {
    try {
      root = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    } catch {
      root = {};
    }
  }

  let timer = null;
  const persist = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(root));
      fs.renameSync(tmp, file);
    }, 150);
  };
  const flush = () => {
    clearTimeout(timer);
    fs.writeFileSync(file, JSON.stringify(root));
  };
  process.on('exit', flush);

  const segs = (p) => String(p).split('/').filter(Boolean);
  const clone = (v) => (v === undefined || v === null ? null : structuredClone(v));
  const isEmpty = (v) => v === null || v === undefined || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

  function getSync(p) {
    let node = root;
    for (const s of segs(p)) {
      if (node === null || typeof node !== 'object' || !(s in node)) return null;
      node = node[s];
    }
    return clone(node);
  }

  function setSync(p, value) {
    const parts = segs(p);
    if (value === null || value === undefined) return removeSync(p);
    if (!parts.length) {
      root = clone(value);
      return;
    }
    let node = root;
    for (const s of parts.slice(0, -1)) {
      if (node[s] === null || typeof node[s] !== 'object') node[s] = {};
      node = node[s];
    }
    node[parts.at(-1)] = clone(value);
  }

  function removeSync(p) {
    const parts = segs(p);
    if (!parts.length) {
      root = {};
      return;
    }
    const stack = [root];
    let node = root;
    for (const s of parts.slice(0, -1)) {
      if (!node || typeof node !== 'object' || !(s in node)) return;
      node = node[s];
      stack.push(node);
    }
    if (node && typeof node === 'object') delete node[parts.at(-1)];
    // Poda objetos vacíos como hace RTDB
    for (let i = stack.length - 1; i > 0; i--) {
      if (isEmpty(stack[i])) delete stack[i - 1][parts[i - 1]];
    }
  }

  return {
    kind: 'local',
    async get(p) {
      return getSync(p);
    },
    async set(p, value) {
      setSync(p, value);
      persist();
    },
    /** update multi-ruta: { 'a/b': 1, 'c': {...} } relativo a p */
    async update(p, values) {
      for (const [k, v] of Object.entries(values)) setSync(`${p}/${k}`, v);
      persist();
    },
    async remove(p) {
      removeSync(p);
      persist();
    },
    async transaction(p, fn) {
      const current = getSync(p);
      const next = fn(current);
      if (next === undefined) return { committed: false, value: current };
      setSync(p, next);
      persist();
      return { committed: true, value: clone(next) };
    },
    flush,
  };
}
