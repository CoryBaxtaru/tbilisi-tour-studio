// Planning checks: blocked days and departures that overlap. There is one guide, so two tours at the same time
// cannot both run. Pure functions; times are local Tbilisi times.
import { addMonths } from './agenda';
import { newId, nowIso } from './factory';
import type { BlockedDay, Departure, TourProduct } from './types';

export function createBlockedDay(date: string, reason = ''): BlockedDay {
  const now = nowIso();
  return { id: newId(), createdAt: now, updatedAt: now, date, reason };
}

export function blockedOn(date: string, blocked: BlockedDay[]): BlockedDay | undefined {
  return blocked.find((b) => b.date === date && !b.deleted);
}

const minutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
const FALLBACK_DURATION = 120;

/** Other departures on the same day whose time overlaps this one. Cancelled and deleted ones do not count. */
export function clashes(dep: Departure, departures: Departure[], products: TourProduct[]): Departure[] {
  const duration = (d: Departure) => products.find((p) => p.id === d.productId)?.durationMin ?? FALLBACK_DURATION;
  const start = minutes(dep.startTime);
  const end = start + duration(dep);
  return departures.filter((o) => {
    if (o.id === dep.id || o.deleted || o.status === 'geannuleerd' || o.date !== dep.date) return false;
    const s = minutes(o.startTime);
    return s < end && start < s + duration(o);
  });
}

export interface PlanningProblem { departure: Departure; kind: 'dubbel' | 'geblokkeerd'; detail?: string }

/** Upcoming departures within three months that overlap another one or fall on a blocked day. */
export function planningProblems(departures: Departure[], products: TourProduct[], blocked: BlockedDay[], today: string): PlanningProblem[] {
  const end = addMonths(today, 3);
  const active = departures.filter((d) => !d.deleted && d.status !== 'geannuleerd' && d.date >= today && d.date <= end);
  const out: PlanningProblem[] = [];
  for (const d of active) {
    if (clashes(d, active, products).length) out.push({ departure: d, kind: 'dubbel' });
    const block = blockedOn(d.date, blocked);
    if (block) out.push({ departure: d, kind: 'geblokkeerd', detail: block.reason });
  }
  return out.sort((a, b) => a.departure.date.localeCompare(b.departure.date) || a.departure.startTime.localeCompare(b.departure.startTime));
}
