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
}

export class RoutingError extends Error {}
