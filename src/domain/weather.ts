// Weather for departures: MET Norway forecast within its range, bundled climate figures beyond it, and local
// sunrise/sunset. Pure functions; fetching and caching live in src/weather/metno.ts.
import climate from '../data/climate-tbilisi.json';

/** Tbilisi is UTC+4 all year (Georgia has had no daylight saving time since 2005). */
export const TBILISI_UTC_OFFSET_H = 4;
/** One forecast point for all departures: central Tbilisi (Old Town), 4 decimals as MET asks. */
export const FORECAST_POINT = { lat: 41.6934, lon: 44.8015 };

export interface ForecastStep {
  time: string; // ISO UTC
  temp: number; // °C
  wind: number; // m/s, 10 min mean
  /** Next-hour period, present for roughly the first 2-3 days. */
  hour?: { symbol: string; precip: number };
  /** Next six hours, present on most steps. */
  six?: { symbol: string; precip: number };
}

export interface Forecast {
  updatedAt: string; // MET model run (properties.meta.updated_at)
  fetchedAt: string;
  expires: string; // from the Expires header; fetch again only after this
  steps: ForecastStep[];
}

interface MetPeriod { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } }
interface MetJson {
  properties?: {
    meta?: { updated_at?: string };
    timeseries?: { time: string; data: { instant: { details: { air_temperature?: number; wind_speed?: number } }; next_1_hours?: MetPeriod; next_6_hours?: MetPeriod } }[];
  };
}

const period = (p?: MetPeriod) =>
  p?.summary?.symbol_code ? { symbol: p.summary.symbol_code, precip: p.details?.precipitation_amount ?? 0 } : undefined;

/** Reads MET's locationforecast "compact" JSON. Throws when the shape is not what we expect. */
export function parseMetForecast(json: unknown, fetchedAt: string, expires: string): Forecast {
  const props = (json as MetJson)?.properties;
  if (!Array.isArray(props?.timeseries)) throw new Error('Onverwacht antwoord van MET Norway');
  const steps: ForecastStep[] = [];
  for (const t of props.timeseries) {
    const d = t.data?.instant?.details;
    if (typeof d?.air_temperature !== 'number') continue;
    steps.push({ time: t.time, temp: d.air_temperature, wind: d.wind_speed ?? 0, hour: period(t.data.next_1_hours), six: period(t.data.next_6_hours) });
  }
  return { updatedAt: props.meta?.updated_at ?? fetchedAt, fetchedAt, expires, steps };
}

/** Local Tbilisi date + time to a UTC timestamp in ms. */
export function tbilisiToUtc(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00Z`) - TBILISI_UTC_OFFSET_H * 3600_000;
}

export type WeatherWarning = 'hitte' | 'regen' | 'onweer' | 'wind' | 'kou' | 'sneeuw';

export interface DepartureForecast {
  kind: 'verwachting';
  symbol: string; // MET symbol code that best describes the tour
  tempMin: number;
  tempMax: number;
  precipMm: number;
  /** True when precipitation comes from six-hour periods, so it may partly fall outside the tour. */
  precipApprox: boolean;
  windMax: number;
  warnings: WeatherWarning[];
}

export interface DepartureClimate {
  kind: 'klimaat';
  month: number;
  tmax: number;
  tavg: number;
  precipMm: number;
  wetDays: number;
  /** Share of days with at least 1 mm of rain, 0-1. */
  rainChance: number;
}

const HOUR = 3600_000;
const SEVERITY = ['thunder', 'snow', 'sleet', 'heavyrain', 'rain', 'lightrain', 'fog', 'cloudy', 'partlycloudy', 'fair', 'clearsky'];
const severity = (symbol: string) => {
  const i = SEVERITY.findIndex((s) => symbol.replace(/_(day|night|polartwilight)$/, '').includes(s));
  return i < 0 ? SEVERITY.length : i;
};

/**
 * Forecast for a tour from start to start + duration (local Tbilisi time), or null when the forecast does not
 * reach that far. Uses hourly periods where they cover the whole tour, otherwise the six-hour periods.
 */
export function departureForecast(f: Forecast, date: string, startTime: string, durationMin: number): DepartureForecast | null {
  const start = tbilisiToUtc(date, startTime);
  const end = start + Math.max(durationMin, 60) * 60_000;
  const steps = f.steps.map((s) => ({ ...s, t: Date.parse(s.time) }));
  if (!steps.length || steps.at(-1)!.t < end - HOUR || end <= Date.parse(f.fetchedAt)) return null;

  // Hourly periods [t, t+1h) that overlap the tour.
  const hourly = steps.filter((s) => s.t < end && s.t + HOUR > start);
  const hourlyComplete = hourly.length >= Math.ceil((end - start) / HOUR) && hourly.every((s) => s.hour);
  let periods: { symbol: string; precip: number }[];
  if (hourlyComplete) periods = hourly.map((s) => s.hour!);
  else {
    const six = steps.filter((s) => s.six && s.t < end && s.t + 6 * HOUR > start);
    if (!six.length) return null;
    periods = six.map((s) => s.six!);
  }

  // Temperatures: points inside the tour, or the two around it when the steps are further apart.
  let around = steps.filter((s) => s.t >= start && s.t <= end);
  if (!around.length) around = [steps.filter((s) => s.t <= start).at(-1), steps.find((s) => s.t >= end)].filter((s) => !!s);
  const temps = around.map((s) => s.temp);
  const windMax = Math.max(...around.map((s) => s.wind));
  const precipMm = Math.round(periods.reduce((sum, p) => sum + p.precip, 0) * 10) / 10;
  const symbol = periods.map((p) => p.symbol).sort((a, b) => severity(a) - severity(b))[0];
  const tempMax = Math.max(...temps);
  const tempMin = Math.min(...temps);

  const warnings: WeatherWarning[] = [];
  if (symbol.includes('thunder')) warnings.push('onweer');
  if (/snow|sleet/.test(symbol)) warnings.push('sneeuw');
  else if (precipMm >= 1) warnings.push('regen');
  if (tempMax >= 32) warnings.push('hitte');
  if (tempMin <= 0) warnings.push('kou');
  if (windMax >= 10) warnings.push('wind');
  return { kind: 'verwachting', symbol, tempMin, tempMax, precipMm, precipApprox: !hourlyComplete, windMax, warnings };
}

export const CLIMATE = climate;

export function climateFor(date: string): DepartureClimate {
  const month = Number(date.slice(5, 7));
  const m = climate.months[month - 1];
  const days = new Date(Number(date.slice(0, 4)), month, 0).getDate();
  return { kind: 'klimaat', month, tmax: m.tmax, tavg: m.tavg, precipMm: m.precipMm, wetDays: m.wetDays, rainChance: m.wetDays / days };
}

/** Forecast when it reaches the tour, otherwise the climate figures for that month. */
export function departureWeather(f: Forecast | null, date: string, startTime: string, durationMin: number): DepartureForecast | DepartureClimate {
  return (f && departureForecast(f, date, startTime, durationMin)) ?? climateFor(date);
}

const LABELS: [string, string, string][] = [
  // [part of MET symbol code, Dutch label, glyph]
  ['thunder', 'Onweer', '⛈'],
  ['snow', 'Sneeuw', '❄'],
  ['sleet', 'Natte sneeuw', '❄'],
  ['heavyrain', 'Zware regen', '☂'],
  ['lightrain', 'Lichte regen', '☂'],
  ['rain', 'Regen', '☂'],
  ['fog', 'Mist', '≋'],
  ['partlycloudy', 'Half bewolkt', '⛅'],
  ['cloudy', 'Bewolkt', '☁'],
  ['fair', 'Overwegend zonnig', '☀'],
  ['clearsky', 'Zonnig', '☀'],
];

export function symbolLabel(symbol: string): { label: string; glyph: string } {
  const hit = LABELS.find(([k]) => symbol.includes(k));
  const night = symbol.endsWith('_night');
  if (!hit) return { label: 'Onbekend', glyph: '·' };
  if (night && (hit[0] === 'clearsky' || hit[0] === 'fair')) return { label: hit[0] === 'clearsky' ? 'Helder' : 'Overwegend helder', glyph: '☾' };
  return { label: hit[1], glyph: hit[2] };
}

export const WARNING_TEXT: Record<WeatherWarning, string> = {
  hitte: 'Hitte: plan schaduw en water',
  regen: 'Regen verwacht',
  onweer: 'Kans op onweer',
  wind: 'Harde wind',
  kou: 'Vorst',
  sneeuw: 'Sneeuw of natte sneeuw',
};

/**
 * Sunrise and sunset in local Tbilisi time ('HH:MM'), with the NOAA solar position formulas
 * (accurate to about a minute at this latitude). Null for polar day/night, which never happens in Tbilisi.
 */
export function sunTimes(date: string, lat = FORECAST_POINT.lat, lon = FORECAST_POINT.lon): { sunrise: string; sunset: string } | null {
  const rad = Math.PI / 180;
  const noonUtc = Date.parse(`${date}T12:00:00Z`);
  const jc = (noonUtc / 86400_000 + 2440587.5 - 2451545) / 36525;
  const L0 = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const C = Math.sin(M * rad) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * jc) + Math.sin(3 * M * rad) * 0.000289;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * jc) * rad);
  const eps0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos((125.04 - 1934.136 * jc) * rad);
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
  const y = Math.tan((eps / 2) * rad) ** 2;
  const eqTime = 4 / rad * (y * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad)
    - 0.5 * y * y * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
  const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosH < -1 || cosH > 1) return null;
  const ha = Math.acos(cosH) / rad;
  const noonMin = 720 - 4 * lon - eqTime + TBILISI_UTC_OFFSET_H * 60;
  const fmt = (min: number) => {
    const m = Math.round(min);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  return { sunrise: fmt(noonMin - 4 * ha), sunset: fmt(noonMin + 4 * ha) };
}
