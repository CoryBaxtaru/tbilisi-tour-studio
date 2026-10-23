import { describe, expect, it } from 'vitest';
import { climateFor, departureForecast, departureWeather, parseMetForecast, sunTimes, symbolLabel, tbilisiToUtc } from './weather';

/** MET-shaped JSON: hourly steps for `hourly` hours from `from`, then six-hourly steps up to `until`. */
function metJson(from: string, hourly: number, until: string, overrides: (iso: string) => { temp?: number; wind?: number; symbol?: string; precip?: number } = () => ({})) {
  const timeseries = [];
  let t = Date.parse(from);
  const stop = Date.parse(until);
  for (let i = 0; t <= stop; i++) {
    const iso = new Date(t).toISOString().replace('.000', '');
    const o = overrides(iso);
    const p = { summary: { symbol_code: o.symbol ?? 'clearsky_day' }, details: { precipitation_amount: o.precip ?? 0 } };
    timeseries.push({
      time: iso,
      data: {
        instant: { details: { air_temperature: o.temp ?? 20, wind_speed: o.wind ?? 2 } },
        ...(i < hourly ? { next_1_hours: p } : {}),
        next_6_hours: p,
      },
    });
    t += (i < hourly ? 1 : 6) * 3600_000;
  }
  return { properties: { meta: { updated_at: from }, timeseries } };
}

const FETCHED = '2026-10-23T06:00:00Z';
const forecast = (json: unknown) => parseMetForecast(json, FETCHED, '2026-10-23T06:30:00Z');

describe('tbilisiToUtc', () => {
  it('subtracts four hours', () => {
    expect(new Date(tbilisiToUtc('2026-10-24', '10:00')).toISOString()).toBe('2026-10-24T06:00:00.000Z');
  });
});

describe('parseMetForecast', () => {
  it('reads steps and periods', () => {
    const f = forecast(metJson('2026-10-23T06:00:00Z', 2, '2026-10-23T20:00:00Z'));
    expect(f.steps[0]).toEqual({ time: '2026-10-23T06:00:00Z', temp: 20, wind: 2, hour: { symbol: 'clearsky_day', precip: 0 }, six: { symbol: 'clearsky_day', precip: 0 } });
    expect(f.steps[2].hour).toBeUndefined();
  });
  it('rejects other shapes', () => {
    expect(() => parseMetForecast({ error: 'x' }, FETCHED, FETCHED)).toThrow();
  });
});

describe('departureForecast', () => {
  it('uses hourly periods inside the tour', () => {
    // Tour 10:00-13:00 local = 06:00-09:00 UTC; rain at 07 UTC, 31 °C at 08 UTC.
    const f = forecast(metJson('2026-10-24T00:00:00Z', 48, '2026-10-30T00:00:00Z', (iso) =>
      iso === '2026-10-24T07:00:00Z' ? { symbol: 'rain', precip: 1.5 } : iso === '2026-10-24T08:00:00Z' ? { temp: 33 } : {}));
    const w = departureForecast(f, '2026-10-24', '10:00', 180)!;
    expect(w).toMatchObject({ symbol: 'rain', precipMm: 1.5, precipApprox: false, tempMax: 33, tempMin: 20 });
    expect(w.warnings).toEqual(['regen', 'hitte']);
  });
  it('falls back to six-hour periods further ahead', () => {
    const f = forecast(metJson('2026-10-24T00:00:00Z', 6, '2026-11-01T00:00:00Z', (iso) =>
      iso.startsWith('2026-10-29T06') ? { symbol: 'lightrainshowers_day', precip: 0.4, wind: 11 } : {}));
    const w = departureForecast(f, '2026-10-29', '10:00', 120)!;
    expect(w).toMatchObject({ symbol: 'lightrainshowers_day', precipMm: 0.4, precipApprox: true, windMax: 11 });
    expect(w.warnings).toEqual(['wind']);
  });
  it('returns null beyond the forecast and for past tours', () => {
    const f = forecast(metJson('2026-10-23T06:00:00Z', 48, '2026-11-01T00:00:00Z'));
    expect(departureForecast(f, '2026-11-05', '10:00', 120)).toBeNull();
    expect(departureForecast(f, '2026-10-22', '10:00', 120)).toBeNull();
  });
  it('picks the most severe symbol', () => {
    const f = forecast(metJson('2026-10-24T00:00:00Z', 48, '2026-10-26T00:00:00Z', (iso) =>
      iso === '2026-10-24T07:00:00Z' ? { symbol: 'rainandthunder' } : iso === '2026-10-24T06:00:00Z' ? { symbol: 'cloudy' } : {}));
    expect(departureForecast(f, '2026-10-24', '10:00', 120)!.warnings).toContain('onweer');
  });
});

describe('climate', () => {
  it('has twelve months from the bundled file', () => {
    const c = climateFor('2027-07-15');
    expect(c.kind).toBe('klimaat');
    expect(c.month).toBe(7);
    expect(c.tmax).toBeGreaterThan(c.tavg);
    expect(c.rainChance).toBeGreaterThan(0);
    expect(c.rainChance).toBeLessThan(1);
  });
  it('is the fallback when the forecast does not reach', () => {
    expect(departureWeather(null, '2027-01-10', '10:00', 120).kind).toBe('klimaat');
  });
});

describe('sunTimes', () => {
  // Reference: MET Norway sunrise API 3.0 for 41.6934 N 44.8015 E, offset +04:00.
  const close = (a: string, b: string) => {
    const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    expect(Math.abs(m(a) - m(b))).toBeLessThanOrEqual(2);
  };
  it('matches MET on 2026-10-23', () => {
    const s = sunTimes('2026-10-23')!;
    close(s.sunrise, '07:21');
    close(s.sunset, '18:07');
  });
  it('matches MET on 2026-06-21', () => {
    const s = sunTimes('2026-06-21')!;
    close(s.sunrise, '05:26');
    close(s.sunset, '20:38');
  });
});

describe('symbolLabel', () => {
  it('names day and night symbols in Dutch', () => {
    expect(symbolLabel('partlycloudy_day').label).toBe('Half bewolkt');
    expect(symbolLabel('clearsky_night').label).toBe('Helder');
    expect(symbolLabel('heavyrainandthunder').label).toBe('Onweer');
  });
});
