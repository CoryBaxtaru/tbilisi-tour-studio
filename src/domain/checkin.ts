// Guest check-in at the meeting point: who came, who did not, and the headcount. Pure functions.
import type { Booking, Departure, TourProduct } from './types';

export const partySize = (b: Booking) => b.adults + b.children + b.infants;

/** Guests of this booking who are present. A no-show has none, and it never exceeds the party. */
export function arrivedCount(b: Booking): number {
  return b.status === 'no-show' ? 0 : Math.min(Math.max(0, b.arrived ?? 0), partySize(b));
}

/** Sets how many came. Someone arriving after all undoes a no-show. */
export function withArrived(b: Booking, n: number): Booking {
  const arrived = Math.min(Math.max(0, n), partySize(b));
  return { ...b, arrived, status: b.status === 'no-show' && arrived > 0 ? 'geboekt' : b.status };
}

export function withNoShow(b: Booking): Booking {
  return { ...b, arrived: 0, status: 'no-show' };
}

/** The bookings to check in, in the order they were made; cancelled and deleted ones are left out. */
export function guestList(departureId: string, bookings: Booking[]): Booking[] {
  return bookings
    .filter((b) => b.departureId === departureId && !b.deleted && b.status !== 'geannuleerd')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface CheckInSummary { expected: number; arrived: number; noShow: number; waiting: number }

export function checkInSummary(list: Booking[]): CheckInSummary {
  let expected = 0, arrived = 0, noShow = 0;
  for (const b of list) {
    expected += partySize(b);
    arrived += arrivedCount(b);
    if (b.status === 'no-show') noShow += partySize(b);
  }
  return { expected, arrived, noShow, waiting: expected - arrived - noShow };
}

/**
 * The departure a guide is leading on this tour: the one named in the address, otherwise today's first
 * departure of a product that uses this tour.
 */
export function departureForGuide(tourId: string, products: TourProduct[], departures: Departure[], today: string, explicitId?: string): Departure | undefined {
  const usable = departures.filter((d) => !d.deleted && d.status !== 'geannuleerd');
  if (explicitId) {
    const named = usable.find((d) => d.id === explicitId);
    if (named) return named;
  }
  const productIds = new Set(products.filter((p) => !p.deleted && p.tourId === tourId).map((p) => p.id));
  return usable
    .filter((d) => d.date === today && productIds.has(d.productId))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
}
