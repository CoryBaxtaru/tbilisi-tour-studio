// Small pieces shared by the departure page and the Vandaag screen.
import { departureWeather } from '../domain/weather';
import { gelToEur, needsGygClosing } from '../domain/pricing';
import { isoDate } from '../domain/agenda';
import type { Departure, GelAmount, TourProduct } from '../domain/types';
import { currentRecord, saveRecord, useAppState } from '../state/store';
import { useForecast } from '../weather/metno';

const RATE_KEY = 'laatste-koers';
const num = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);
const dec = (n: number) => String(n).replace('.', ',');
function lastRate(): number {
  try { return Number(localStorage.getItem(RATE_KEY)) || 0; } catch { return 0; }
}
function rememberRate(rate: number) {
  try { localStorage.setItem(RATE_KEY, String(rate)); } catch { /* not remembered */ }
}

/** Opens the tour of this product in guide mode, or says what is missing. */
/** The main action only on the tour day; before that, booking guests matters more. */
export function StartGuiding({ product, departure, primary = true }: { product: TourProduct; departure: Departure; primary?: boolean }) {
  const { tours } = useAppState();
  const tour = tours.find((t) => t.id === product.tourId && !t.deleted);
  if (!tour) return <p class="hint">Koppel een tour aan <a href={`#/aanbod/${product.id}`}>{product.name}</a> om vanaf hier te gidsen.</p>;
  return <a class={`btn btn--big ${primary ? 'btn--primary' : ''}`} href={`#/gids/${tour.id}/${departure.id}`}>Start gidsen</a>;
}

/** Reminder that a full departure can still be booked on GetYourGuide, with a box to tick once it is closed. */
export function GygReminder({ dep, product }: { dep: Departure; product?: TourProduct }) {
  const { bookings } = useAppState();
  const today = isoDate(new Date());
  const set = (closedOnGyg: boolean) => {
    const cur = currentRecord('departures', dep.id);
    if (cur) void saveRecord('departures', { ...cur, closedOnGyg });
  };
  const needed = needsGygClosing(dep, product, bookings, today);
  if (!needed && !dep.closedOnGyg) return null;
  return (
    <div class={`notice ${needed ? '' : 'notice--quiet'}`}>
      {needed && <p>Dit vertrek is vol. Zet het dicht op GetYourGuide, anders kan iemand nog boeken.</p>}
      <label class="check"><input type="checkbox" checked={!!dep.closedOnGyg} onChange={(e) => set(e.currentTarget.checked)} />Dicht op GetYourGuide</label>
    </div>
  );
}

/** The product's plan for bad weather: open when the forecast warns, otherwise folded away. */
export function BadWeatherBox({ dep, product }: { dep: Departure; product: TourProduct }) {
  const { tours } = useAppState();
  const { forecast } = useForecast();
  if (dep.date < isoDate(new Date())) return null;
  const w = departureWeather(forecast, dep.date, dep.startTime, product.durationMin);
  const warn = w.kind === 'verwachting' && w.warnings.length > 0;
  const alt = tours.find((t) => t.id === product.badWeatherTourId && !t.deleted);
  const plan = product.badWeatherPlan?.trim();
  if (!plan && !alt) {
    return warn ? <p class="hint hint--warn">Slecht weer verwacht en nog geen plan. <a href={`#/aanbod/${product.id}`}>Maak een plan</a>.</p> : null;
  }
  const body = (
    <>
      {plan && <p>{plan}</p>}
      {alt && <p><a href={`#/gids/${alt.id}`}>Gids in plaats daarvan: {alt.title || 'Naamloze tour'}</a></p>}
    </>
  );
  if (warn) return <div class="notice"><p><strong>Plan bij slecht weer</strong></p>{body}</div>;
  return <details class="notice notice--quiet"><summary>Plan bij slecht weer</summary>{body}</details>;
}

/** Amount in lari with the rate used. The rate is typed by the guide; the last one is suggested. */
export function GelFields({ gel, label, onChange }: { gel?: GelAmount; label: string; onChange: (g: GelAmount | undefined) => void }) {
  const update = (next: GelAmount) => {
    if (next.gelPerEur > 0) rememberRate(next.gelPerEur);
    onChange(next);
  };
  return (
    <div class="gel-fields">
      <label class="check"><input type="checkbox" checked={!!gel} onChange={(e) => onChange(e.currentTarget.checked ? { amount: 0, gelPerEur: lastRate() } : undefined)} />{label}</label>
      {gel && (
        <>
          <label class="narrow">Bedrag (₾)<input inputMode="decimal" value={dec(gel.amount)} onChange={(e) => update({ ...gel, amount: num(e.currentTarget.value) })} /></label>
          <label class="narrow">Lari per euro<input inputMode="decimal" value={dec(gel.gelPerEur)} onChange={(e) => update({ ...gel, gelPerEur: num(e.currentTarget.value) })} /></label>
          <span class="meta">{gel.gelPerEur > 0 ? `= € ${dec(gelToEur(gel))}` : 'Vul de koers in'}</span>
        </>
      )}
    </div>
  );
}
