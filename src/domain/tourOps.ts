// Pure stop-list operations used by drag and drop and the buttons.
import { createStop } from './factory';
import type { TalkingPoint, Tour } from './types';

/** Inserts a stop; `talkingPoints` pre-fills it (e.g. starter points from research). */
export function insertStop(tour: Tour, landmarkId: string, index = tour.stops.length, talkingPoints: TalkingPoint[] = []): Tour {
  const stops = tour.stops.slice();
  stops.splice(clamp(index, 0, stops.length), 0, { ...createStop(landmarkId), talkingPoints });
  return { ...tour, stops };
}

export function moveStop(tour: Tour, from: number, to: number): Tour {
  if (from === to || from < 0 || from >= tour.stops.length) return tour;
  const stops = tour.stops.slice();
  const [s] = stops.splice(from, 1);
  stops.splice(clamp(to, 0, stops.length), 0, s);
  return { ...tour, stops };
}

export function removeStop(tour: Tour, stopId: string): Tour {
  return { ...tour, stops: tour.stops.filter((s) => s.id !== stopId) };
}

/** Index of the first stop using this landmark, or -1. */
export function stopIndexOf(tour: Tour, landmarkId: string): number {
  return tour.stops.findIndex((s) => s.landmarkId === landmarkId);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
