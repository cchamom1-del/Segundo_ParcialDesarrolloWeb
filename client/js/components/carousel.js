import { esc } from '../util.js';

/** Carrusel con miniaturas, flechas, teclado, deslizamiento táctil y pantalla completa */
export function mountCarousel(el, photos, alt) {
  let i = 0;
  el.classList.add('carousel');
  el.innerHTML = `
    <div class="car-stage" tabindex="0" aria-roledescription="carrusel" aria-label="Fotografías de ${esc(alt)}">
      <div class="car-track">${photos.map((p, k) => `<div class="car-slide" aria-hidden="${k !== 0}"><img src="${esc(p)}" alt="${esc(alt)} — foto ${k + 1}" ${k > 1 ? 'loading="lazy"' : ''} draggable="false"></div>`).join('')}</div>
      <button class="car-nav car-prev" aria-label="Foto anterior">‹</button>
      <button class="car-nav car-next" aria-label="Foto siguiente">›</button>
      <span class="car-count"><b>1</b> / ${photos.length}</span>
      <button class="car-full" aria-label="Ver en pantalla completa" title="Pantalla completa">⤢</button>
    </div>
    <div class="car-thumbs" role="tablist">${photos.map((p, k) => `<button role="tab" class="car-thumb${k === 0 ? ' active' : ''}" aria-label="Foto ${k + 1}"><img src="${esc(p)}" alt="" loading="lazy"></button>`).join('')}</div>`;

  const stage = el.querySelector('.car-stage');
  const track = el.querySelector('.car-track');
  const thumbs = [...el.querySelectorAll('.car-thumb')];
  const slides = [...el.querySelectorAll('.car-slide')];
  const counter = el.querySelector('.car-count b');

  function go(n) {
    i = (n + photos.length) % photos.length;
    track.style.transform = `translateX(-${i * 100}%)`;
    thumbs.forEach((t, k) => t.classList.toggle('active', k === i));
    slides.forEach((s, k) => s.setAttribute('aria-hidden', k !== i));
    thumbs[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    counter.textContent = i + 1;
  }

  el.querySelector('.car-prev').onclick = () => go(i - 1);
  el.querySelector('.car-next').onclick = () => go(i + 1);
  thumbs.forEach((t, k) => (t.onclick = () => go(k)));
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(i - 1);
    if (e.key === 'ArrowRight') go(i + 1);
  });

  // Deslizar con el dedo
  let x0 = null;
  stage.addEventListener('pointerdown', (e) => (x0 = e.clientX));
  stage.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  // Pantalla completa (lightbox)
  el.querySelector('.car-full').onclick = () => openLightbox(photos, i, alt, go);
}

function openLightbox(photos, start, alt, sync) {
  let i = start;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `<img alt=""><button class="lb-close" aria-label="Cerrar">×</button>
    <button class="car-nav car-prev" aria-label="Anterior">‹</button><button class="car-nav car-next" aria-label="Siguiente">›</button>
    <span class="car-count"></span>`;
  const img = box.querySelector('img');
  const count = box.querySelector('.car-count');
  const show = () => {
    img.src = photos[i];
    img.alt = `${alt} — foto ${i + 1}`;
    count.textContent = `${i + 1} / ${photos.length}`;
  };
  const close = () => {
    box.remove();
    document.removeEventListener('keydown', onKey);
    sync(i);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') ((i = (i - 1 + photos.length) % photos.length), show());
    if (e.key === 'ArrowRight') ((i = (i + 1) % photos.length), show());
  };
  box.querySelector('.lb-close').onclick = close;
  box.querySelector('.car-prev').onclick = () => onKey({ key: 'ArrowLeft' });
  box.querySelector('.car-next').onclick = () => onKey({ key: 'ArrowRight' });
  box.addEventListener('click', (e) => e.target === box && close());
  document.addEventListener('keydown', onKey);
  document.body.appendChild(box);
  show();
  box.querySelector('.lb-close').focus();
}
