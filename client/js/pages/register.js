import { api, session } from '../api.js';
import { toast } from '../util.js';
import { navigate } from '../router.js';
import { safeNext, pwToggle } from './login.js';

const RULES = [
  ['len', 'Al menos 8 caracteres', (p) => p.length >= 8],
  ['low', 'Una letra minúscula', (p) => /[a-z]/.test(p)],
  ['up', 'Una letra mayúscula', (p) => /[A-Z]/.test(p)],
  ['num', 'Un número', (p) => /\d/.test(p)],
  ['sym', 'Un símbolo (#, @, !, …)', (p) => /[^A-Za-z0-9]/.test(p)],
];

export default async function Register(root, { query }) {
  const next = safeNext(query.get('next'));
  root.innerHTML = `
  <section class="auth">
    <div class="auth-card wide">
      <h1>Crea tu cuenta</h1>
      <p class="muted">Con tu cuenta puedes ofertar en cualquier subasta y publicar tus propios vehículos.</p>
      <form id="f" novalidate>
        <div class="row2">
          <label>Nombre<input name="nombre" autocomplete="given-name" required><small class="field-error" data-err="nombre"></small></label>
          <label>Apellido<input name="apellido" autocomplete="family-name" required><small class="field-error" data-err="apellido"></small></label>
        </div>
        <label>Correo electrónico<input name="email" type="email" autocomplete="email" required><small class="field-error" data-err="email"></small></label>
        <label>Teléfono<input name="telefono" type="tel" inputmode="tel" autocomplete="tel" placeholder="5555 5555" required><small class="field-error" data-err="telefono"></small></label>
        <label>Contraseña segura
          <span class="pw"><input name="password" type="password" autocomplete="new-password" required><button type="button" class="pw-toggle" aria-label="Mostrar contraseña">Ver</button></span>
          <small class="field-error" data-err="password"></small>
        </label>
        <div class="pw-meter" aria-hidden="true"><i></i></div>
        <ul class="pw-rules">${RULES.map(([k, l]) => `<li data-rule="${k}">${l}</li>`).join('')}</ul>
        <label>Confirma la contraseña<input name="password2" type="password" autocomplete="new-password" required><small class="field-error" data-err="password2"></small></label>
        <p class="form-error" role="alert"></p>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Crear cuenta</button>
      </form>
      <p class="auth-switch">¿Ya tienes cuenta? <a href="/login${next !== '/' ? '?next=' + encodeURIComponent(next) : ''}">Inicia sesión</a></p>
    </div>
  </section>`;

  const f = root.querySelector('#f');
  pwToggle(f);
  const meter = f.querySelector('.pw-meter i');
  f.password.addEventListener('input', () => {
    const p = f.password.value;
    let ok = 0;
    RULES.forEach(([k, , test]) => {
      const pass = test(p);
      ok += pass;
      f.querySelector(`[data-rule="${k}"]`).classList.toggle('ok', pass);
    });
    meter.style.width = `${(ok / RULES.length) * 100}%`;
    meter.dataset.level = ok <= 2 ? 'low' : ok <= 4 ? 'mid' : 'high';
  });

  const setErr = (k, msg) => {
    const el = f.querySelector(`[data-err="${k}"]`);
    if (el) el.textContent = msg || '';
    f[k]?.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    ['nombre', 'apellido', 'email', 'telefono', 'password', 'password2'].forEach((k) => setErr(k, ''));
    f.querySelector('.form-error').textContent = '';
    const d = Object.fromEntries(new FormData(f));
    let bad = false;
    if (d.nombre.trim().length < 2) (setErr('nombre', 'Escribe tu nombre.'), (bad = true));
    if (d.apellido.trim().length < 2) (setErr('apellido', 'Escribe tu apellido.'), (bad = true));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) (setErr('email', 'Correo electrónico inválido.'), (bad = true));
    if (!/^(\+?502)?\d{8}$/.test(d.telefono.replace(/[\s-]/g, ''))) (setErr('telefono', 'Teléfono de 8 dígitos.'), (bad = true));
    const failed = RULES.filter(([, , t]) => !t(d.password)).map(([, l]) => l.toLowerCase());
    if (failed.length) (setErr('password', `Falta: ${failed.join(', ')}.`), (bad = true));
    if (d.password !== d.password2) (setErr('password2', 'Las contraseñas no coinciden.'), (bad = true));
    if (bad) return f.querySelector('[aria-invalid=true]')?.focus();

    const btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const { token, user } = await api('/api/auth/register', { method: 'POST', body: d });
      session.set(token, user);
      toast('Tu cuenta está lista. Ya puedes ofertar y publicar.', { type: 'success', title: `Bienvenido, ${user.nombre}` });
      navigate(next, { replace: true });
    } catch (ex) {
      Object.entries(ex.fields || {}).forEach(([k, m]) => setErr(k, m));
      f.querySelector('.form-error').textContent = ex.message;
      btn.disabled = false;
    }
  });
  f.nombre.focus();
}
