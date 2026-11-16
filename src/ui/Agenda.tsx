// Business hub: the month calendar of departures (#/agenda/YYYY-MM). Everything is entered by the guide;
// guests never use the app. A departure has its own page (DeparturePage.tsx), and so have the tour products (ProductPage.tsx).
import { useState } from 'preact/hooks';
import { createDeparture, departureFill, isoDate, monthGrid } from '../domain/agenda';
import { blockedOn, clashes, createBlockedDay } from '../domain/planning';
import type { Departure, TourProduct } from '../domain/types';
import { deleteRecord, saveRecord, useAppState } from '../state/store';
import { navigate } from './router';
import { DayGlyph, DayWeather, WeatherChip } from './Weather';
import { useForecast } from '../weather/metno';
import { lastProductId, QuickBooking, remember } from './QuickBooking';
import { WEEKDAYS, UPCOMING, longDate, shortDate, capitalize, shiftMonth, productName, fillStatus, FillBar } from './AgendaBits';

// ---- Month calendar ----

export function Agenda({ month }: { month?: string }) {
  const { products, departures, bookings, blocked } = useAppState();
  const today = isoDate(new Date());
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const [picked, setPicked] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const { forecast } = useForecast();
  const day = picked?.startsWith(ym) ? picked : today.startsWith(ym) ? today : `${ym}-01`;
  const productById = new Map(products.map((p) => [p.id, p]));
  const deps = departures.filter((d) => !d.deleted).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const onDay = (d: string) => deps.filter((x) => x.date === d);
  const upcoming = deps.filter((d) => d.date >= today && d.status !== 'geannuleerd').slice(0, UPCOMING);
  const status = (d: Departure) => {
    const min = productById.get(d.productId)?.minGuests ?? 0;
    return fillStatus(d, departureFill(d, bookings, min), min);
  };

  return (
    <main class="page page--wide agenda">
      <div class="agenda__head">
        <h1 class="agenda__title">{capitalize(longDate(`${ym}-01`, { month: 'long', year: 'numeric' }))}</h1>
        <nav class="seg" aria-label="Maand kiezen">
          <a href={`#/agenda/${shiftMonth(ym, -1)}`} aria-label="Vorige maand">‹</a>
          <a href={`#/agenda/${today.slice(0, 7)}`} aria-current={today.startsWith(ym) ? 'date' : undefined}>Vandaag</a>
          <a href={`#/agenda/${shiftMonth(ym, 1)}`} aria-label="Volgende maand">›</a>
        </nav>
        <span class="agenda__links">
          <a class="btn btn--small" href="#/aanbod">Touraanbod</a>
          <a class="btn btn--small" href={`#/geld/${y}`}>Financiën</a>
          <a class="btn btn--small" href={`#/cijfers/${y}`}>Cijfers</a>
          {!booking && <button type="button" class="btn btn--primary btn--small" onClick={() => setBooking(true)}>Nieuwe boeking</button>}
        </span>
      </div>
      {booking && <QuickBooking key={day} date={day} onClose={() => setBooking(false)} />}

      <div class="agenda__body">
        <section class="cal" aria-label="Kalender">
          <div class="cal__grid" role="grid">
            {WEEKDAYS.map((w) => <div key={w} class="cal__wd" role="columnheader">{w}</div>)}
            {monthGrid(y, m).flat().map((d) => {
              const list = onDay(d);
              const inMonth = d.startsWith(ym);
              return (
                <button key={d} role="gridcell" aria-selected={d === day}
                  aria-label={`${longDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${blockedOn(d, blocked) ? ', geblokkeerd' : ''}${list.length ? `, ${list.length} vertrek${list.length > 1 ? 'ken' : ''}` : ''}`}
                  class={`cal__day ${inMonth ? '' : 'is-other'} ${d === today ? 'is-today' : ''} ${d === day ? 'is-picked' : ''} ${blockedOn(d, blocked) ? 'is-blocked' : ''}`}
                  onClick={() => setPicked(d)}>
                  <DayGlyph date={d} forecast={forecast} />
                  <span class="cal__num">{Number(d.slice(8))}</span>
                  <span class="cal__dots" aria-hidden="true">
                    {list.slice(0, 3).map((x) => <span key={x.id} class={`dot dot--${status(x).state}`} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <p class="cal__legend meta">
            <span class="dot dot--ok" /> loopt <span class="dot dot--low" /> onder minimum <span class="dot dot--full" /> vol <span class="cal__legend-blocked" /> geblokkeerd
          </p>
        </section>

        <div class="agenda__side">
          <section class="upcoming">
            <h2 class="label-head">Komende vertrekken</h2>
            {upcoming.length
              ? <ul class="dep-list">{upcoming.map((d) => <DepCard key={d.id} dep={d} product={productById.get(d.productId)} showDate />)}</ul>
              : <p class="hint">Nog geen komende vertrekken. Kies een dag in de kalender om er een te plannen.</p>}
          </section>
          <DayPanel date={day} deps={onDay(day)} products={products} />
        </div>
      </div>
    </main>
  );
}

function DepCard({ dep, product, showDate }: { dep: Departure; product?: TourProduct; showDate?: boolean }) {
  const { bookings } = useAppState();
  const f = departureFill(dep, bookings, product?.minGuests ?? 0);
  const s = fillStatus(dep, f, product?.minGuests ?? 0);
  return (
    <li>
      <a class={`dep-card dep-card--${s.state}`} href={`#/vertrek/${dep.id}`}>
        <span class="dep-card__top">
          <span class="dep-card__when">{showDate ? `${shortDate(dep.date)} · ` : ''}{dep.startTime}</span>
          <span class="dep-card__tags">
            {dep.status !== 'geannuleerd' && <WeatherChip date={dep.date} startTime={dep.startTime} durationMin={product?.durationMin ?? 120} today={isoDate(new Date())} />}
            <span class={`fill-tag fill-tag--${s.state}`}>{s.label}</span>
          </span>
        </span>
        <span class="dep-card__name lit">{productName(product)}</span>
        <FillBar booked={f.booked} capacity={f.capacity} state={s.state} />
      </a>
    </li>
  );
}

/** Blocks a day for tours, with an optional reason, or frees it again. */
function BlockDay({ date }: { date: string }) {
  const { blocked } = useAppState();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const current = blockedOn(date, blocked);
  if (current) {
    return (
      <div class="notice">
        <p><strong>Geblokkeerd</strong>{current.reason ? `: ${current.reason}` : ''}</p>
        <button type="button" class="btn btn--small" onClick={() => void deleteRecord('blocked', current)}>Weer vrijgeven</button>
      </div>
    );
  }
  if (!asking) return <button type="button" class="btn btn--ghost btn--small" onClick={() => setAsking(true)}>Dag blokkeren</button>;
  return (
    <form class="feedback-form" onSubmit={(e) => { e.preventDefault(); void saveRecord('blocked', createBlockedDay(date, reason.trim())); setAsking(false); setReason(''); }}>
      <label class="grow">Reden (mag leeg)<input value={reason} placeholder="Bijv. vakantie" onInput={(e) => setReason(e.currentTarget.value)} /></label>
      <button type="submit" class="btn btn--primary btn--small">Blokkeren</button>
      <button type="button" class="btn btn--ghost btn--small" onClick={() => setAsking(false)}>Annuleren</button>
    </form>
  );
}

function DayPanel({ date, deps, products }: { date: string; deps: Departure[]; products: TourProduct[] }) {
  const { departures, blocked } = useAppState();
  const [override, setOverride] = useState(false);
  const live = products.filter((p) => !p.deleted);
  const active = live.filter((p) => p.active);
  const [productId, setProductId] = useState('');
  const [time, setTime] = useState('10:00');
  const chosen = active.find((p) => p.id === productId) ?? active.find((p) => p.id === lastProductId()) ?? active[0];

  const planned = chosen ? createDeparture(chosen, date, time) : null;
  const overlapping = planned ? clashes(planned, departures, products) : [];
  const dayBlocked = !!blockedOn(date, blocked);
  const needsOverride = overlapping.length > 0 || dayBlocked;

  async function add() {
    if (!chosen || (needsOverride && !override)) return;
    const d = createDeparture(chosen, date, time);
    await saveRecord('departures', d);
    remember('product', chosen.id);
    navigate(`/vertrek/${d.id}`);
  }

  return (
    <section class="day-panel">
      <h2 class="day-panel__date lit">{capitalize(longDate(date))}</h2>
      <DayWeather date={date} today={isoDate(new Date())} />
      <BlockDay date={date} />
      {deps.length
        ? <ul class="dep-list">{deps.map((d) => <DepCard key={d.id} dep={d} product={products.find((p) => p.id === d.productId)} />)}</ul>
        : <p class="hint">Geen vertrekken op deze dag.</p>}
      {active.length ? (
        <div class="day-panel__add">
          <label>Touraanbod
            <select value={chosen?.id} onChange={(e) => setProductId(e.currentTarget.value)}>
              {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label class="narrow">Starttijd<input type="time" value={time} onInput={(e) => setTime(e.currentTarget.value)} /></label>
          <button class="btn" onClick={add} disabled={needsOverride && !override}>Vertrek plannen</button>
          {needsOverride && (
            <div class="overbook" role="alert">
              {dayBlocked && <strong>Deze dag is geblokkeerd.</strong>}
              {overlapping.length > 0 && <strong>Dit overlapt met het vertrek van {overlapping[0].startTime}.</strong>}
              <label class="check"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.currentTarget.checked)} />Toch plannen</label>
            </div>
          )}
        </div>
      ) : live.length
        ? <p class="hint">Geen actief touraanbod. Zet er een op actief onder <a href="#/aanbod">Touraanbod</a> om vertrekken te plannen.</p>
        : <p class="hint">Maak eerst een <a href="#/aanbod">touraanbod</a> aan; daarna kun je vertrekken plannen.</p>}
    </section>
  );
}
