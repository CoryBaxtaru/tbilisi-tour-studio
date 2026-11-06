// A product sheet: the tour's text, ready to paste into GetYourGuide or a website. Only what the guide entered is
// used; missing parts show a placeholder and are reported, so cancellation terms in particular are never invented.
import { hasPrices, pricingOf } from './pricing';
import type { TourProduct } from './types';

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const duration = (min: number) => (min % 60 ? `${min} minuten` : `${min / 60} uur`);
const placeholder = (what: string) => `[${what} invullen]`;

export interface ProductSheet { text: string; missing: string[] }

/** `stops` are the names of the stops of the linked tour, used as highlights when none are written. */
export function buildProductSheet(p: TourProduct, stops: string[] = []): ProductSheet {
  const missing: string[] = [];
  const need = (value: string | undefined, what: string) => {
    if (value?.trim()) return value.trim();
    missing.push(what);
    return placeholder(what);
  };
  const written = (p.highlights ?? '').split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  const highlights = written.length ? written : stops;
  if (!highlights.length) missing.push('hoogtepunten');
  const pr = pricingOf(p);
  const price = !hasPrices(pr) ? []
    : pr.kind === 'prive'
      ? [`Prijs: ${eur.format(pr.privateBase)} voor maximaal ${pr.privateIncluded} ${pr.privateIncluded === 1 ? 'gast' : 'gasten'}, daarna ${eur.format(pr.privateExtra)} per gast`]
      : [`Prijs: ${eur.format(pr.adult)} per volwassene${pr.child ? `, ${eur.format(pr.child)} per kind` : ''}`];
  const lines = [
    p.name,
    '',
    need(p.description, 'omschrijving'),
    '',
    'Hoogtepunten',
    ...(highlights.length ? highlights.map((h) => `- ${h}`) : [`- ${placeholder('hoogtepunten')}`]),
    '',
    'Praktisch',
    `Duur: ongeveer ${duration(p.durationMin)}`,
    'Taal: Nederlands',
    `Groep: ${p.minGuests} tot ${p.maxGuests} gasten`,
    `Verzamelpunt: ${need(p.meetingPoint, 'verzamelpunt')}`,
    ...(p.included?.trim() ? [`Inbegrepen: ${p.included.trim()}`] : []),
    ...(p.bring?.trim() ? [`Neem mee: ${p.bring.trim()}`] : []),
    ...price,
    '',
    'Annuleren',
    need(p.cancellationTerms, 'annuleringsvoorwaarden'),
  ];
  return { text: lines.join('\n'), missing };
}
