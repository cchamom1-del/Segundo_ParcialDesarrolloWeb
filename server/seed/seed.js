import { getStore } from '../db/index.js';
import { emailKey, hashPassword, newId } from '../lib/security.js';
import { carPhotos } from './carArt.js';
import { invalidateCache } from '../services/vehicles.js';

export const DEMO_USERS = [
  { key: 'ana', nombre: 'Ana', apellido: 'López', email: 'ana@autopuja.gt', telefono: '55123456', password: 'Subasta#2026', role: 'usuario' },
  { key: 'carlos', nombre: 'Carlos', apellido: 'Méndez', email: 'carlos@autopuja.gt', telefono: '44221133', password: 'Subasta#2026', role: 'usuario' },
  { key: 'lucia', nombre: 'Lucía', apellido: 'Ramírez', email: 'lucia@autopuja.gt', telefono: '30987654', password: 'Subasta#2026', role: 'usuario' },
  { key: 'admin', nombre: 'Admin', apellido: 'AutoPuja', email: 'admin@autopuja.gt', telefono: '22000000', password: 'Admin#2026', role: 'admin' },
];

const H = 3_600_000;
const D = 24 * H;

// start/end relativos al momento del seed; bids: [usuario, monto]
const DEMO_VEHICLES = [
  { owner: 'ana', anio: 2021, tipo: 'Automóvil', marca: 'Toyota', modelo: 'Corolla', motor: '1.8L I4', transmision: 'CVT', combustible: 'Gasolina', traccion: 'FWD', cilindros: 4, danio: 'verde', color: 'Blanco perla', kilometraje: 38500, vin: '5YFBURHE1MP123456', precioBase: 85000, start: -2 * D, end: 12 * D, body: 'sedan', hex: '#f4f6f8', bids: [['carlos', 85000], ['lucia', 93500], ['carlos', 103000]], descripcion: 'Golpe leve en defensa trasera. Enciende y camina. Título limpio de Florida, ideal para importación.' },
  { owner: 'carlos', anio: 2019, tipo: 'Pickup', marca: 'Toyota', modelo: 'Tacoma', motor: '3.5L V6', transmision: 'Automática', combustible: 'Gasolina', traccion: '4WD', cilindros: 6, danio: 'amarillo', color: 'Gris metálico', kilometraje: 72100, vin: '3TMCZ5AN2KM234567', precioBase: 140000, start: -1 * D, end: 9 * D, body: 'pickup', hex: '#8a94a3', bids: [['ana', 140000], ['lucia', 154000]], descripcion: 'Daño en guardafango delantero derecho y faro. Motor en buen estado. Llaves disponibles.' },
  { owner: 'lucia', anio: 2020, tipo: 'SUV', marca: 'Honda', modelo: 'CR-V', motor: '1.5L Turbo I4', transmision: 'CVT', combustible: 'Gasolina', traccion: 'AWD', cilindros: 4, danio: 'rojo', color: 'Rojo', kilometraje: 54300, vin: '2HKRW2H83LH345678', precioBase: 60000, start: -3 * D, end: 7 * D, body: 'suv', hex: '#d64545', bids: [['ana', 60000]], descripcion: 'Impacto frontal fuerte, bolsas de aire activadas. Vendido como salvamento; excelente para partes.' },
  { owner: 'ana', anio: 2022, tipo: 'SUV', marca: 'Hyundai', modelo: 'Tucson', motor: '2.5L I4', transmision: 'Automática', combustible: 'Gasolina', traccion: 'AWD', cilindros: 4, danio: 'verde', color: 'Azul', kilometraje: 21000, vin: 'KM8JBCAE4NU456789', precioBase: 120000, start: -6 * H, end: 14 * D, body: 'suv', hex: '#2f6fdd', bids: [], descripcion: 'Rayones menores en puerta trasera. Interior impecable, un solo dueño.' },
  { owner: 'carlos', anio: 2018, tipo: 'Automóvil', marca: 'Honda', modelo: 'Civic', motor: '2.0L I4', transmision: 'Manual', combustible: 'Gasolina', traccion: 'FWD', cilindros: 4, danio: 'amarillo', color: 'Negro', kilometraje: 88000, vin: '2HGFC2F52JH567890', precioBase: 45000, start: -12 * H, end: 10 * D, body: 'sedan', hex: '#4a4f58', bids: [['lucia', 45000], ['ana', 49500], ['lucia', 55000]], descripcion: 'Golpe lateral izquierdo, puertas a reemplazar. Transmisión manual de 6 velocidades.' },
  { owner: 'lucia', anio: 2023, tipo: 'Automóvil', marca: 'Tesla', modelo: 'Model 3', motor: 'Eléctrico dual', transmision: 'Automática', combustible: 'Eléctrico', traccion: 'AWD', cilindros: 0, danio: 'amarillo', color: 'Blanco', kilometraje: 15200, vin: '5YJ3E1EB1PF678901', precioBase: 175000, start: -1 * D, end: 11 * D, body: 'sedan', hex: '#eef1f5', bids: [['carlos', 175000]], descripcion: 'Daño en suspensión trasera. Batería al 92 % de salud. Autopilot incluido.' },
  { owner: 'ana', anio: 2017, tipo: 'Pickup', marca: 'Ford', modelo: 'F-150', motor: '5.0L V8', transmision: 'Automática', combustible: 'Gasolina', traccion: '4WD', cilindros: 8, danio: 'rojo', color: 'Azul marino', kilometraje: 121000, vin: '1FTEW1EF3HF789012', precioBase: 55000, start: -2 * D, end: 8 * D, body: 'pickup', hex: '#27466f', bids: [], descripcion: 'Volcadura, techo hundido. Motor V8 recuperable. Vendido para partes.' },
  { owner: 'carlos', anio: 2021, tipo: 'SUV', marca: 'Jeep', modelo: 'Wrangler', motor: '3.6L V6', transmision: 'Automática', combustible: 'Gasolina', traccion: '4WD', cilindros: 6, danio: 'verde', color: 'Verde militar', kilometraje: 30500, vin: '1C4HJXDG8MW890123', precioBase: 190000, start: 1 * D, end: 15 * D, body: 'suv', hex: '#5c7a4b', bids: [], descripcion: 'Unlimited Sahara. Daño cosmético mínimo. Subasta programada: inicia mañana.' },
  { owner: 'lucia', anio: 2016, tipo: 'Automóvil', marca: 'Mazda', modelo: 'Mazda3', motor: '2.0L I4', transmision: 'Automática', combustible: 'Gasolina', traccion: 'FWD', cilindros: 4, danio: 'verde', color: 'Gris', kilometraje: 97000, vin: '3MZBM1V74GM901234', precioBase: 38000, start: 2 * D, end: 13 * D, body: 'sedan', hex: '#9aa3ad', bids: [], descripcion: 'Granizo leve en capó. Servicios al día. Subasta programada.' },
  { owner: 'ana', anio: 2020, tipo: 'SUV', marca: 'Kia', modelo: 'Sportage', motor: '2.4L I4', transmision: 'Automática', combustible: 'Gasolina', traccion: 'FWD', cilindros: 4, danio: 'amarillo', color: 'Plateado', kilometraje: 64000, vin: 'KNDPM3AC5L7012345', precioBase: 70000, start: -9 * D, end: -1 * D, body: 'suv', hex: '#b8c0ca', bids: [['carlos', 70000], ['lucia', 77000], ['carlos', 85000]], descripcion: 'Subasta finalizada (ejemplo de subasta vendida).' },
  { owner: 'carlos', anio: 2015, tipo: 'Automóvil', marca: 'Nissan', modelo: 'Sentra', motor: '1.8L I4', transmision: 'CVT', combustible: 'Gasolina', traccion: 'FWD', cilindros: 4, danio: 'rojo', color: 'Blanco', kilometraje: 140000, vin: '3N1AB7AP9FY123450', precioBase: 25000, start: -8 * D, end: -2 * D, body: 'sedan', hex: '#f0f0f0', bids: [], descripcion: 'Subasta finalizada sin ofertas (ejemplo de subasta desierta).' },
  { owner: 'lucia', anio: 2019, tipo: 'Pickup', marca: 'Mitsubishi', modelo: 'L200', motor: '2.4L Diésel I4', transmision: 'Manual', combustible: 'Diésel', traccion: '4WD', cilindros: 4, danio: 'amarillo', color: 'Café', kilometraje: 99000, vin: 'MMBJYKL10KH234561', precioBase: 95000, start: -4 * H, end: 6 * D, body: 'pickup', hex: '#8b6b4a', bids: [['ana', 95000], ['carlos', 104500]], descripcion: 'Doble cabina diésel. Daño en palangana. Ideal para trabajo.' },
];

function lote(i) {
  return String(58_300_000 + i * 7919 + 1234);
}

export async function seed({ reset = false } = {}) {
  const db = getStore();
  if (reset) {
    for (const p of ['users', 'usersByEmail', 'vehicles', 'photos', 'bids', 'bidders', 'userBids']) await db.remove(p);
  }
  const now = Date.now();
  const ids = {};
  const updates = {};

  for (const u of DEMO_USERS) {
    const id = newId();
    ids[u.key] = id;
    updates[`users/${id}`] = {
      id, nombre: u.nombre, apellido: u.apellido, email: u.email, telefono: u.telefono, role: u.role,
      passwordHash: await hashPassword(u.password), createdAt: now - 30 * D,
    };
    updates[`usersByEmail/${emailKey(u.email)}`] = id;
  }

  DEMO_VEHICLES.forEach((d, i) => {
    const id = newId();
    const lt = lote(i);
    const photos = carPhotos({ color: d.hex, body: d.body, danio: d.danio, lote: lt });
    const inicio = now + d.start;
    const cierre = now + d.end;
    let currentBid = 0, leaderId = null, lastBidAt = null;
    const bidders = {};
    d.bids.forEach(([who, amount], k) => {
      const uid = ids[who];
      const at = Math.min(now - 60_000, inicio + (k + 1) * 3 * H);
      const bid = { id: newId(), amount, at, userId: uid };
      updates[`bids/${id}/${bid.id}`] = bid;
      bidders[uid] = { max: amount, at, count: (bidders[uid]?.count || 0) + 1 };
      updates[`userBids/${uid}/${id}`] = { max: amount, at };
      currentBid = amount; leaderId = uid; lastBidAt = at;
    });
    for (const [uid, b] of Object.entries(bidders)) updates[`bidders/${id}/${uid}`] = b;
    const closed = cierre <= now;
    updates[`vehicles/${id}`] = {
      id, lote: lt, ownerId: ids[d.owner],
      anio: d.anio, tipo: d.tipo, marca: d.marca, modelo: d.modelo, motor: d.motor, transmision: d.transmision,
      combustible: d.combustible, traccion: d.traccion, cilindros: d.cilindros, danio: d.danio, color: d.color,
      kilometraje: d.kilometraje, vin: d.vin, descripcion: d.descripcion,
      cover: photos[0], photoCount: photos.length,
      precioBase: d.precioBase, inicio, cierre,
      currentBid, bidCount: d.bids.length, ...(leaderId ? { leaderId, lastBidAt } : {}),
      status: closed ? 'cerrada' : 'activa',
      ...(closed ? { resultado: d.bids.length ? 'vendido' : 'desierto', closedAt: cierre } : {}),
      createdAt: inicio - D, updatedAt: now,
    };
    updates[`photos/${id}`] = photos;
  });

  // Escritura en bloques para no exceder límites de tamaño por petición
  const entries = Object.entries(updates);
  for (let i = 0; i < entries.length; i += 40) {
    await db.update('', Object.fromEntries(entries.slice(i, i + 40)));
  }
  invalidateCache();
  console.log(`[seed] ${DEMO_USERS.length} usuarios y ${DEMO_VEHICLES.length} vehículos de demostración creados.`);
}

export async function seedIfEmpty() {
  const users = await getStore().get('usersByEmail');
  if (!users) await seed();
}
