import { api, getCatalogs, session } from '../api.js';
import { esc, toast, DANIO, fmtQ, now } from '../util.js';
import { navigate } from '../router.js';
import { cardHtml } from '../components/card.js';

const MAX_PHOTOS = 12;
const MIN_PHOTOS = 5;

const toLocalInput = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Comprime una imagen en el navegador (canvas) para no subir archivos pesados */
async function compress(src, maxSide, quality) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', quality);
}

const readFile = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export default async function Publish(root, { params }) {
  const cat = await getCatalogs();
  const editing = !!params.id;
  let v = null;
  if (editing) {
    try {
      v = await api(`/api/vehicles/${encodeURIComponent(params.id)}`);
    } catch (e) {
      root.innerHTML = `<section class="container empty-state"><h1>No encontramos esa publicación</h1><p>${esc(e.message)}</p><a class="btn btn-primary" href="/mis-publicaciones">Ir a mis publicaciones</a></section>`;
      return;
    }
    if (!v.isOwner && session.user?.role !== 'admin') {
      root.innerHTML = `<section class="container empty-state"><h1>Solo el publicador puede editar este vehículo</h1><a class="btn btn-primary" href="/vehiculo/${esc(v.id)}">Ver la subasta</a></section>`;
      return;
    }
    if (v.status === 'cerrada') {
      root.innerHTML = `<section class="container empty-state"><h1>Esta subasta ya finalizó</h1><p>Las subastas cerradas no se pueden editar.</p><a class="btn btn-primary" href="/vehiculo/${esc(v.id)}">Ver resultado</a></section>`;
      return;
    }
  }
  const locked = editing && v.bidCount > 0;
  let photos = editing ? [...v.photos] : [];
  const year = new Date().getFullYear() + 1;
  const start0 = editing ? v.inicio : Math.ceil((now() + 10 * 60_000) / 300_000) * 300_000;
  const end0 = editing ? v.cierre : start0 + 3 * 86_400_000;
  const val = (k, d = '') => esc(v?.[k] ?? d);
  const opt = (list, cur) => list.map((x) => `<option ${String(x) === String(cur ?? '') ? 'selected' : ''}>${esc(x)}</option>`).join('');

  root.innerHTML = `
  <div class="container publish">
    <header class="page-head">
      <div>
        <h1>${editing ? `Editar lote ${esc(v.lote)}` : 'Publicar un vehículo'}</h1>
        <p class="muted">${editing ? 'Actualiza la ficha, las fotos o las fechas de tu subasta.' : 'Completa la ficha técnica, sube al menos 5 fotos y define las reglas de la subasta.'}</p>
      </div>
      ${editing ? `<a class="btn btn-ghost" href="/vehiculo/${esc(v.id)}">Ver subasta</a>` : ''}
    </header>
    ${locked ? `<div class="notice">Esta subasta ya tiene ${v.bidCount} ${v.bidCount === 1 ? 'oferta' : 'ofertas'}: el monto base y la fecha de inicio quedan bloqueados, y el cierre solo puede extenderse.</div>` : ''}
    <div class="publish-grid">
      <form id="pf" novalidate>
        <section class="panel">
          <h2>Ficha técnica</h2>
          <div class="form-grid">
            <label>Año<select name="anio" required><option value="">Selecciona</option>${opt(Array.from({ length: year - 1979 }, (_, i) => year - i), v?.anio)}</select><small class="field-error" data-err="anio"></small></label>
            <label>Tipo de artículo<select name="tipo" required><option value="">Selecciona</option>${opt(cat.tipos, v?.tipo)}</select><small class="field-error" data-err="tipo"></small></label>
            <label>Marca<input name="marca" list="dl-marcas" value="${val('marca')}" placeholder="Toyota" required><small class="field-error" data-err="marca"></small></label>
            <label>Modelo<input name="modelo" list="dl-modelos" value="${val('modelo')}" placeholder="Corolla" required><small class="field-error" data-err="modelo"></small></label>
            <label>Motor<input name="motor" value="${val('motor')}" placeholder="2.0L I4" required><small class="field-error" data-err="motor"></small></label>
            <label>Transmisión<select name="transmision" required><option value="">Selecciona</option>${opt(cat.transmisiones, v?.transmision)}</select><small class="field-error" data-err="transmision"></small></label>
            <label>Tipo de combustible<select name="combustible" required><option value="">Selecciona</option>${opt(cat.combustibles, v?.combustible)}</select><small class="field-error" data-err="combustible"></small></label>
            <label>Número de cilindros<select name="cilindros" required><option value="">Selecciona</option>${cat.cilindros.map((c) => `<option value="${c}" ${v && v.cilindros === c ? 'selected' : ''}>${c === 0 ? '0 (eléctrico)' : c}</option>`).join('')}</select><small class="field-error" data-err="cilindros"></small></label>
            <fieldset class="span2"><legend>Tren de manejo</legend>
              <div class="seg">${cat.tracciones.map((t) => `<label><input type="radio" name="traccion" value="${t}" ${v?.traccion === t ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
              <small class="field-error" data-err="traccion"></small>
            </fieldset>
            <label>Color <span class="opt">opcional</span><input name="color" value="${val('color')}" placeholder="Blanco perla"></label>
            <label>Kilometraje <span class="opt">opcional</span><input name="kilometraje" type="number" min="0" value="${v?.kilometraje ?? ''}" placeholder="45000"><small class="field-error" data-err="kilometraje"></small></label>
            <label class="span2">VIN <span class="opt">opcional</span><input name="vin" value="" maxlength="17" placeholder="${editing && v.vin ? 'Registrado: ' + esc(v.vin) : '17 caracteres'}" style="text-transform:uppercase"><small class="field-error" data-err="vin"></small></label>
          </div>
          <datalist id="dl-marcas">${Object.keys(cat.marcas).map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
          <datalist id="dl-modelos"></datalist>
        </section>

        <section class="panel">
          <h2>Clasificación por estado de daño</h2>
          <div class="dmg-pick">${Object.entries(DANIO).map(([k, d]) => `
            <label class="dmg-option dmg-${k}"><input type="radio" name="danio" value="${k}" ${v?.danio === k ? 'checked' : ''}>
              <span class="dmg-swatch"></span><b>${d.label}</b><small>${d.desc}</small></label>`).join('')}
          </div>
          <small class="field-error" data-err="danio"></small>
          <label>Descripción <span class="opt">opcional</span><textarea name="descripcion" rows="4" maxlength="1500" placeholder="Describe los daños, si enciende, si tiene llaves, tipo de título…">${val('descripcion')}</textarea></label>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Galería fotográfica</h2><span class="photo-count" id="pcount"></span></div>
          <div class="drop" id="drop" tabindex="0">
            <input type="file" id="files" accept="image/jpeg,image/png,image/webp" multiple hidden>
            <p><b>Arrastra tus fotos aquí</b> o <button type="button" class="link-btn" id="pick">elige archivos</button></p>
            <small>Mínimo ${MIN_PHOTOS}, máximo ${MAX_PHOTOS}. La primera foto será la portada. Se optimizan automáticamente.</small>
          </div>
          <div class="url-add"><input type="url" id="purl" placeholder="…o pega la URL https de una imagen"><button type="button" class="btn btn-ghost" id="addUrl">Agregar</button></div>
          <ul class="thumbs" id="thumbs"></ul>
          <small class="field-error" data-err="photos"></small>
        </section>

        <section class="panel">
          <h2>Parámetros de la subasta</h2>
          <div class="form-grid">
            <label class="span2">Precio / monto base
              <span class="money-input"><span>Q</span><input name="precioBase" inputmode="numeric" value="${v ? Number(v.precioBase).toLocaleString('es-GT') : ''}" placeholder="20,000" ${locked ? 'disabled' : ''}></span>
              <small class="hint">Ninguna oferta podrá ser menor a este monto. Cada nueva oferta debe superar la anterior por al menos 10 %.</small>
              <small class="field-error" data-err="precioBase"></small>
            </label>
            <label>Fecha y hora de inicio<input type="datetime-local" name="inicio" value="${toLocalInput(start0)}" ${locked ? 'disabled' : ''}><small class="field-error" data-err="inicio"></small></label>
            <label>Fecha y hora de cierre<input type="datetime-local" name="cierre" value="${toLocalInput(end0)}"><small class="field-error" data-err="cierre"></small></label>
            <div class="span2 durations"><span>Duración rápida:</span>${[['1 hora', 3_600_000], ['1 día', 86_400_000], ['3 días', 3 * 86_400_000], ['7 días', 7 * 86_400_000]].map(([l, ms]) => `<button type="button" class="chip-btn" data-dur="${ms}">${l}</button>`).join('')}</div>
          </div>
        </section>

        <p class="form-error" role="alert"></p>
        <div class="form-actions">
          <a class="btn btn-ghost" href="${editing ? '/mis-publicaciones' : '/'}">Cancelar</a>
          <button class="btn btn-primary btn-lg" type="submit">${editing ? 'Guardar cambios' : 'Publicar subasta'}</button>
        </div>
      </form>

      <aside class="preview">
        <h2>Así se verá en el inventario</h2>
        <div id="preview"></div>
        <ul class="checklist" id="check"></ul>
      </aside>
    </div>
  </div>`;

  const f = root.querySelector('#pf');
  const thumbs = root.querySelector('#thumbs');
  const fileInput = root.querySelector('#files');

  /* ---------- Modelos sugeridos según la marca ---------- */
  const syncModels = () => {
    const list = cat.marcas[f.marca.value] || [];
    root.querySelector('#dl-modelos').innerHTML = list.map((m) => `<option value="${esc(m)}">`).join('');
  };
  f.marca.addEventListener('input', syncModels);
  syncModels();

  /* ---------- Fotos ---------- */
  function renderPhotos() {
    thumbs.innerHTML = photos
      .map(
        (p, i) => `<li class="${i === 0 ? 'is-cover' : ''}"><img src="${esc(p)}" alt="Foto ${i + 1}">
        ${i === 0 ? '<span class="cover-tag">Portada</span>' : `<button type="button" data-act="cover" data-i="${i}" title="Usar como portada">Portada</button>`}
        <div class="thumb-actions">
          <button type="button" data-act="left" data-i="${i}" aria-label="Mover a la izquierda" ${i === 0 ? 'disabled' : ''}>‹</button>
          <button type="button" data-act="del" data-i="${i}" aria-label="Eliminar foto">×</button>
          <button type="button" data-act="right" data-i="${i}" aria-label="Mover a la derecha" ${i === photos.length - 1 ? 'disabled' : ''}>›</button>
        </div></li>`
      )
      .join('');
    const n = photos.length;
    const pc = root.querySelector('#pcount');
    pc.textContent = `${n} / ${MAX_PHOTOS}`;
    pc.classList.toggle('ok', n >= MIN_PHOTOS);
    updatePreview();
  }

  thumbs.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const i = Number(b.dataset.i);
    const act = b.dataset.act;
    if (act === 'del') photos.splice(i, 1);
    if (act === 'left' && i > 0) [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]];
    if (act === 'right' && i < photos.length - 1) [photos[i + 1], photos[i]] = [photos[i], photos[i + 1]];
    if (act === 'cover') photos.unshift(photos.splice(i, 1)[0]);
    renderPhotos();
  });

  async function addFiles(files) {
    const list = [...files].filter((x) => /^image\/(jpeg|png|webp)$/.test(x.type));
    if (!list.length) return toast('Solo se aceptan imágenes JPG, PNG o WEBP.', { type: 'error' });
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return toast(`Máximo ${MAX_PHOTOS} fotografías.`, { type: 'error' });
    const drop = root.querySelector('#drop');
    drop.classList.add('busy');
    for (const file of list.slice(0, room)) {
      try {
        photos.push(await compress(await readFile(file), 1280, 0.8));
        renderPhotos();
      } catch {
        toast(`No se pudo leer ${file.name}.`, { type: 'error' });
      }
    }
    drop.classList.remove('busy');
    if (list.length > room) toast(`Solo se agregaron ${room} fotos (máximo ${MAX_PHOTOS}).`, { type: 'info' });
  }

  root.querySelector('#pick').onclick = () => fileInput.click();
  fileInput.onchange = () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  };
  const drop = root.querySelector('#drop');
  drop.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.click()));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => (e.preventDefault(), drop.classList.add('over'))));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => (e.preventDefault(), drop.classList.remove('over'))));
  drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  root.querySelector('#addUrl').onclick = () => {
    const input = root.querySelector('#purl');
    const url = input.value.trim();
    if (!/^https:\/\/\S+$/i.test(url)) return toast('Pega una URL que empiece con https://', { type: 'error' });
    if (photos.length >= MAX_PHOTOS) return toast(`Máximo ${MAX_PHOTOS} fotografías.`, { type: 'error' });
    photos.push(url);
    input.value = '';
    renderPhotos();
  };

  /* ---------- Precio con separador de miles ---------- */
  f.precioBase.addEventListener('input', () => {
    const d = f.precioBase.value.replace(/\D/g, '');
    f.precioBase.value = d ? Number(d).toLocaleString('es-GT') : '';
  });

  /* ---------- Duraciones rápidas ---------- */
  root.querySelectorAll('[data-dur]').forEach((b) =>
    b.addEventListener('click', () => {
      const s = new Date(f.inicio.value).getTime() || now();
      f.cierre.value = toLocalInput(s + Number(b.dataset.dur));
      updatePreview();
    })
  );

  /* ---------- Vista previa y lista de verificación ---------- */
  function readForm() {
    const d = Object.fromEntries(new FormData(f));
    return {
      anio: Number(d.anio) || '',
      tipo: d.tipo,
      marca: (d.marca || '').trim(),
      modelo: (d.modelo || '').trim(),
      motor: (d.motor || '').trim(),
      transmision: d.transmision,
      combustible: d.combustible,
      traccion: d.traccion || '',
      cilindros: d.cilindros === '' || d.cilindros === undefined ? '' : Number(d.cilindros),
      danio: d.danio || '',
      color: d.color || '',
      kilometraje: d.kilometraje === '' ? null : Number(d.kilometraje),
      vin: (d.vin || '').trim().toUpperCase(),
      descripcion: d.descripcion || '',
      precioBase: locked ? v.precioBase : Number(String(f.precioBase.value).replace(/\D/g, '')) || 0,
      inicio: locked ? v.inicio : new Date(f.inicio.value).getTime(),
      cierre: new Date(f.cierre.value).getTime(),
    };
  }

  function updatePreview() {
    const d = readForm();
    const fake = {
      id: 'preview', lote: v?.lote || '00000000', ...d,
      anio: d.anio || 'Año', marca: d.marca || 'Marca', modelo: d.modelo || 'Modelo',
      tipo: d.tipo || 'Tipo', transmision: d.transmision || 'Transmisión', combustible: d.combustible || 'Combustible', traccion: d.traccion || 'Tracción',
      danio: d.danio || 'verde', cover: photos[0] || 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#e8edf4"/></svg>'),
      photoCount: photos.length, bidCount: v?.bidCount || 0, currentBid: v?.currentBid || 0, status: 'activa',
      inicio: d.inicio || now(), cierre: d.cierre || now() + 86_400_000,
    };
    root.querySelector('#preview').innerHTML = cardHtml(fake).replace(/href="[^"]*"/g, 'href="#" tabindex="-1"');
    const checks = [
      ['Ficha técnica completa', d.anio && d.tipo && d.marca && d.modelo && d.motor && d.transmision && d.combustible && d.traccion && d.cilindros !== ''],
      ['Nivel de daño seleccionado', !!d.danio],
      [`Al menos ${MIN_PHOTOS} fotos (${photos.length})`, photos.length >= MIN_PHOTOS],
      [`Monto base definido${d.precioBase ? ': ' + fmtQ(d.precioBase) : ''}`, d.precioBase >= 1000],
      ['Cierre posterior al inicio', d.cierre > d.inicio],
    ];
    root.querySelector('#check').innerHTML = checks.map(([l, ok]) => `<li class="${ok ? 'ok' : ''}">${esc(l)}</li>`).join('');
  }
  f.addEventListener('input', updatePreview);
  f.addEventListener('change', updatePreview);
  root.querySelector('#preview').addEventListener('click', (e) => e.preventDefault());

  /* ---------- Envío ---------- */
  const setErr = (k, m) => {
    const el = f.querySelector(`[data-err="${k}"]`);
    if (el) el.textContent = m || '';
  };

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    f.querySelectorAll('[data-err]').forEach((el) => (el.textContent = ''));
    const formErr = f.querySelector('.form-error');
    formErr.textContent = '';
    const d = readForm();
    const errs = {};
    if (!d.anio) errs.anio = 'Selecciona el año.';
    if (!d.tipo) errs.tipo = 'Selecciona el tipo.';
    if (d.marca.length < 2) errs.marca = 'Indica la marca.';
    if (!d.modelo) errs.modelo = 'Indica el modelo.';
    if (d.motor.length < 2) errs.motor = 'Describe el motor.';
    if (!d.transmision) errs.transmision = 'Selecciona la transmisión.';
    if (!d.combustible) errs.combustible = 'Selecciona el combustible.';
    if (d.cilindros === '') errs.cilindros = 'Selecciona los cilindros.';
    if (!d.traccion) errs.traccion = 'Selecciona el tren de manejo.';
    if (!d.danio) errs.danio = 'Clasifica el estado de daño.';
    if (photos.length < MIN_PHOTOS) errs.photos = `Agrega al menos ${MIN_PHOTOS} fotografías (tienes ${photos.length}).`;
    if (!locked && d.precioBase < 1000) errs.precioBase = 'El monto base debe ser de al menos Q 1,000.';
    if (!d.inicio) errs.inicio = 'Indica la fecha de inicio.';
    if (!d.cierre) errs.cierre = 'Indica la fecha de cierre.';
    else if (d.cierre <= d.inicio) errs.cierre = 'El cierre debe ser posterior al inicio.';
    if (Object.keys(errs).length) {
      Object.entries(errs).forEach(([k, m]) => setErr(k, m));
      formErr.textContent = 'Revisa los campos marcados.';
      f.querySelector('[data-err]:not(:empty)')?.closest('label, fieldset, section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (editing && !d.vin) d.vin = undefined; // en edición, vacío = conservar el VIN registrado

    const btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      let cover = photos[0];
      if (cover.startsWith('data:image/jpeg') || cover.startsWith('data:image/png') || cover.startsWith('data:image/webp')) {
        cover = await compress(cover, 520, 0.72);
      }
      const payload = { ...d, photos, cover };
      const res = editing
        ? await api(`/api/vehicles/${v.id}`, { method: 'PUT', body: payload })
        : await api('/api/vehicles', { method: 'POST', body: payload });
      toast(editing ? 'Guardamos los cambios de tu publicación.' : `Tu vehículo ya está en subasta como lote ${res.lote}.`, { type: 'success', title: editing ? 'Cambios guardados' : 'Publicado' });
      navigate(`/vehiculo/${res.id}`);
    } catch (ex) {
      Object.entries(ex.fields || {}).forEach(([k, m]) => setErr(k, m));
      formErr.textContent = ex.message;
      btn.disabled = false;
      btn.textContent = editing ? 'Guardar cambios' : 'Publicar subasta';
    }
  });

  renderPhotos();
}
