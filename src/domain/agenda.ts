// Business hub: tour products, departures and bookings (all entered by the guide), the month calendar and the
// retention rule for guests' personal data. Pure functions; dates are local Tbilisi dates (YYYY-MM-DD).
import { newId, nowIso } from './factory';
import type { Booking, BookingChannel, Departure, DepartureStatus, TourProduct } from './types';

/** Guests' name, contact and notes are erased this many months after the tour (founder's choice, 2026-10-23). */
export const RETENTION_MONTHS = 6;

export const CHANNELS: Record<BookingChannel, string> = {
  getyourguide: 'GetYourGuide', direct: 'Direct', whatsapp: 'WhatsApp', 'walk-in': 'Walk-in', anders: 'Anders',
};
export const DEPARTURE_STATUS: Record<DepartureStatus, string> = {
  gepland: 'Gepland', bevestigd: 'Bevestigd', afgerond: 'Afgerond', geannuleerd: 'Geannuleerd',
};

export function createProduct(name = 'Nieuw touraanbod'): TourProduct {
  const now = nowIso();
  return {
    id: newId(), createdAt: now, updatedAt: now, name, tourId: null, durationMin: 180, language: 'nl',
    meetingPoint: '', maxGuests: 10, minGuests: 2, included: '', notes: '', active: true,
  };
}

export function createDeparture(product: TourProduct, date: string, startTime = '10:00'): Departure {
  const now = nowIso();
  return { id: newId(), createdAt: now, updatedAt: now, productId: product.id, date, startTime, capacity: product.maxGuests, status: 'gepland', notes: '' };
}

export function createBooking(departureId: string): Booking {
  const now = nowIso();
  return {
    id: newId(), createdAt: now, updatedAt: now, departureId, channel: 'direct', reference: '', leadName: '', contact: '',
    adults: 1, children: 0, infants: 0, priceTotal: 0, commission: 0, paid: false, status: 'geboekt', notes: '',
  };
}

/** Everyone who takes a place: adults, children and infants of active bookings. */
export function guests(b: Booking): number {
  return b.status === 'geannuleerd' ? 0 : b.adults + b.children + b.infants;
}

export interface Fill {
  booked: number;
  capacity: number;
  free: number;
  belowMinimum: boolean;
  full: boolean;
}

export function departureFill(dep: Departure, bookings: Booking[], minGuests: number): Fill {
  const booked = bookings.filter((b) => b.departureId === dep.id && !b.deleted).reduce((n, b) => n + guests(b), 0);
  return { booked, capacity: dep.capacity, free: Math.max(0, dep.capacity - booked), belowMinimum: booked < minGuests, full: booked >= dep.capacity };
}

/** Revenue of a departure's active bookings: what guests pay, the channels' commission, and what remains. */
export function departureMoney(depId: string, bookings: Booking[]): { gross: number; commission: number; net: number } {
  let gross = 0, commission = 0;
  for (const b of bookings) {
    if (b.departureId !== depId || b.deleted || b.status === 'geannuleerd') continue;
    gross += b.priceTotal;
    commission += b.commission;
  }
  return { gross, commission, net: gross - commission };
}

// ---- Dates ----

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Weeks (Monday first) covering the month; each day is YYYY-MM-DD. `month` is 1–12. */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month - 1, 1);
  const start = new Date(year, month - 1, 1 - ((first.getDay() + 6) % 7));
  const prefix = `${year}-${pad(month)}`;
  const weeks: string[][] = [];
  let d = start;
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) { week.push(isoDate(d)); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
    if (!week.some((x) => x.startsWith(prefix))) break;
    weeks.push(week);
  }
  return weeks;
}

/** YYYY-MM-DD plus whole months, clamped to the month's last day (31 Aug + 6 → 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return isoDate(new Date(target.getFullYear(), target.getMonth(), Math.min(d, last)));
}

// ---- Retention ----

/**
 * Bookings whose personal data is due for erasure: tour date + RETENTION_MONTHS is today or earlier.
 * Returns the erased versions. Deterministic (same input → same record, same updatedAt), so laptop and phone
 * erasing the same booking produce identical records and sync sees no conflict.
 */
export function dueForErasure(bookings: Booking[], departures: Departure[], today: string): Booking[] {
  const dateOf = new Map(departures.map((d) => [d.id, d.date]));
  const out: Booking[] = [];
  for (const b of bookings) {
    if (b.deleted || b.anonymizedAt) continue;
    const date = dateOf.get(b.departureId);
    if (!date) continue;
    const due = addMonths(date, RETENTION_MONTHS);
    if (due > today) continue;
    const at = `${due}T00:00:00.000Z`;
    const updatedAt = b.updatedAt >= at ? new Date(Date.parse(b.updatedAt) + 1).toISOString() : at;
    out.push({ ...b, leadName: '', contact: '', notes: '', anonymizedAt: at, updatedAt });
  }
  return out;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
