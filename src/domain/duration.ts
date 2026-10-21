import type { RouteLeg, Tour } from './types';

/** Consecutive stop pairs of a tour, in order. */
export function stopPairs(tour: Tour): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 1; i < tour.stops.length; i++) pairs.push([tour.stops[i - 1].id, tour.stops[i].id]);
  return pairs;
}

/** The stored leg for a pair, or undefined if the route was never computed for this order. */
export function findLeg(tour: Tour, fromStopId: string, toStopId: string): RouteLeg | undefined {
  return tour.legs.find((l) => l.fromStopId === fromStopId && l.toStopId === toStopId);
}

export interface DurationBreakdown {
  speakingMin: number;
  walkingMin: number;
  breakMin: number;
  totalMin: number;
  walkingDistanceM: number;
  /** Stop pairs without a computed pedestrian route; walking time excludes them. */
  missingLegs: number;
}

/** Total = walking (provider routes only) + speaking + breaks. Never guesses missing walking time. */
export function tourDuration(tour: Tour): DurationBreakdown {
  const speakingMin = tour.stops.reduce((sum, s) => sum + (Number.isFinite(s.speakingMinutes) ? s.speakingMinutes : 0), 0);
  let walkingS = 0;
  let walkingDistanceM = 0;
  let missingLegs = 0;
  for (const [from, to] of stopPairs(tour)) {
    const leg = findLeg(tour, from, to);
    if (leg) {
      walkingS += leg.durationS;
      walkingDistanceM += leg.distanceM;
    } else {
      missingLegs++;
    }
  }
  const walkingMin = walkingS / 60;
  const breakMin = tour.breakMinutes || 0;
  return { speakingMin, walkingMin, breakMin, totalMin: speakingMin + walkingMin + breakMin, walkingDistanceM, missingLegs };
}
