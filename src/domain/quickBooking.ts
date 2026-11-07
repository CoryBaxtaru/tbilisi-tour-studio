// Booking in one go: find the departure a new booking belongs to, and the facts a tour product takes from its tour.
import { tourDuration } from './duration';
import type { Departure, Tour, TourProduct } from './types';

/** The departure a booking for this product, day and time joins: an existing one, or none (a new one is needed). */
export function departureFor(departures: Departure[], productId: string, date: string, time: string): Departure | undefined {
  return departures.find((d) => !d.deleted && d.status !== 'geannuleerd' && d.productId === productId && d.date === date && d.startTime === time);
}

/** How long a tour takes, walking plus telling plus breaks, rounded up to a quarter of an hour. Unknown while legs are missing. */
export function tourMinutes(tour: Tour | undefined): number | null {
  if (!tour?.stops.length) return null;
  const d = tourDuration(tour);
  if (d.missingLegs > 0 || d.totalMin <= 0) return null;
  return Math.ceil(d.totalMin / 15) * 15;
}

/** What a new product takes from the tour it is based on: its name while still the default, and its length. */
export function productFromTour(p: TourProduct, tour: Tour | undefined, defaultName: string): Partial<TourProduct> {
  if (!tour) return { tourId: null };
  const minutes = tourMinutes(tour);
  return {
    tourId: tour.id,
    ...(!p.name.trim() || p.name === defaultName ? { name: tour.title } : {}),
    ...(minutes ? { durationMin: minutes } : {}),
  };
}

/** True when the meeting point text does not mention the tour's first stop, so guests may wait somewhere else. */
export function meetingPointElsewhere(meetingPoint: string, firstStopName: string | undefined): boolean {
  if (!meetingPoint.trim() || !firstStopName) return false;
  // Words in brackets count too: "Abanotubani (zwavelbaden)" is often just "de zwavelbaden".
  const words = firstStopName.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length >= 5);
  const text = meetingPoint.toLowerCase();
  return !words.some((w) => text.includes(w));
}
