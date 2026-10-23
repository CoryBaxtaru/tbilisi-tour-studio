// MET Norway locationforecast (free, CC BY 4.0 / NLOD, commercial use allowed; terms in docs/HOSTING.md).
// One request for central Tbilisi serves every departure. The response is kept in IndexedDB and only fetched
// again after its Expires time, as MET's terms require; offline the last forecast stays visible.
// Browsers cannot set User-Agent: MET identifies browser apps by the Origin header, so this is a plain GET
// with no custom headers (no CORS preflight).
import { useEffect, useState } from 'preact/hooks';
import { FORECAST_POINT, parseMetForecast, type Forecast } from '../domain/weather';
import { getMeta, setMeta } from '../storage/db';

const URL_FORECAST = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${FORECAST_POINT.lat}&lon=${FORECAST_POINT.lon}`;
const KEY = 'weather:forecast';
const MIN_RETRY_MS = 10 * 60_000; // after a failure, wait before asking again

export interface ForecastState {
  forecast: Forecast | null;
  loading: boolean;
  error: string | null;
}

let state: ForecastState = { forecast: null, loading: false, error: null };
let lastAttempt = 0;
let loaded = false;
const listeners = new Set<() => void>();
const set = (patch: Partial<ForecastState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

/** Loads the cached forecast, then fetches a new one if it has expired (or `force` after a failure). */
export async function refreshForecast(force = false): Promise<void> {
  if (!loaded) {
    loaded = true;
    try {
      const cached = await getMeta<Forecast>(KEY);
      if (cached) set({ forecast: cached });
    } catch { /* no cache: fetch below */ }
  }
  const now = Date.now();
  const fresh = state.forecast && Date.parse(state.forecast.expires) > now;
  if (fresh || state.loading || (!force && now - lastAttempt < MIN_RETRY_MS)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  lastAttempt = now;
  set({ loading: true });
  try {
    const res = await fetch(URL_FORECAST);
    if (!res.ok) throw new Error(res.status === 429 ? 'MET Norway vraagt om minder verzoeken' : `MET Norway antwoordde ${res.status}`);
    // Without an Expires header, keep the forecast for half an hour.
    const expiresHeader = Date.parse(res.headers.get('Expires') ?? '');
    const expires = new Date(Number.isNaN(expiresHeader) ? now + 30 * 60_000 : expiresHeader).toISOString();
    const forecast = parseMetForecast(await res.json(), new Date(now).toISOString(), expires);
    await setMeta(KEY, forecast).catch(() => undefined);
    set({ forecast, loading: false, error: null });
  } catch (e) {
    set({ loading: false, error: e instanceof Error && e.message.startsWith('MET') ? e.message : 'Weerbericht niet opgehaald (offline?)' });
  }
}

/** The forecast for all departures; starts a refresh when the component mounts. */
export function useForecast(): ForecastState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    void refreshForecast();
    return () => { listeners.delete(l); };
  }, []);
  return state;
}
