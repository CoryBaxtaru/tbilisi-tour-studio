// Weather in the agenda: a compact chip on departure cards and day cells, and a panel on the departure page.
// Forecast from MET Norway within its range (about 9 days), climate figures (NOAA GHCN-Daily) beyond it.
import {
  CLIMATE, departureForecast, departureWeather, sunTimes, symbolLabel, tbilisiToUtc, WARNING_TEXT,
  type DepartureClimate, type DepartureForecast, type Forecast,
} from '../domain/weather';
import { refreshForecast, useForecast } from '../weather/metno';

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const deg = (n: number) => `${Math.round(n)}°`;
const range = (a: number, b: number) => (Math.round(a) === Math.round(b) ? deg(a) : `${Math.round(a)}–${deg(b)}`);
const clock = (iso: string) => new Date(iso).toLocaleString('nl-NL', { timeZone: 'Asia/Tbilisi', weekday: 'short', hour: '2-digit', minute: '2-digit' });
/** Daytime window used for a day without a departure (calendar cells). */
const DAY_START = '10:00';
const DAY_MIN = 7 * 60;

/** Glyph + temperature for a departure card; nothing for past tours. */
export function WeatherChip({ date, startTime, durationMin, today }: { date: string; startTime: string; durationMin: number; today: string }) {
  const { forecast } = useForecast();
  if (date < today) return null;
  const w = departureWeather(forecast, date, startTime, durationMin);
  if (w.kind === 'klimaat') {
    return <span class="wx-chip wx-chip--climate" title={`Klimaat ${MONTHS[w.month - 1]}: gemiddeld maximum ${deg(w.tmax)}`}>≈ {deg(w.tmax)}</span>;
  }
  const s = symbolLabel(w.symbol);
  return (
    <span class={`wx-chip ${w.warnings.length ? 'wx-chip--warn' : ''}`} title={[s.label, ...w.warnings.map((x) => WARNING_TEXT[x])].join(' · ')}>
      <span aria-hidden="true">{s.glyph}</span> {range(w.tempMin, w.tempMax)}
    </span>
  );
}

/** Small glyph in a calendar cell for days the forecast reaches. */
export function DayGlyph({ date, forecast }: { date: string; forecast: Forecast | null }) {
  const w = forecast && departureForecast(forecast, date, DAY_START, DAY_MIN);
  if (!w) return null;
  const s = symbolLabel(w.symbol);
  return <span class={`cal__wx ${w.warnings.length ? 'is-warn' : ''}`} aria-hidden="true" title={`${s.label}, ${range(w.tempMin, w.tempMax)}`}>{s.glyph}</span>;
}

/** One line for the selected day in the day panel. */
export function DayWeather({ date, today }: { date: string; today: string }) {
  const { forecast } = useForecast();
  if (date < today) return null;
  const w = departureWeather(forecast, date, DAY_START, DAY_MIN);
  return <p class="day-panel__wx meta">{w.kind === 'verwachting' ? forecastLine(w) : `${climateLine(w)} (klimaatgemiddelde)`}</p>;
}

function forecastParts(w: DepartureForecast) {
  const s = symbolLabel(w.symbol);
  return {
    ...s,
    temp: range(w.tempMin, w.tempMax),
    rain: w.precipMm > 0 ? `${String(w.precipMm).replace('.', ',')} mm${w.precipApprox ? ' (in 6-uursblokken)' : ''}` : 'droog',
    wind: `wind ${Math.round(w.windMax)} m/s`,
  };
}

function forecastLine(w: DepartureForecast) {
  const p = forecastParts(w);
  return `${p.glyph} ${p.label} · ${p.temp} · ${p.rain} · ${p.wind}`;
}

function climateLine(w: DepartureClimate) {
  const days = Math.round(w.rainChance * 100);
  return `Gem. max ${deg(w.tmax)}, gem. ${deg(w.tavg)} · regen op ${days}% van de dagen`;
}

/** Departure page: forecast or climate, warnings, sunrise/sunset and the credit. */
export function WeatherPanel({ date, startTime, durationMin, today }: { date: string; startTime: string; durationMin: number; today: string }) {
  const { forecast, loading, error } = useForecast();
  if (date < today) return null;
  const w = departureWeather(forecast, date, startTime, durationMin);
  const sun = sunTimes(date);
  const end = new Date(tbilisiToUtc(date, startTime) + durationMin * 60_000 + 4 * 3600_000).toISOString().slice(11, 16);
  const afterDark = sun && (end > sun.sunset || startTime < sun.sunrise);
  const p = w.kind === 'verwachting' ? forecastParts(w) : null;
  return (
    <section class="wx-panel" aria-label="Weer">
      {w.kind === 'verwachting' ? (
        <>
          <p class="wx-panel__main"><span class="wx-panel__glyph" aria-hidden="true">{p!.glyph}</span> {p!.label} · {p!.temp}</p>
          <p class="meta">{p!.rain} · {p!.wind} · {startTime}–{end}</p>
          {w.warnings.map((x) => <p key={x} class="hint hint--warn">{WARNING_TEXT[x]}</p>)}
        </>
      ) : (
        <>
          <p class="wx-panel__main">Klimaat in {MONTHS[w.month - 1]}</p>
          <p class="meta">{climateLine(w)}, ongeveer {w.precipMm} mm in de maand. Het weerbericht volgt zo’n 9 dagen vooraf.</p>
          {w.tmax >= 30 && <p class="hint hint--warn">Vaak heet in deze maand: plan schaduw, water en liefst een vroege start.</p>}
        </>
      )}
      {sun && <p class="meta">Zon op {sun.sunrise} · onder {sun.sunset}</p>}
      {afterDark && <p class="hint hint--warn">De tour valt deels in het donker.</p>}
      <p class="wx-panel__credit">
        {w.kind === 'verwachting'
          ? <>Weer: <a href="https://www.met.no/en" target="_blank" rel="noopener">MET Norway</a> (CC BY 4.0) · bijgewerkt {clock(forecast!.updatedAt)}</>
          : <>Klimaat: NOAA GHCN-Daily, station Tbilisi; temperatuur {CLIMATE.periods.temp.join('–')}, regen {CLIMATE.periods.precip.join('–')}</>}
        {loading && ' · ophalen…'}
        {error && <> · {error} <button class="btn btn--ghost btn--small" onClick={() => void refreshForecast(true)}>Opnieuw</button></>}
      </p>
    </section>
  );
}
