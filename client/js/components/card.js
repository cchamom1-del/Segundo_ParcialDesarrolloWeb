import { esc, fmtQ, statusBadge, damageChip, vehicleTitle, liveStatus, fmtNum } from '../util.js';
import { countdownHtml } from './clock.js';

/** Tarjeta de vehículo para el inventario (estilo "etiqueta de lote" de patio) */
export function cardHtml(v) {
  const st = liveStatus(v);
  const priceLabel = v.bidCount ? 'Oferta actual' : st === 'cerrada' ? 'Monto base' : 'Monto base';
  const price = v.bidCount ? v.currentBid : v.precioBase;
  const you = v.isOwner ? '<span class="you you-owner">Tu publicación</span>' : v.isLeader ? '<span class="you you-lead">Vas ganando</span>' : '';
  return `<article class="vcard" data-vid="${esc(v.id)}">
  <a class="vcard-media" href="/vehiculo/${esc(v.id)}" aria-label="Ver ${esc(vehicleTitle(v))}">
    <img src="${esc(v.cover)}" alt="${esc(vehicleTitle(v))}" loading="lazy" decoding="async">
    <div class="vcard-top">${statusBadge(v)}${damageChip(v.danio)}</div>
    <span class="vcard-photos" title="Fotografías">${v.photoCount} fotos</span>
  </a>
  <div class="vcard-body">
    <div class="lot-tag"><span class="lot-no">Lote ${esc(v.lote)}</span>${countdownHtml(v)}</div>
    <h3 class="vcard-title"><a href="/vehiculo/${esc(v.id)}">${esc(vehicleTitle(v))}</a></h3>
    <ul class="spec-pills">
      <li>${esc(v.tipo)}</li><li>${esc(v.transmision)}</li><li>${esc(v.combustible)}</li><li>${esc(v.traccion)}</li>
      ${v.kilometraje != null ? `<li>${fmtNum(v.kilometraje)} km</li>` : ''}
    </ul>
    <div class="vcard-foot">
      <div class="price-block">
        <small class="price-label">${priceLabel}</small>
        <strong class="price" data-price>${fmtQ(price)}</strong>
      </div>
      <div class="bids-count" data-bids>${v.bidCount} ${v.bidCount === 1 ? 'oferta' : 'ofertas'}</div>
    </div>
    <div class="vcard-you" data-you>${you}</div>
  </div>
</article>`;
}

/** Aplica una puja en vivo a una tarjeta existente */
export function patchCard(root, data) {
  const card = root.querySelector(`.vcard[data-vid="${CSS.escape(data.vehicleId)}"]`);
  if (!card) return;
  const price = card.querySelector('[data-price]');
  price.textContent = fmtQ(data.currentBid);
  card.querySelector('.price-label').textContent = 'Oferta actual';
  card.querySelector('[data-bids]').textContent = `${data.bidCount} ${data.bidCount === 1 ? 'oferta' : 'ofertas'}`;
  const you = card.querySelector('[data-you]');
  if (data.you === 'leading') you.innerHTML = '<span class="you you-lead">Vas ganando</span>';
  else if (data.you === 'outbid') you.innerHTML = '<span class="you you-outbid">Te superaron</span>';
  card.classList.remove('flash');
  void card.offsetWidth;
  card.classList.add('flash');
}
