// Statistics for a year: how full tours were, which months and start times work, and how early guests book.
// Occupancy looks only at tours that have happened, because upcoming tours are still filling up. Lead time uses the
// day a booking was entered in the app, which can be later than the day the guest really booked.
import type { Booking, Departure, Feedback, TourProduct } from './types';

export interface OccupancyRow { key: string; label: string; departures: number; guests: number; capacity: number; occupancy: number }
export interface LeadBucket { label: string; bookings: number }
export interface Statistics {
  byProduct: OccupancyRow[];
  byStartTime: OccupancyRow[];
  byMonth: OccupancyRow[];
  leadTime: { median: number | null; buckets: LeadBucket[]; counted: number };
  noShows: { guests: number; expected: number };
  feedback: { count: number; averageStars: number | null; improvements: (Feedback & { date: string; departureId: string })[] };
}

const seats = (b: Booking) => b.adults + b.children + b.infants;
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const dayNumber = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

export function statistics(year: number, products: TourProduct[], departures: Departure[], bookings: Booking[], today: string): Statistics {
  const inYear = departures.filter((d) => !d.deleted && d.status !== 'geannuleerd' && d.date.startsWith(`${year}-`));
  const past = inYear.filter((d) => d.date < today);
  const active = bookings.filter((b) => !b.deleted && b.status !== 'geannuleerd');
  const guestsOn = (d: Departure) => active.filter((b) => b.departureId === d.id).reduce((n, b) => n + seats(b), 0);

  function group(keyOf: (d: Departure) => string, labelOf: (key: string) => string): OccupancyRow[] {
    const rows = new Map<string, OccupancyRow>();
    for (const d of past) {
      const key = keyOf(d);
      const r = rows.get(key) ?? { key, label: labelOf(key), departures: 0, guests: 0, capacity: 0, occupancy: 0 };
      r.departures++;
      r.guests += guestsOn(d);
      r.capacity += d.capacity;
      rows.set(key, r);
    }
    return [...rows.values()].map((r) => ({ ...r, occupancy: r.capacity ? r.guests / r.capacity : 0 }));
  }
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? 'Onbekend';

  const pastIds = new Set(past.map((d) => d.id));
  const inYearById = new Map(inYear.map((d) => [d.id, d]));
  const leads: number[] = [];
  for (const b of active) {
    const d = inYearById.get(b.departureId);
    // A walk-in is booked on the spot, so it says nothing about how early guests book.
    if (d && b.channel !== 'walk-in') leads.push(Math.max(0, dayNumber(d.date) - dayNumber(b.createdAt.slice(0, 10))));
  }
  leads.sort((a, b) => a - b);
  const mid = Math.floor(leads.length / 2);
  const median = !leads.length ? null : leads.length % 2 ? leads[mid] : Math.round((leads[mid - 1] + leads[mid]) / 2);
  const between = (lo: number, hi: number) => leads.filter((n) => n >= lo && n <= hi).length;

  let expected = 0, noShowGuests = 0;
  for (const b of active) {
    if (!pastIds.has(b.departureId)) continue;
    expected += seats(b);
    if (b.status === 'no-show') noShowGuests += seats(b);
  }

  const entries = inYear.flatMap((d) => (d.feedback ?? []).map((f) => ({ ...f, date: d.date, departureId: d.id })));
  const stars = entries.flatMap((f) => (f.stars ? [f.stars] : []));
  return {
    byProduct: group((d) => d.productId, nameOf).sort((a, b) => b.guests - a.guests),
    byStartTime: group((d) => d.startTime, (k) => k).sort((a, b) => a.key.localeCompare(b.key)),
    byMonth: group((d) => d.date.slice(0, 7), (k) => MONTHS[Number(k.slice(5)) - 1]).sort((a, b) => a.key.localeCompare(b.key)),
    leadTime: {
      median,
      counted: leads.length,
      buckets: [
        { label: 'Dezelfde dag of de dag ervoor', bookings: between(0, 1) },
        { label: '2 tot 7 dagen', bookings: between(2, 7) },
        { label: '8 tot 30 dagen', bookings: between(8, 30) },
        { label: 'Meer dan 30 dagen', bookings: between(31, Infinity) },
      ],
    },
    noShows: { guests: noShowGuests, expected },
    feedback: {
      count: entries.length,
      averageStars: stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : null,
      improvements: entries.filter((f) => f.kind === 'verbeterpunt').sort((a, b) => b.date.localeCompare(a.date)),
    },
  };
}
