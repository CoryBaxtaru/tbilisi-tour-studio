import type { LatLng, RouteStep } from '../domain/types';

export interface RoutedLeg {
  distanceM: number;
  durationS: number;
  geometry: [number, number][];
  steps: RouteStep[];
}

/** Replaceable pedestrian-routing backend (PRODUCT_SPEC §5). */
export interface RoutingProvider {
  id: string;
  /** Attribution that must be visible wherever routes are shown. */
  attribution: string;
  /** Routes through all waypoints in order; returns one leg per consecutive pair. */
  route(waypoints: LatLng[]): Promise<RoutedLeg[]>;
  /** Walking time in seconds between every pair of points: `[from][to]`, null when there is no route. */
  durations(points: LatLng[]): Promise<(number | null)[][]>;
}

export class RoutingError extends Error {}
