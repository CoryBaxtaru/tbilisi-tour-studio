// Pre-generated tour suggestions from tags, and ordering helpers.
// Ordering is geographic (straight-line) or chronological by era; it is a starting point,
// not a narrative recommendation, and the guide reorders freely afterwards.
import type { DeckCard } from './catalog';
import { haversineM } from './geo';
import { ERAS, matchesFilter, type DeckFilter, EMPTY_FILTER } from './tags';
import type { LatLng } from './types';

export interface TourTemplate {
  id: string;
  title: string;
  description: string;
  filter: Partial<DeckFilter>;
  /** Default number of stops; null = all matching sites. */
  defaultMax: number | null;
}

export const TEMPLATES: TourTemplate[] = [
  { id: 'compleet', title: 'Tbilisi compleet', description: 'Alle plekken uit de catalogus in het centrum: een volledige dag of meerdere dagen.', filter: {}, defaultMax: null },
  { id: 'hoogtepunten-oude-stad', title: 'De oude stad', description: 'Kala, Abanotubani en omgeving.', filter: { districts: ['oude-stad'] }, defaultMax: 10 },
  { id: 'historisch', title: 'Historisch Tbilisi', description: 'Plekken met het label Historisch.', filter: { themes: ['historisch'] }, defaultMax: 10 },
  { id: 'middeleeuwen', title: 'Middeleeuws Tbilisi', description: 'Van de stichting tot Erekle II.', filter: { eras: ['stichting', 'gouden-eeuw', 'overheersing', 'erekle'] }, defaultMax: 10 },
  { id: 'russisch-rijk', title: 'Tbilisi in de 19e eeuw', description: 'Het Russische Rijk: lanen, theaters, herenhuizen.', filter: { eras: ['russisch-rijk'] }, defaultMax: 10 },
  { id: 'sovjet', title: 'Sovjet-Tbilisi', description: 'Sporen van de Sovjettijd.', filter: { eras: ['sovjet'] }, defaultMax: 10 },
  { id: 'geloof', title: 'Geloof en diversiteit', description: 'Kerken, moskee, synagoge en vuurtempel.', filter: { themes: ['religieus', 'multicultureel'] }, defaultMax: 10 },
  { id: 'architectuur', title: 'Architectuur', description: 'Van middeleeuws tot modernistisch.', filter: { themes: ['architectuur'] }, defaultMax: 10 },
  { id: 'kunst', title: 'Kunst, theater en literatuur', description: 'Theaters, musea en schrijvers.', filter: { themes: ['kunst', 'literatuur'] }, defaultMax: 10 },
  { id: 'politiek', title: 'Politiek en protest', description: 'Macht, onafhankelijkheid en protest.', filter: { themes: ['politiek'] }, defaultMax: 10 },
  { id: 'uitzicht', title: 'Uitzichten en natuur', description: 'Hoogtepunten om te kijken en te fotograferen.', filter: { themes: ['uitzicht', 'natuur'] }, defaultMax: 10 },
  { id: 'modern', title: 'Modern Tbilisi', description: 'Hedendaagse architectuur en plekken.', filter: { themes: ['modern'] }, defaultMax: 8 },
];

export type OrderMode = 'kortste' | 'chronologisch';

export interface SuggestOptions {
  max: number | null;
  includeOutside: boolean;
  order: OrderMode;
}

type Located = DeckCard & { lat: number; lng: number };

export function candidatesFor(cards: DeckCard[], filter: Partial<DeckFilter>, includeOutside: boolean): Located[] {
  const f = { ...EMPTY_FILTER, ...filter };
  return cards.filter((c): c is Located =>
    c.lat !== null && c.lng !== null && (includeOutside || c.district !== 'buiten') && matchesFilter(c, f));
}

/** Selects (if capped) and orders sites for a suggested tour. */
export function suggestTour(cards: DeckCard[], filter: Partial<DeckFilter>, opts: SuggestOptions): Located[] {
  let pool = candidatesFor(cards, filter, opts.includeOutside);
  if (opts.max !== null && pool.length > opts.max) pool = compactSubset(pool, opts.max, relevance(filter));
  return opts.order === 'chronologisch' ? orderChronological(pool) : orderShortest(pool);
}

const pos = (c: { lat: number; lng: number }): LatLng => ({ lat: c.lat, lng: c.lng });

function relevance(filter: Partial<DeckFilter>) {
  const wanted = [...(filter.eras ?? []), ...(filter.themes ?? [])];
  return (c: Located) => (wanted.length ? c.tags.filter((t) => wanted.includes(t)).length : c.tags.length);
}

/** For each seed, take it plus its nearest neighbours; keep the most relevant, most compact group. */
export function compactSubset(pool: Located[], max: number, score: (c: Located) => number): Located[] {
  let best: Located[] = [];
  let bestCost = Infinity;
  for (const seed of pool) {
    const group = pool
      .slice()
      .sort((a, b) => haversineM(pos(seed), pos(a)) - haversineM(pos(seed), pos(b)))
      .slice(0, max);
    const length = pathLength(orderShortest(group));
    const cost = length / 1000 - 0.6 * group.reduce((s, c) => s + score(c), 0);
    if (cost < bestCost) { bestCost = cost; best = group; }
  }
  return best;
}

export function pathLength(xs: { lat: number; lng: number }[]): number {
  let d = 0;
  for (let i = 1; i < xs.length; i++) d += haversineM(pos(xs[i - 1]), pos(xs[i]));
  return d;
}

/** Open path: nearest neighbour from every start point, improved with 2-opt; straight-line metric. */
export function orderShortest<T extends { lat: number; lng: number }>(xs: T[]): T[] {
  const n = xs.length;
  if (n < 3) return xs.slice();
  const d = xs.map((a) => xs.map((b) => haversineM(pos(a), pos(b))));
  let best: number[] = [];
  let bestLen = Infinity;
  for (let start = 0; start < n; start++) {
    const route = twoOpt(nearestNeighbour(d, start), d);
    let len = 0;
    for (let i = 1; i < n; i++) len += d[route[i - 1]][route[i]];
    if (len < bestLen) { bestLen = len; best = route; }
  }
  return best.map((i) => xs[i]);
}

function nearestNeighbour(d: number[][], start: number): number[] {
  const left = new Set(d.map((_, i) => i));
  left.delete(start);
  const route = [start];
  while (left.size) {
    const last = route[route.length - 1];
    let bi = -1;
    for (const i of left) if (bi === -1 || d[last][i] < d[last][bi]) bi = i;
    route.push(bi);
    left.delete(bi);
  }
  return route;
}

/** 2-opt for an open path: reversing r[i+1..j] changes only the edges around it. */
function twoOpt(route: number[], d: number[][]): number[] {
  const r = route.slice();
  const n = r.length;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n; j++) {
        const before = d[r[i]][r[i + 1]] + (j + 1 < n ? d[r[j]][r[j + 1]] : 0);
        const after = d[r[i]][r[j]] + (j + 1 < n ? d[r[i + 1]][r[j + 1]] : 0);
        if (after + 1e-6 < before) {
          for (let a = i + 1, b = j; a < b; a++, b--) [r[a], r[b]] = [r[b], r[a]];
          improved = true;
        }
      }
    }
  }
  return r;
}

const ERA_INDEX = new Map(ERAS.map((e, i) => [e.id, i]));

/** Earliest tagged era first; sites without an era go last. Within an era, the shortest walk. */
export function orderChronological(xs: Located[]): Located[] {
  const era = (c: Located) => Math.min(...c.tags.map((t) => ERA_INDEX.get(t) ?? Infinity));
  const groups = new Map<number, Located[]>();
  for (const c of xs) groups.set(era(c), [...(groups.get(era(c)) ?? []), c]);
  return [...groups.keys()].sort((a, b) => a - b).flatMap((k) => orderShortest(groups.get(k)!));
}

/** Sorts cards by straight-line distance to an anchor; returns the distance per card. */
export function byDistance<T extends { lat: number | null; lng: number | null }>(cards: T[], anchor: LatLng): { card: T; distanceM: number | null }[] {
  return cards
    .map((card) => ({ card, distanceM: card.lat === null || card.lng === null ? null : haversineM(anchor, { lat: card.lat, lng: card.lng }) }))
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
}
