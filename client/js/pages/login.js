import { api, session } from '../api.js';
import { esc, toast } from '../util.js';
import { navigate } from '../router.js';

const DEMO = [
  { name: 'Ana López', email: 'ana@autopuja.gt' },
  { name: 'Carlos Méndez', email: 'carlos@autopuja.gt' },
  { name: 'Lucía Ramírez', email: 'lucia@autopuja.gt' },
];

export default async function Login(root, { query }) {
  const next = safeNext(query.get('next'));
  root.innerHTML = `
  <section class="auth">
    <div class="auth-card">
      <h1>Inicia sesión</h1>
      <p class="muted">Necesitas una cuenta para ofertar y publicar vehículos.</p>
      <form id="f" novalidate>
        <label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label>
        <label>Contraseña
          <span class="pw"><input name="password" type="password" autocomplete="current-password" required><button type="button" class="pw-toggle" aria-label="Mostrar contraseña">Ver</button></span>
        </label>
        <p class="form-error" role="alert"></p>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Iniciar sesión</button>
      </form>
      <p class="auth-switch">¿No tienes cuenta? <a href="/registro${next !== '/' ? '?next=' + encodeURIComponent(next) : ''}">Regístrate gratis</a></p>
    </div>
    <aside class="demo-box">
      <h2>Cuentas de prueba</h2>
      <p>Abre dos navegadores con usuarios distintos para probar las pujas en tiempo real. Contraseña: <code>Subasta#2026</code></p>
      <ul>${DEMO.map((d) => `<li><button type="button" class="demo-user" data-email="${d.email}"><b>${esc(d.name)}</b><span>${d.email}</span></button></li>`).join('')}</ul>
    </aside>
  </section>`;

  const f = root.querySelector('#f');
  const err = f.querySelector('.form-error');
  pwToggle(f);
  root.querySelectorAll('.demo-user').forEach((b) =>
    b.addEventListener('click', () => {
      f.email.value = b.dataset.email;
      f.password.value = 'Subasta#2026';
      f.requestSubmit();
    })
  );
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    if (!f.email.value || !f.password.value) return (err.textContent = 'Escribe tu correo y contraseña.');
    const btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const { token, user } = await api('/api/auth/login', { method: 'POST', body: { email: f.email.value, password: f.password.value } });
      session.set(token, user);
      toast(`Hola, ${user.nombre}.`, { type: 'success' });
      navigate(next, { replace: true });
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  });
  f.email.focus();
}

export function safeNext(n) {
  return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

export function pwToggle(scope) {
  scope.querySelectorAll('.pw-toggle').forEach((b) =>
    b.addEventListener('click', () => {
      const i = b.previousElementSibling;
      i.type = i.type === 'password' ? 'text' : 'password';
      b.textContent = i.type === 'password' ? 'Ver' : 'Ocultar';
    })
  );
}
