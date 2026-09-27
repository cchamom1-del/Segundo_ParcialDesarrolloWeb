import { route, start, navigate } from './router.js';
import { session, api } from './api.js';
import { esc, toast, beep, flashTitle, fmtQ } from './util.js';
import { startClock } from './components/clock.js';
import * as rt from './realtime.js';

/* ---------- Rutas ---------- */
const needAuth = () => (session.isAuth ? null : `/login?next=${encodeURIComponent(location.pathname + location.search)}`);
const guestOnly = () => (session.isAuth ? '/' : null);

route('/', () => import('./pages/home.js'));
route('/vehiculo/:id', () => import('./pages/detail.js'));
route('/login', () => import('./pages/login.js'), { guard: guestOnly });
route('/registro', () => import('./pages/register.js'), { guard: guestOnly });
route('/publicar', () => import('./pages/publish.js'), { guard: needAuth });
route('/editar/:id', () => import('./pages/publish.js'), { guard: needAuth });
route('/mis-publicaciones', () => import('./pages/myListings.js'), { guard: needAuth });
route('/mis-pujas', () => import('./pages/myBids.js'), { guard: needAuth });
route('/404', () => import('./pages/notFound.js'), { notFound: true });

/* ---------- Navegación ---------- */
const nav = document.getElementById('nav');
const menuBtn = document.getElementById('menuBtn');

function renderNav() {
  const p = location.pathname;
  const link = (href, label, extra = '') => `<a href="${href}" class="${p === href ? 'active' : ''} ${extra}" ${p === href ? 'aria-current="page"' : ''}>${label}</a>`;
  if (session.isAuth) {
    const u = session.user;
    nav.innerHTML = `
      ${link('/', 'Inventario')}
      ${link('/mis-pujas', 'Mis pujas')}
      ${link('/mis-publicaciones', 'Mis publicaciones')}
      <a href="/publicar" class="btn btn-accent btn-sm nav-cta">Publicar vehículo</a>
      <div class="user-chip" title="${esc(u.email)}">
        <span class="avatar" aria-hidden="true">${esc((u.nombre[0] || '') + (u.apellido[0] || ''))}</span>
        <span class="user-name">${esc(u.nombre)}${u.role === 'admin' ? ' <em>admin</em>' : ''}</span>
        <button type="button" class="link-btn" id="logout">Salir</button>
      </div>`;
    nav.querySelector('#logout').onclick = () => {
      session.clear();
      toast('Cerraste sesión.', { type: 'info' });
      navigate('/');
    };
  } else {
    nav.innerHTML = `${link('/', 'Inventario')}
      <a href="/login" class="${p === '/login' ? 'active' : ''}">Iniciar sesión</a>
      <a href="/registro" class="btn btn-primary btn-sm nav-cta">Crear cuenta</a>`;
  }
}

menuBtn.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  menuBtn.setAttribute('aria-expanded', open);
});
document.addEventListener('route', () => {
  document.body.classList.remove('menu-open');
  menuBtn.setAttribute('aria-expanded', 'false');
  renderNav();
});
session.onChange(renderNav);

/* ---------- Avisos globales en tiempo real ---------- */
rt.on('outbid', (d) => {
  if (location.pathname === `/vehiculo/${d.vehicleId}`) return; // la página ya lo muestra
  toast(`Nueva oferta de ${fmtQ(d.currentBid)} en ${d.title}. ¡Haz tu oferta antes de que termine el tiempo!`, {
    type: 'error',
    title: 'Tu oferta ha sido superada',
    timeout: 9000,
    action: { href: `/vehiculo/${d.vehicleId}`, label: 'Ofertar' },
  });
  beep('alert');
  flashTitle('⚠ Te superaron');
});
rt.on('closed', (d) => {
  if (d.you === 'won') {
    toast(`Ganaste ${d.title} por ${fmtQ(d.currentBid)}.`, { type: 'success', title: '¡Subasta ganada!', timeout: 12000, action: { href: `/vehiculo/${d.vehicleId}`, label: 'Ver' } });
    beep('win');
    flashTitle('🏆 ¡Ganaste!');
  } else if (d.you === 'lost') {
    toast(`La subasta de ${d.title} cerró en ${fmtQ(d.currentBid)}.`, { type: 'info', title: 'Subasta finalizada' });
  } else if (d.you === 'owner') {
    toast(d.resultado === 'vendido' ? `Tu ${d.title} se vendió por ${fmtQ(d.currentBid)}.` : `Tu ${d.title} cerró sin alcanzar el monto base.`, { type: d.resultado === 'vendido' ? 'success' : 'info', title: 'Tu subasta finalizó', timeout: 10000 });
  }
});

/* ---------- Indicador de conexión ---------- */
const conn = document.getElementById('conn');
rt.on('status', (s) => {
  conn.dataset.state = s;
  conn.querySelector('span').textContent = s === 'online' ? 'Conectado en tiempo real' : s === 'offline' ? 'Reconectando…' : 'Conectando…';
});

/* ---------- Arranque ---------- */
async function boot() {
  if (session.token) {
    try {
      const { user } = await api('/api/auth/me');
      session.user = user;
      localStorage.setItem('autopuja.user', JSON.stringify(user));
    } catch {
      session.clear();
    }
  }
  renderNav();
  startClock();
  rt.connect();
  start(document.getElementById('main'));
}
boot();
