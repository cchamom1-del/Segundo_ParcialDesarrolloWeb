/**
 * Generador de fotografías ilustradas (SVG) para los vehículos de demostración.
 * Así la demo no depende de imágenes externas con derechos de autor.
 * Cada vehículo recibe 6 vistas: lateral, frontal, trasera, interior, motor y detalle de daño.
 */

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
};

const BG = {
  lateral: ['#eaf2ff', '#fdfdfd'],
  frontal: ['#fff4e0', '#fdfdfd'],
  trasera: ['#eafaf1', '#fdfdfd'],
  interior: ['#f3effa', '#fbfaff'],
  motor: ['#eef1f5', '#fafbfc'],
  detalle: ['#fff0f0', '#fffafa'],
};

function frame(view, label, lote, inner) {
  const [a, b] = BG[view];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" width="960" height="640">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe5ee"/><stop offset="1" stop-color="#c9d2de"/></linearGradient>
<radialGradient id="shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1b2433" stop-opacity=".35"/><stop offset="1" stop-color="#1b2433" stop-opacity="0"/></radialGradient>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe3ff"/><stop offset="1" stop-color="#8fb0d9"/></linearGradient>
</defs>
<rect width="960" height="640" fill="url(#bg)"/>
<rect y="470" width="960" height="170" fill="url(#floor)"/>
<g opacity=".25" stroke="#9aa8bb" stroke-width="2">${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 120}" y1="470" x2="${i * 120 - 160}" y2="640"/>`).join('')}</g>
${inner}
<g font-family="Segoe UI, Arial, sans-serif">
<rect x="24" y="24" rx="14" width="${34 + label.length * 11}" height="40" fill="#ffffff" opacity=".92"/>
<text x="40" y="51" font-size="19" font-weight="700" fill="#1b2433">${label}</text>
<rect x="${936 - 150}" y="24" rx="14" width="150" height="40" fill="#1e5eff"/>
<text x="${936 - 75}" y="51" font-size="17" font-weight="700" fill="#fff" text-anchor="middle">LOTE ${lote}</text>
</g></svg>`;
}

function wheel(cx, cy, r) {
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#20252e"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="#c9d0da"/>
${Array.from({ length: 5 }, (_, i) => { const a = (i * 72 * Math.PI) / 180; return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(a) * r * 0.55}" y2="${cy + Math.sin(a) * r * 0.55}" stroke="#8b95a3" stroke-width="${r * 0.12}" stroke-linecap="round"/>`; }).join('')}
<circle cx="${cx}" cy="${cy}" r="${r * 0.14}" fill="#5b6573"/></g>`;
}

function damageMarks(level, spots) {
  if (level === 'verde') return spots.slice(0, 1).map(([x, y]) => `<path d="M${x} ${y} l18 6 l-10 4 l16 5" stroke="#7a8594" stroke-width="2" fill="none" opacity=".55"/>`).join('');
  const color = level === 'rojo' ? '#8a1c1f' : '#6b5a2a';
  const count = level === 'rojo' ? spots.length : 2;
  return spots
    .slice(0, count)
    .map(([x, y], i) => `<g opacity=".85"><ellipse cx="${x}" cy="${y}" rx="${level === 'rojo' ? 46 : 28}" ry="${level === 'rojo' ? 26 : 16}" fill="${color}" opacity=".25"/>
<path d="M${x - 30} ${y - 8} l14 10 l8 -12 l12 16 l10 -9 l14 12" stroke="${color}" stroke-width="3" fill="none"/>
${level === 'rojo' && i === 0 ? `<path d="M${x - 12} ${y - 30} l20 18 l-6 6 l22 16" stroke="#1b2433" stroke-width="2.5" fill="none"/>` : ''}</g>`)
    .join('');
}

function bodyPath(type) {
  // Silueta lateral (vista de perfil) según tipo de carrocería
  if (type === 'pickup')
    return 'M110 405 L125 330 Q135 305 170 300 L330 295 L380 225 Q392 210 420 208 L560 206 Q585 206 598 225 L630 292 L840 292 Q860 292 862 312 L866 405 Z';
  if (type === 'suv')
    return 'M110 405 L118 318 Q125 290 165 285 L270 278 L340 205 Q352 192 380 190 L660 188 Q700 188 720 210 L790 280 Q845 290 858 320 L864 405 Z';
  return 'M110 405 L120 340 Q130 312 175 305 L290 295 L370 228 Q385 216 410 214 L610 212 Q640 212 660 230 L735 292 Q840 305 856 340 L862 405 Z';
}

function lateral(c, type, danio) {
  const dark = shade(c, -45), light = shade(c, 45);
  const win =
    type === 'pickup'
      ? '<path d="M398 232 L428 222 L555 220 Q572 220 580 234 L604 288 L385 290 Z" fill="url(#glass)"/>'
      : type === 'suv'
      ? '<path d="M355 212 Q365 202 385 202 L650 200 Q680 200 695 216 L760 280 L300 284 Z" fill="url(#glass)"/><rect x="520" y="200" width="12" height="86" fill="' + dark + '"/>'
      : '<path d="M385 236 Q395 226 415 226 L600 225 Q625 225 640 240 L700 290 L315 294 Z" fill="url(#glass)"/><rect x="505" y="224" width="12" height="70" fill="' + dark + '"/>';
  return `<ellipse cx="490" cy="470" rx="420" ry="34" fill="url(#shadow)"/>
<path d="${bodyPath(type)}" fill="${c}" stroke="${dark}" stroke-width="4"/>
<path d="M120 360 L860 360" stroke="${light}" stroke-width="6" opacity=".6"/>
${win}
<rect x="130" y="330" width="40" height="16" rx="6" fill="#ffe7a3"/><rect x="826" y="330" width="30" height="16" rx="6" fill="#ff7b7b"/>
${wheel(250, 410, 62)}${wheel(725, 410, 62)}
${damageMarks(danio, [[640, 350], [330, 360], [760, 330]])}`;
}

function frontal(c, danio) {
  const dark = shade(c, -45);
  return `<ellipse cx="480" cy="470" rx="300" ry="30" fill="url(#shadow)"/>
<path d="M230 440 L220 330 Q225 300 260 290 L320 200 Q330 186 355 184 L605 184 Q630 186 640 200 L700 290 Q735 300 740 330 L730 440 Z" fill="${c}" stroke="${dark}" stroke-width="4"/>
<path d="M340 205 L620 205 L672 285 L288 285 Z" fill="url(#glass)"/>
<rect x="265" y="315" width="100" height="36" rx="12" fill="#fff6d6" stroke="${dark}" stroke-width="3"/>
<rect x="595" y="315" width="100" height="36" rx="12" fill="#fff6d6" stroke="${dark}" stroke-width="3"/>
<rect x="390" y="320" width="180" height="60" rx="10" fill="#2b313b"/>
${Array.from({ length: 5 }, (_, i) => `<line x1="400" y1="${332 + i * 10}" x2="560" y2="${332 + i * 10}" stroke="#56606e" stroke-width="3"/>`).join('')}
<rect x="420" y="400" width="120" height="26" rx="4" fill="#fff" stroke="#9aa6b5"/>
<rect x="232" y="430" width="60" height="40" rx="8" fill="#20252e"/><rect x="668" y="430" width="60" height="40" rx="8" fill="#20252e"/>
${damageMarks(danio, [[640, 380], [300, 400], [480, 250]])}`;
}

function trasera(c, danio) {
  const dark = shade(c, -45);
  return `<ellipse cx="480" cy="470" rx="300" ry="30" fill="url(#shadow)"/>
<path d="M230 440 L222 320 Q228 296 262 290 L322 206 Q332 192 356 190 L604 190 Q628 192 638 206 L698 290 Q732 296 738 320 L730 440 Z" fill="${c}" stroke="${dark}" stroke-width="4"/>
<path d="M345 210 L615 210 L660 280 L300 280 Z" fill="url(#glass)"/>
<rect x="250" y="305" width="120" height="30" rx="8" fill="#ff5a5f"/><rect x="590" y="305" width="120" height="30" rx="8" fill="#ff5a5f"/>
<rect x="415" y="355" width="130" height="32" rx="4" fill="#fff" stroke="#9aa6b5"/>
<text x="480" y="378" font-family="Arial" font-size="18" font-weight="700" fill="#1b2433" text-anchor="middle">P-GT</text>
<rect x="232" y="430" width="60" height="40" rx="8" fill="#20252e"/><rect x="668" y="430" width="60" height="40" rx="8" fill="#20252e"/>
${damageMarks(danio, [[330, 400], [620, 360], [480, 420]])}`;
}

function interior(c) {
  return `<rect x="80" y="150" width="800" height="330" rx="40" fill="#e6e1d8"/>
<path d="M80 300 Q480 220 880 300 L880 480 L80 480 Z" fill="#3a3f48"/>
<rect x="400" y="300" width="160" height="90" rx="12" fill="#1b2433"/><rect x="412" y="312" width="136" height="66" rx="8" fill="#5aa0ff" opacity=".8"/>
<circle cx="270" cy="360" r="95" fill="none" stroke="#22262d" stroke-width="22"/><circle cx="270" cy="360" r="28" fill="${c}"/>
<rect x="650" y="330" width="170" height="16" rx="8" fill="#555c68"/><rect x="650" y="360" width="140" height="16" rx="8" fill="#555c68"/>`;
}

function motor(c) {
  return `<rect x="150" y="170" width="660" height="300" rx="30" fill="#b9c1cc"/>
<rect x="260" y="220" width="440" height="190" rx="18" fill="#4a525e"/>
${Array.from({ length: 4 }, (_, i) => `<rect x="${295 + i * 100}" y="245" width="70" height="40" rx="8" fill="#6f7886"/>`).join('')}
<rect x="300" y="310" width="360" height="70" rx="14" fill="${c}"/>
<text x="480" y="354" font-family="Arial" font-size="26" font-weight="800" fill="#fff" text-anchor="middle">MOTOR</text>
<circle cx="205" cy="230" r="30" fill="#f2c94c"/><circle cx="755" cy="230" r="30" fill="#56ccf2"/>`;
}

function detalle(c, danio) {
  const dark = shade(c, -40);
  return `<rect x="0" y="120" width="960" height="360" fill="${c}"/>
<path d="M0 300 Q480 260 960 300" stroke="${shade(c, 50)}" stroke-width="10" fill="none" opacity=".6"/>
<path d="M0 120 L960 120" stroke="${dark}" stroke-width="8"/>
${wheel(740, 470, 150)}
${damageMarks(danio === 'verde' ? 'verde' : danio, [[360, 300], [220, 250], [480, 340]])}
${danio === 'verde' ? '<text x="300" y="220" font-family="Arial" font-size="30" font-weight="700" fill="#fff" opacity=".9">Sin daño visible</text>' : ''}`;
}

const VIEWS = [
  ['lateral', 'Vista lateral'],
  ['frontal', 'Vista frontal'],
  ['trasera', 'Vista trasera'],
  ['interior', 'Interior'],
  ['motor', 'Compartimiento de motor'],
  ['detalle', 'Detalle de daño'],
];

export function carPhotos({ color, body, danio, lote }) {
  return VIEWS.map(([view, label]) => {
    const inner =
      view === 'lateral' ? lateral(color, body, danio)
      : view === 'frontal' ? frontal(color, danio)
      : view === 'trasera' ? trasera(color, danio)
      : view === 'interior' ? interior(color)
      : view === 'motor' ? motor(color)
      : detalle(color, danio);
    const svg = frame(view, label, lote, inner).replace(/\n/g, '');
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  });
}
