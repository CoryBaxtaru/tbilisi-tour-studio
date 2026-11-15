// The fastest walking order for a tour's stops, from a table of walking times between every pair.
// The first stop stays first (it is the meeting point); the others may move, and the tour may end anywhere.
// A ride (cable car, funicular) stays joined to the stop after it, because walking times don't know the ride.

/** Catalogue sites that are a ride to the next stop. */
export const RIDE_SITE_IDS = ['kabelbaan-narikala', 'kabelspoor'];

/** A pair without a route counts as very long, so it is only used when nothing else is possible. */
const NO_ROUTE = 1e7;

export type Durations = (number | null)[][];

const cost = (d: Durations, a: number, b: number) => d[a]?.[b] ?? NO_ROUTE;

/** Total walking time of an order of stop indexes. */
export function orderCost(d: Durations, order: number[]): number {
  let total = 0;
  for (let i = 1; i < order.length; i++) total += cost(d, order[i - 1], order[i]);
  return total;
}

/** Exact up to EXACT_MAX stops (Held-Karp), otherwise nearest neighbour improved with 2-opt. */
const EXACT_MAX = 13;

/** `joinNext`: stop indexes that must stay directly before the stop that follows them now. */
export function fastestOrder(d: Durations, joinNext: ReadonlySet<number> = new Set()): number[] {
  const n = d.length;
  // Group joined stops into blocks; walking into a block ends at its first stop, out of it starts at its last.
  const blocks: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0 && joinNext.has(i - 1)) blocks[blocks.length - 1].push(i);
    else blocks.push([i]);
  }
  const bd: Durations = blocks.map((a) => blocks.map((b) => (a === b ? 0 : d[a[a.length - 1]]?.[b[0]] ?? null)));
  const m = blocks.length;
  const order = m <= 2 ? [...Array(m).keys()] : m <= EXACT_MAX ? heldKarp(bd) : twoOpt(bd, nearestNeighbour(bd));
  return order.flatMap((b) => blocks[b]);
}

function heldKarp(d: Durations): number[] {
  const n = d.length;
  const m = n - 1; // stops 1..n-1 are free; bit i-1 stands for stop i
  const full = 1 << m;
  const best = new Float64Array(full * n).fill(Infinity);
  const from = new Int8Array(full * n).fill(-1);
  for (let j = 1; j < n; j++) best[(1 << (j - 1)) * n + j] = cost(d, 0, j);
  for (let set = 1; set < full; set++) {
    for (let j = 1; j < n; j++) {
      const bit = 1 << (j - 1);
      if (!(set & bit)) continue;
      const here = best[set * n + j];
      if (here === Infinity) continue;
      for (let k = 1; k < n; k++) {
        const kb = 1 << (k - 1);
        if (set & kb) continue;
        const next = set | kb;
        const c = here + cost(d, j, k);
        if (c < best[next * n + k]) { best[next * n + k] = c; from[next * n + k] = j; }
      }
    }
  }
  let end = 1;
  for (let j = 2; j < n; j++) if (best[(full - 1) * n + j] < best[(full - 1) * n + end]) end = j;
  const order: number[] = [];
  let set = full - 1;
  for (let j = end; j > 0;) {
    order.push(j);
    const prev = from[set * n + j];
    set &= ~(1 << (j - 1));
    j = prev;
  }
  return [0, ...order.reverse()];
}

function nearestNeighbour(d: Durations): number[] {
  const left = new Set([...Array(d.length).keys()].slice(1));
  const order = [0];
  while (left.size) {
    const last = order[order.length - 1];
    let pick = -1;
    for (const k of left) if (pick < 0 || cost(d, last, k) < cost(d, last, pick)) pick = k;
    order.push(pick);
    left.delete(pick);
  }
  return order;
}

function twoOpt(d: Durations, start: number[]): number[] {
  let order = start;
  for (let improved = true; improved;) {
    improved = false;
    for (let i = 1; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const next = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (orderCost(d, next) + 1e-6 < orderCost(d, order)) { order = next; improved = true; }
      }
    }
  }
  return order;
}
