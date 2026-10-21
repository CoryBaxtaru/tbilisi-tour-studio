// FOSSGIS public OSRM server, foot profile. Free; policy: max 1 request/second, no heavy use,
// attribution required (see docs/HOSTING.md). One request per tour calculation.
import type { LatLng } from '../domain/types';
import { RoutingError, type RoutedLeg, type RoutingProvider } from './provider';

const ENDPOINT = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/';
const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;

interface OsrmStep {
  distance: number;
  name: string;
  maneuver: { type: string; modifier?: string };
  geometry: { coordinates: [number, number][] };
}
interface OsrmResponse {
  code: string;
  message?: string;
  routes?: { legs: { distance: number; duration: number; steps: OsrmStep[] }[] }[];
}

export const fossgisFoot: RoutingProvider = {
  id: 'fossgis-osrm-foot',
  attribution: 'Route: FOSSGIS OSRM, data © OpenStreetMap-bijdragers',
  async route(waypoints: LatLng[]): Promise<RoutedLeg[]> {
    if (waypoints.length < 2) return [];
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();

    const coords = waypoints.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}${coords}?overview=false&steps=true&geometries=geojson`);
    } catch {
      throw new RoutingError('Geen verbinding met de routeserver. Route berekenen vereist internet.');
    }
    if (res.status === 429) throw new RoutingError('Routeserver is druk (limiet). Probeer het over een minuut opnieuw.');
    if (!res.ok) throw new RoutingError(`Routeserver gaf fout ${res.status}.`);
    return parseOsrm((await res.json()) as OsrmResponse, waypoints.length - 1);
  },
};

export function parseOsrm(data: OsrmResponse, expectedLegs: number): RoutedLeg[] {
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new RoutingError(data.code === 'NoRoute' ? 'Geen looproute gevonden tussen deze punten.' : `Route niet beschikbaar (${data.code}).`);
  }
  const legs = data.routes[0].legs;
  if (legs.length !== expectedLegs) throw new RoutingError('Onverwacht antwoord van de routeserver.');
  return legs.map((leg) => {
    const geometry: [number, number][] = [];
    for (const step of leg.steps) {
      for (const [lng, lat] of step.geometry.coordinates) {
        const last = geometry[geometry.length - 1];
        if (!last || last[0] !== lat || last[1] !== lng) geometry.push([lat, lng]);
      }
    }
    return {
      distanceM: leg.distance,
      durationS: leg.duration,
      geometry,
      steps: leg.steps.map((s) => ({ type: s.maneuver.type, modifier: s.maneuver.modifier ?? '', name: s.name, distanceM: s.distance })),
    };
  });
}
