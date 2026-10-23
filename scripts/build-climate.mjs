// Builds src/data/climate-tbilisi.json: monthly climate figures for Tbilisi from NOAA GHCN-Daily station
// GG000037545 (TBILISI, 41.68 N 44.95 E, 448 m). Build time only; the app never calls NOAA.
// The station's record is complete up to 1992; after that precipitation and minimum temperature are mostly
// missing while maximum and mean temperature stay well covered. So temperatures use 2005-2024 (current climate)
// and precipitation uses the 1961-1990 WMO normal period. A month counts only with at most 5 missing days.
// Usage: node scripts/build-climate.mjs
import { writeFileSync } from 'node:fs';

const STATION = 'GG000037545';
const URL_CSV = `https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access/${STATION}.csv`;
const TEMP = [2005, 2024];
const RAIN = [1961, 1990];
const COL = { prcp: 6, tmax: 10, tmin: 12, tavg: 14 }; // value column; the next column holds "M,Q,S" flags

const res = await fetch(URL_CSV);
if (!res.ok) throw new Error(`${res.status} ${URL_CSV}`);
const lines = (await res.text()).trim().split('\n').slice(1);

const byMonth = {}; // 'YYYY-MM' -> { prcp: [], tmax: [], tmin: [], tavg: [] } in °C / mm
for (const line of lines) {
  const cells = line.match(/("[^"]*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').trim());
  const ym = cells[1].slice(0, 7);
  const b = (byMonth[ym] ??= { prcp: [], tmax: [], tmin: [], tavg: [] });
  for (const [k, i] of Object.entries(COL)) {
    const failedQuality = !!cells[i + 1]?.split(',')[1];
    if (cells[i] !== '' && !failedQuality) b[k].push(Number(cells[i]) / 10);
  }
}

const daysIn = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0).getDate();
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const round1 = (x) => Math.round(x * 10) / 10;
/** Mean over the years in [from, to] of a per-month statistic, using only near-complete months. */
function normal(month, [from, to], key, stat = (vals) => mean(vals)) {
  const perYear = [];
  for (let y = from; y <= to; y++) {
    const ym = `${y}-${String(month).padStart(2, '0')}`;
    const vals = byMonth[ym]?.[key] ?? [];
    const n = daysIn(ym);
    if (vals.length >= n - 5) perYear.push(stat(vals, n));
  }
  if (perYear.length < 10) throw new Error(`te weinig jaren voor ${key} in maand ${month}: ${perYear.length}`);
  return { value: mean(perYear), years: perYear.length };
}
const monthTotal = (vals, n) => (vals.reduce((s, x) => s + x, 0) * n) / vals.length;
const wetDays = (vals, n) => (vals.filter((p) => p >= 1).length * n) / vals.length;

const months = [];
for (let m = 1; m <= 12; m++) {
  const tmax = normal(m, TEMP, 'tmax');
  const tavg = normal(m, TEMP, 'tavg');
  const rain = normal(m, RAIN, 'prcp', monthTotal);
  const wet = normal(m, RAIN, 'prcp', wetDays);
  months.push({
    month: m,
    tmax: round1(tmax.value),
    tavg: round1(tavg.value),
    precipMm: Math.round(rain.value),
    wetDays: round1(wet.value),
    years: { temp: Math.min(tmax.years, tavg.years), precip: rain.years },
  });
  console.log(m, months.at(-1));
}

const out = {
  station: { id: STATION, name: 'Tbilisi', lat: 41.68, lon: 44.95, elevationM: 448 },
  periods: { temp: TEMP, precip: RAIN },
  source: 'NOAA NCEI GHCN-Daily (Menne et al. 2012), doi:10.7289/V5D21VHZ',
  sourceUrl: URL_CSV,
  retrieved: new Date().toISOString().slice(0, 10),
  months,
};
writeFileSync(new URL('../src/data/climate-tbilisi.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('geschreven: src/data/climate-tbilisi.json');
