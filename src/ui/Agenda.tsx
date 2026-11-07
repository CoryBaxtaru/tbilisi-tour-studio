// Business hub: month calendar of departures (#/agenda/YYYY-MM), a departure with its bookings (#/vertrek/<id>)
// and the tour products (#/aanbod, #/aanbod/<id>). Everything is entered by the guide; guests never use the app.
import { useEffect, useState } from 'preact/hooks';
import {
  CHANNELS, createBooking, createDeparture, createProduct, DEPARTURE_STATUS, departureFill, isoDate,
  monthGrid, RETENTION_MONTHS, type Fill,
} from '../domain/agenda';
import { blockedOn, clashes, createBlockedDay } from '../domain/planning';
import { meetingPointElsewhere, productFromTour, tourMinutes } from '../domain/quickBooking';
import { buildProductSheet } from '../domain/productSheet';
import { commissionRate, departureFinance, gelToEur, hasPrices, overbookedBy, pricingOf, suggestedPrice } from '../domain/pricing';
import type { Booking, BookingChannel, BookingStatus, Departure, DepartureStatus, PriceProfile, TourProduct } from '../domain/types';
import { currentRecord, deleteRecord, saveRecord, useAppState } from '../state/store';
import { navigate } from './router';
import { CheckIn, useHeadcount } from './CheckIn';
import { BadWeatherBox, GelFields, GygReminder, StartGuiding } from './DepartureBits';
import { copyText } from './clipboard';
import { FeedbackLog } from './FeedbackLog';
import { MessagePanel } from './Messages';
import { DayGlyph, DayWeather, WeatherChip, WeatherPanel } from './Weather';
import { useForecast } from '../weather/metno';
import { lastProductId, QuickBooking, remember } from './QuickBooking';

const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const BOOKING_STATUS: Record<BookingStatus, string> = { geboekt: 'Geboekt', geannuleerd: 'Geannuleerd', 'no-show': 'No-show' };
const UPCOMING = 6;
const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const num = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);
/** A number for an input field, with a decimal comma. */
const dec = (n: number) => String(n).replace('.', ',');
const longDate = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('nl-NL', opts);
};
const shortDate = (d: string) => longDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  return isoDate(new Date(y, m - 1 + n, 1)).slice(0, 7);
};
const hours = (min: number) => (min % 60 ? `${min} min` : `${min / 60} uur`);

/** Name of a departure's product; a deleted product keeps its name, marked as such. */
function productName(p: TourProduct | undefined): string {
  if (!p) return 'Onbekend touraanbod';
  return p.deleted ? `${p.name} (verwijderd)` : p.name;
}

type FillState = 'ok' | 'low' | 'full' | 'cancelled';

/** One word or two for how a departure stands: vol, 2 tekort, 4 vrij, geannuleerd. */
function fillStatus(dep: Departure, f: Fill, minGuests: number): { state: FillState; label: string } {
  if (dep.status === 'geannuleerd') return { state: 'cancelled', label: 'geannuleerd' };
  if (dep.private && f.booked > 0) return { state: 'full', label: 'privé' };
  if (f.full) return { state: 'full', label: 'vol' };
  if (f.belowMinimum) return { state: 'low', label: `${minGuests - f.booked} tekort` };
  return { state: 'ok', label: `${f.free} vrij` };
}

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
          <button class="btn btn--primary" onClick={add} disabled={needsOverride && !override}>Vertrek plannen</button>
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

/**
 * Two-step delete inside the page. Native confirm() dialogs are blocked in some browsers (e.g. embedded
 * browsers), where they silently answer "no", so a delete would do nothing.
 */
export function ConfirmDelete({ label, question, onConfirm, small }: { label: string; question: string; onConfirm: () => void; small?: boolean }) {
  const [asking, setAsking] = useState(false);
  const size = small ? ' btn--small' : '';
  if (!asking) return <button type="button" class={`btn btn--ghost btn--danger${size}`} onClick={() => setAsking(true)}>{label}</button>;
  return (
    <span class="confirm-delete" role="group" aria-label={question}>
      <span class="confirm-delete__q">{question}</span>
      <button type="button" class={`btn btn--danger${size}`} onClick={onConfirm}>Ja, verwijderen</button>
      <button type="button" class={`btn btn--ghost${size}`} onClick={() => setAsking(false)}>Annuleren</button>
    </span>
  );
}

function FillBar({ booked, capacity, state }: { booked: number; capacity: number; state: FillState }) {
  const pct = capacity ? Math.min(100, (booked / capacity) * 100) : 0;
  return (
    <span class="fill" role="img" aria-label={`${booked} van ${capacity} plaatsen bezet`}>
      <span class={`fill__bar fill__bar--${state}`}><span style={{ width: `${pct}%` }} /></span>
      <span class="fill__num">{booked}/{capacity}</span>
    </span>
  );
}

// ---- One departure with its bookings ----

export function DeparturePage({ id }: { id: string }) {
  const { departures, products, bookings, blocked } = useAppState();
  const dep = departures.find((d) => d.id === id && !d.deleted);
  const [editing, setEditing] = useState<string | null>(null);
  const [messaging, setMessaging] = useState<string | null>(null);
  if (!dep) return <main class="page"><p>Vertrek niet gevonden. <a href="#/agenda">Terug naar de agenda</a></p></main>;
  const product = products.find((p) => p.id === dep.productId);
  const min = product?.minGuests ?? 0;
  const mine = bookings.filter((b) => b.departureId === dep.id && !b.deleted).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const f = departureFill(dep, bookings, min);
  const s = fillStatus(dep, f, min);
  const money = departureFinance(dep, product, bookings);
  const set = (patch: Partial<Departure>) => {
    const cur = currentRecord('departures', dep.id);
    if (cur) void saveRecord('departures', { ...cur, ...patch });
  };
  async function remove() {
    for (const b of mine) await deleteRecord('bookings', b);
    await deleteRecord('departures', dep!);
    navigate(`/agenda/${dep!.date.slice(0, 7)}`);
  }

  return (
    <main class="page departure">
      <a href={`#/agenda/${dep.date.slice(0, 7)}`} class="back">← Agenda</a>
      <header class="departure__head">
        <div class="departure__title">
          <h1 class="lit">{productName(product)}</h1>
          <span class={`fill-tag fill-tag--${s.state} fill-tag--big`}>{s.state === 'ok' ? `${f.booked} van ${f.capacity}` : s.label}</span>
        </div>
        <p class="meta">{capitalize(longDate(dep.date))} · {dep.startTime}{product ? ` · ${hours(product.durationMin)}` : ''}</p>
      </header>

      <div class="departure__fill">
        <FillBar booked={f.booked} capacity={f.capacity} state={s.state} />
        <span class="meta">{f.booked} van {f.capacity} plaatsen bezet{product ? ` · minimum ${min}` : ''}</span>
      </div>
      {dep.status === 'afgerond'
        ? <p class="today__done">Tour afgerond.</p>
        : dep.status !== 'geannuleerd' && product && <StartGuiding product={product} departure={dep} />}
      <GygReminder dep={dep} product={product} />
      {dep.status !== 'geannuleerd' && clashes(dep, departures, products).map((o) => (
        <p key={o.id} class="hint hint--warn">Dit overlapt met <a href={`#/vertrek/${o.id}`}>het vertrek van {o.startTime}</a>.</p>
      ))}
      {dep.status !== 'geannuleerd' && blockedOn(dep.date, blocked) && <p class="hint hint--warn">Deze dag is geblokkeerd{blockedOn(dep.date, blocked)!.reason ? `: ${blockedOn(dep.date, blocked)!.reason}` : ''}.</p>}
      {s.state === 'low' && <p class="hint hint--warn">Nog {min - f.booked} gast(en) nodig voor het minimum van {min}; dit vertrek gaat nog niet door.</p>}
      {dep.notes && <p class="departure__note">{dep.notes}</p>}
      {dep.status !== 'geannuleerd' && <WeatherPanel date={dep.date} startTime={dep.startTime} durationMin={product?.durationMin ?? 120} today={isoDate(new Date())} />}
      {dep.status !== 'geannuleerd' && product && <BadWeatherBox dep={dep} product={product} />}

      <div class="tiles tiles--4" aria-label="Geld">
        <div class="tile"><span class="tile__label">Omzet</span><span class="tile__value">{eur.format(money.gross)}</span></div>
        <div class="tile"><span class="tile__label">Commissie</span><span class="tile__value">{eur.format(money.commission)}</span></div>
        <div class="tile"><span class="tile__label">Kosten</span><span class="tile__value">{eur.format(money.costs)}</span></div>
        <div class={`tile tile--net ${money.net < 0 ? 'is-negative' : ''}`}><span class="tile__label">Netto</span><span class="tile__value">{eur.format(money.net)}</span></div>
      </div>
      {money.breakEven !== null && <p class="meta">Kostendekkend vanaf {money.breakEven} betalende {money.breakEven === 1 ? 'volwassene' : 'volwassenen'} (direct tarief).</p>}
      {product && !hasPrices(pricingOf(product)) && <p class="hint">Nog geen prijzen voor dit touraanbod. Stel ze in bij <a href={`#/aanbod/${product.id}`}>{product.name}</a>, dan vult een nieuwe boeking de prijs zelf in.</p>}

      <h2>Gasten <span class="meta">({mine.length} {mine.length === 1 ? 'boeking' : 'boekingen'})</span></h2>
      {mine.length ? (
        <ul class="booking-list">
          {mine.map((b) => (
            <li key={b.id} class={`booking booking--${b.status}`}>
              {editing === b.id
                ? <BookingForm initial={b} dep={dep} product={product} onDone={() => setEditing(null)} />
                : <BookingRow b={b} onEdit={() => setEditing(b.id)} onMessage={() => setMessaging(messaging === b.id ? null : b.id)} />}
              {messaging === b.id && editing !== b.id && <MessagePanel booking={b} departure={dep} product={product} />}
            </li>
          ))}
        </ul>
      ) : <p class="hint">Nog geen boekingen voor dit vertrek.</p>}
      {editing === 'new'
        ? <div class="booking"><BookingForm initial={createBooking(dep.id)} dep={dep} product={product} onDone={() => setEditing(null)} /></div>
        : <button class="btn btn--primary" onClick={() => setEditing('new')}>Boeking toevoegen</button>}
      <p class="hint">Naam, contact en notities van gasten worden {RETENTION_MONTHS} maanden na de tour automatisch gewist; aantallen en bedragen blijven.</p>

      {dep.status !== 'geannuleerd' && dep.date <= isoDate(new Date()) && mine.length > 0 && <CheckInSection departure={dep} />}

      {(dep.date <= isoDate(new Date()) || dep.status === 'afgerond') && <FeedbackLog departure={dep} />}

      <details class="departure__edit">
        <summary>Vertrek wijzigen</summary>
        <div class="departure__fields">
          <label>Datum<input type="date" value={dep.date} onChange={(e) => e.currentTarget.value && set({ date: e.currentTarget.value })} /></label>
          <label>Starttijd<input type="time" value={dep.startTime} onChange={(e) => e.currentTarget.value && set({ startTime: e.currentTarget.value })} /></label>
          <label>Plaatsen<input type="number" min={1} value={dep.capacity} disabled={dep.private} onChange={(e) => set({ capacity: Math.max(1, num(e.currentTarget.value)) })} /></label>
          <label class="check"><input type="checkbox" checked={!!dep.private} onChange={(e) => set({ private: e.currentTarget.checked })} />Privé: niemand anders erbij</label>
          <label>Status
            <select value={dep.status} onChange={(e) => set({ status: e.currentTarget.value as DepartureStatus })}>
              {Object.entries(DEPARTURE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
        <label>Notities<textarea rows={2} value={dep.notes} onChange={(e) => set({ notes: e.currentTarget.value })} /></label>
      </details>

      <details class="danger-zone">
        <summary>Vertrek verwijderen</summary>
        <ConfirmDelete label={`Vertrek${mine.length ? ' en boekingen' : ''} verwijderen`}
          question={`Dit vertrek${mine.length ? ` en ${mine.length} boeking(en)` : ''} verwijderen?`} onConfirm={() => void remove()} />
      </details>
    </main>
  );
}

function CheckInSection({ departure }: { departure: Departure }) {
  const headcount = useHeadcount(departure.id);
  return (
    <details class="departure__edit">
      <summary>Aanwezig: {headcount}</summary>
      <CheckIn departure={departure} hideTotal />
    </details>
  );
}

function BookingRow({ b, onEdit, onMessage }: { b: Booking; onEdit: () => void; onMessage: () => void }) {
  const people = [b.adults && `${b.adults} volw.`, b.children && `${b.children} kind`, b.infants && `${b.infants} baby`].filter(Boolean).join(', ');
  return (
    <div class="booking__row">
      <div class="booking__main">
        <span class="booking__name">{b.anonymizedAt ? <em class="meta">gegevens gewist</em> : b.leadName || <em class="meta">geen naam</em>}</span>
        <span class="meta">{CHANNELS[b.channel]}{b.reference ? ` ${b.reference}` : ''} · {people || '0 gasten'}{b.status !== 'geboekt' ? ` · ${BOOKING_STATUS[b.status]}` : ''}{b.refund ? ` · ${eur.format(b.refund)} teruggegeven` : ''}{b.status === 'geannuleerd' && b.cancelFee ? ` · ${eur.format(b.cancelFee)} gehouden` : ''}{b.gel ? ` · ₾ ${b.gel.amount}` : ''}</span>
      </div>
      <span class="booking__price">{eur.format(b.priceTotal)}<span class={`meta ${b.paid ? 'is-paid' : 'is-unpaid'}`}>{b.paid ? 'betaald' : 'open'}</span></span>
      {!b.anonymizedAt && b.status !== 'geannuleerd' && <button class="btn btn--small btn--ghost" onClick={onMessage}>Bericht</button>}
      <button class="btn btn--small btn--ghost" onClick={onEdit}>Bewerken</button>
    </div>
  );
}

function BookingForm({ initial, dep, product, onDone }: { initial: Booking; dep: Departure; product?: TourProduct; onDone: () => void }) {
  const { bookings } = useAppState();
  const [overbookOk, setOverbookOk] = useState(false);
  const pr = pricingOf(product);
  const priced = hasPrices(pr);
  const isNew = !currentRecord('bookings', initial.id);
  const priceOf = (x: Booking) => { const s = suggestedPrice(pr, x.channel, x); return { priceTotal: s.total, commission: s.commission }; };
  // A new booking follows the price profile until the guide types a price; an existing one keeps its price.
  const [auto, setAuto] = useState(isNew && priced && initial.priceTotal === 0);
  const [b, setB] = useState(() => (auto ? { ...initial, ...priceOf(initial) } : initial));
  const patch = (p: Partial<Booking>) => setB((x) => { const n = { ...x, ...p }; return auto ? { ...n, ...priceOf(n) } : n; });
  const suggestion = suggestedPrice(pr, b.channel, b);
  const differs = suggestion.total !== b.priceTotal || suggestion.commission !== b.commission;
  function typedPrice(v: string) {
    setAuto(false);
    const priceTotal = num(v);
    const rate = commissionRate(pr, b.channel);
    setB((x) => ({ ...x, priceTotal, ...(rate > 0 ? { commission: Math.round(priceTotal * rate * 100) / 100 } : {}) }));
  }
  // Only when this edit adds guests: recording a payment on a departure that is already too full must stay possible.
  const seats = (x: Booking) => (x.status === 'geannuleerd' ? 0 : x.adults + x.children + x.infants);
  const tooMany = isNew || seats(b) > seats(initial) ? overbookedBy(dep, bookings, b) : 0;
  async function save(e: Event) {
    e.preventDefault();
    if (tooMany > 0 && !overbookOk) return;
    await saveRecord('bookings', { ...b, leadName: b.leadName.trim(), contact: b.contact.trim() });
    onDone();
  }
  async function remove() {
    await deleteRecord('bookings', initial);
    onDone();
  }
  return (
    <form class="booking-form" onSubmit={save}>
      <div class="row">
        <label>Kanaal
          <select value={b.channel} onChange={(e) => patch({ channel: e.currentTarget.value as BookingChannel })}>
            {Object.entries(CHANNELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>Boekingsnummer<input value={b.reference} onInput={(e) => patch({ reference: e.currentTarget.value })} /></label>
      </div>
      {b.anonymizedAt ? <p class="hint">Persoonsgegevens zijn gewist.</p> : (
        <div class="row">
          <label>Naam hoofdboeker<input value={b.leadName} autoComplete="off" onInput={(e) => patch({ leadName: e.currentTarget.value })} /></label>
          <label>Telefoon, e-mail of @instagram<input value={b.contact} autoComplete="off" onInput={(e) => patch({ contact: e.currentTarget.value })} /></label>
        </div>
      )}
      <div class="row">
        <label class="narrow">Volwassenen<input type="number" min={0} value={b.adults} onInput={(e) => patch({ adults: num(e.currentTarget.value) })} /></label>
        <label class="narrow">Kinderen<input type="number" min={0} value={b.children} onInput={(e) => patch({ children: num(e.currentTarget.value) })} /></label>
        <label class="narrow">Baby's<input type="number" min={0} value={b.infants} onInput={(e) => patch({ infants: num(e.currentTarget.value) })} /></label>
      </div>
      <div class="row">
        <label class="narrow">Totaalprijs (€)<input inputMode="decimal" value={dec(b.priceTotal)} onChange={(e) => typedPrice(e.currentTarget.value)} /></label>
        <label class="narrow">Commissie (€)<input inputMode="decimal" value={dec(b.commission)} onChange={(e) => { setAuto(false); setB((x) => ({ ...x, commission: num(e.currentTarget.value) })); }} /></label>
        <label class="check"><input type="checkbox" checked={b.paid} onChange={(e) => patch({ paid: e.currentTarget.checked })} />Betaald</label>
        <label>Status
          <select value={b.status} onChange={(e) => patch({ status: e.currentTarget.value as BookingStatus })}>
            {Object.entries(BOOKING_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <GelFields gel={b.gel} label="Betaald in lari" onChange={(gel) => {
        setAuto(false);
        const priceTotal = gel ? gelToEur(gel) : b.priceTotal;
        const rate = commissionRate(pr, b.channel);
        setB((x) => ({ ...x, gel, priceTotal, ...(gel && rate > 0 ? { commission: Math.round(priceTotal * rate * 100) / 100 } : {}) }));
      }} />
      {b.status === 'geannuleerd'
        ? <label class="narrow">Dit houd je van de annulering (€)<input inputMode="decimal" value={dec(b.cancelFee ?? 0)} onChange={(e) => setB((x) => ({ ...x, cancelFee: num(e.currentTarget.value) }))} /></label>
        : <label class="narrow">Teruggegeven aan de gast (€)<input inputMode="decimal" value={dec(b.refund ?? 0)} onChange={(e) => setB((x) => ({ ...x, refund: num(e.currentTarget.value) }))} /></label>}
      {priced ? (
        <p class="meta booking-form__price">
          {auto || !differs
            ? <>Volgens prijsprofiel: {suggestion.how}</>
            : <>Prijsprofiel: {eur.format(suggestion.total)} ({suggestion.how}) <button type="button" class="btn btn--ghost btn--small" onClick={() => { setAuto(true); setB((x) => ({ ...x, ...priceOf(x) })); }}>Overnemen</button></>}
        </p>
      ) : product && <p class="meta booking-form__price">Geen prijzen ingesteld voor dit touraanbod.</p>}
      {!b.anonymizedAt && <label>Notities (bijv. dieetwensen)<textarea rows={2} value={b.notes} onInput={(e) => patch({ notes: e.currentTarget.value })} /></label>}
      {tooMany > 0 && (
        <div class="overbook" role="alert">
          <strong>{tooMany === 1 ? 'Dit is 1 gast' : `Dit zijn ${tooMany} gasten`} te veel.</strong> Er zijn {dep.capacity} plaatsen.
          <label class="check"><input type="checkbox" checked={overbookOk} onChange={(e) => setOverbookOk(e.currentTarget.checked)} />Toch boeken</label>
        </div>
      )}
      <div class="claim__actions">
        <button class="btn btn--primary btn--small" type="submit" disabled={tooMany > 0 && !overbookOk}>{isNew ? 'Boeking opslaan' : 'Opslaan'}</button>
        <button class="btn btn--ghost btn--small" type="button" onClick={onDone}>Annuleren</button>
        {!isNew && <ConfirmDelete small label="Verwijderen" question="Deze boeking verwijderen?" onConfirm={() => void remove()} />}
      </div>
    </form>
  );
}

// ---- Tour products ----

export function Products() {
  const { products, departures } = useAppState();
  const list = products.filter((p) => !p.deleted).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'nl'));
  const today = isoDate(new Date());
  const add = () => navigate('/aanbod/nieuw');
  return (
    <main class="page">
      <a href="#/agenda" class="back">← Agenda</a>
      <div class="page__head">
        <h1>Touraanbod</h1>
        <button class="btn btn--primary" onClick={add}>Nieuw touraanbod</button>
      </div>
      <p class="hint">Wat gasten boeken: naam, duur, groepsgrootte en verzamelpunt. Vertrekken plan je in de agenda.</p>
      {list.length ? (
        <ul class="tour-list">
          {list.map((p) => {
            const upcoming = departures.filter((d) => d.productId === p.id && !d.deleted && d.date >= today).length;
            return (
              <li key={p.id} class="tour-row">
                <div class="tour-row__main">
                  <a class="tour-row__title" href={`#/aanbod/${p.id}`}>{p.name}</a>
                  <span class="meta">{p.durationMin} min · {p.minGuests}–{p.maxGuests} gasten · {priceSummary(pricingOf(p))} · {upcoming} komende vertrek(ken){p.active ? '' : ' · niet actief'}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <div class="empty"><h2>Nog geen touraanbod</h2><p>Maak een touraanbod aan, bijvoorbeeld "Oude stad in het Nederlands", en plan daarna vertrekken in de agenda.</p></div>}
    </main>
  );
}

export function ProductPage({ id }: { id: string }) {
  const { products, tours, landmarks } = useAppState();
  const isNew = id === 'nieuw';
  const saved = isNew ? undefined : products.find((p) => p.id === id && !p.deleted);
  const [p, setP] = useState<TourProduct | undefined>(() => (isNew ? createProduct() : saved));
  const [msg, setMsg] = useState('');
  const dirty = !!p && (isNew || JSON.stringify(p) !== JSON.stringify(saved));
  // Closing the tab with unsaved changes asks first; moving inside the app keeps the bar below in view.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);
  if ((!isNew && !saved) || !p) return <main class="page"><p>Touraanbod niet gevonden. <a href="#/aanbod">Terug</a></p></main>;
  const patch = (x: Partial<TourProduct>) => { setMsg(''); setP((cur) => (cur ? { ...cur, ...x } : cur)); };
  const tour = tours.find((t) => t.id === p.tourId && !t.deleted);
  const tourMin = tourMinutes(tour);
  const firstStop = tour?.stops[0] ? landmarks.find((l) => l.id === tour.stops[0].landmarkId)?.name : undefined;
  async function save(e: Event) {
    e.preventDefault();
    const minGuests = Math.min(p!.minGuests, p!.maxGuests);
    const next = { ...p!, name: p!.name.trim() || 'Naamloos touraanbod', minGuests };
    await saveRecord('products', next);
    setP(next);
    setMsg('Opgeslagen.');
    if (isNew) {
      remember('product', next.id);
      navigate(`/aanbod/${next.id}`);
    }
  }
  async function remove() {
    await deleteRecord('products', saved!);
    navigate('/aanbod');
  }
  return (
    <main class="page">
      <a href="#/aanbod" class="back">← Touraanbod</a>
      <form class="product-form" onSubmit={save}>
        <label>Naam<input class="title-input" value={p.name} onInput={(e) => patch({ name: e.currentTarget.value })} /></label>
        <div class="row">
          <label>Gebaseerd op tour
            <select value={p.tourId ?? ''} onChange={(e) => patch(productFromTour(p, tours.find((t) => t.id === e.currentTarget.value && !t.deleted), 'Nieuw touraanbod'))}>
              <option value="">—</option>
              {tours.filter((t) => !t.deleted).map((t) => <option key={t.id} value={t.id}>{t.title || 'Naamloze tour'}</option>)}
            </select>
          </label>
          <label class="narrow">Duur (min)<input type="number" min={15} step={15} value={p.durationMin} onInput={(e) => patch({ durationMin: num(e.currentTarget.value) })} /></label>
          <label class="narrow">Taal<input value="Nederlands" disabled /></label>
        </div>
        {tourMin !== null && tourMin !== p.durationMin && (
          <p class="hint hint--warn">De tour zelf duurt ongeveer {tourMin} min (lopen, vertellen en pauzes). Gasten krijgen {p.durationMin} min te horen.{' '}
            <button type="button" class="btn btn--small" onClick={() => patch({ durationMin: tourMin })}>{tourMin} min overnemen</button></p>
        )}
        <div class="row">
          <label class="narrow">Max. gasten<input type="number" min={1} value={p.maxGuests} onInput={(e) => patch({ maxGuests: Math.max(1, num(e.currentTarget.value)) })} /></label>
          <label class="narrow">Min. gasten<input type="number" min={1} value={p.minGuests} onInput={(e) => patch({ minGuests: Math.max(1, num(e.currentTarget.value)) })} /></label>
          <label class="check"><input type="checkbox" checked={p.active} onChange={(e) => patch({ active: e.currentTarget.checked })} />Actief (te plannen)</label>
        </div>
        <label>Verzamelpunt<textarea rows={2} value={p.meetingPoint} placeholder="Bijv. bij de klokkentoren van het Gabriadze-theater" onInput={(e) => patch({ meetingPoint: e.currentTarget.value })} /></label>
        {meetingPointElsewhere(p.meetingPoint, firstStop) && (
          <p class="hint hint--warn">De tour begint bij {firstStop}. Ligt het verzamelpunt daar niet, plan dan de wandeling naar de eerste stop in, of maak het verzamelpunt de eerste stop van de tour.</p>
        )}
        <label>Link naar het verzamelpunt op de kaart<input inputMode="url" value={p.meetingMapUrl ?? ''} placeholder="https://..." onInput={(e) => patch({ meetingMapUrl: e.currentTarget.value })} /></label>
        <label>Inbegrepen<textarea rows={2} value={p.included} onInput={(e) => patch({ included: e.currentTarget.value })} /></label>
        <label>Wat moeten gasten meenemen?<input value={p.bring ?? ''} placeholder="Bijv. goede schoenen en water" onInput={(e) => patch({ bring: e.currentTarget.value })} /></label>
        <label>Link om een review te schrijven<input inputMode="url" value={p.reviewUrl ?? ''} placeholder="https://..." onInput={(e) => patch({ reviewUrl: e.currentTarget.value })} /></label>
        <label>Notities<textarea rows={2} value={p.notes} onInput={(e) => patch({ notes: e.currentTarget.value })} /></label>
        <fieldset class="price-form">
          <legend>Tekst voor GetYourGuide of een website</legend>
          <label>Omschrijving<textarea rows={4} value={p.description ?? ''} onInput={(e) => patch({ description: e.currentTarget.value })} /></label>
          <label>Hoogtepunten (één per regel)<textarea rows={4} value={p.highlights ?? ''} onInput={(e) => patch({ highlights: e.currentTarget.value })} /></label>
          <label>Annuleringsvoorwaarden<textarea rows={2} value={p.cancellationTerms ?? ''} onInput={(e) => patch({ cancellationTerms: e.currentTarget.value })} /></label>
          <SheetPreview product={p} />
        </fieldset>
        <PriceFields pricing={pricingOf(p)} onChange={(pricing) => patch({ pricing })} />
        <fieldset class="price-form">
          <legend>Plan bij slecht weer</legend>
          <label>Wat doe je dan?<textarea rows={2} value={p.badWeatherPlan ?? ''} placeholder="Bijv. korter lopen, schuilen op een plek die je kent, de tour verzetten" onInput={(e) => patch({ badWeatherPlan: e.currentTarget.value })} /></label>
          <label>Andere tour bij slecht weer
            <select value={p.badWeatherTourId ?? ''} onChange={(e) => patch({ badWeatherTourId: e.currentTarget.value || null })}>
              <option value="">—</option>
              {tours.filter((t) => !t.deleted).map((t) => <option key={t.id} value={t.id}>{t.title || 'Naamloze tour'}</option>)}
            </select>
          </label>
        </fieldset>
        <div class={`save-bar ${dirty ? 'is-dirty' : ''}`}>
          <button class="btn btn--primary" type="submit">{isNew ? 'Touraanbod opslaan' : 'Opslaan'}</button>
          {dirty ? <span class="meta">{isNew ? 'Nog niet opgeslagen.' : 'Niet opgeslagen wijzigingen.'}</span> : msg && <span class="status status--ok">{msg}</span>}
          {isNew && <a class="btn btn--ghost" href="#/aanbod">Annuleren</a>}
        </div>
      </form>
      {!isNew && <details class="danger-zone">
        <summary>Touraanbod verwijderen</summary>
        <ConfirmDelete label="Touraanbod verwijderen" question="Dit touraanbod verwijderen? Bestaande vertrekken blijven in de agenda staan."
          onConfirm={() => void remove()} />
      </details>}
    </main>
  );
}

/** The product sheet as ready text. Without written highlights the stops of the linked tour are used. */
function SheetPreview({ product }: { product: TourProduct }) {
  const { tours, landmarks } = useAppState();
  const [state, setState] = useState<'' | 'ok' | 'mislukt'>('');
  const tour = tours.find((t) => t.id === product.tourId && !t.deleted);
  const stops = (tour?.stops ?? []).flatMap((s) => landmarks.find((l) => l.id === s.landmarkId)?.name ?? []);
  const sheet = buildProductSheet(product, stops);
  return (
    <details>
      <summary>Bekijk de tekst</summary>
      <textarea class="sheet-text" rows={14} readOnly value={sheet.text} />
      {sheet.missing.length > 0 && <p class="hint hint--warn">Nog niet ingevuld: {sheet.missing.join(', ')}.</p>}
      <div class="claim__actions">
        <button type="button" class="btn" onClick={() => void copyText(sheet.text).then((ok) => setState(ok ? 'ok' : 'mislukt'))}>Kopiëren</button>
        {state === 'ok' && <span class="status status--ok">Gekopieerd.</span>}
        {state === 'mislukt' && <span class="hint hint--warn">Kopiëren lukte niet; selecteer de tekst zelf.</span>}
      </div>
    </details>
  );
}

function priceSummary(pr: PriceProfile): string {
  if (!hasPrices(pr)) return 'geen prijzen';
  return pr.kind === 'prive' ? `privé ${eur.format(pr.privateBase)}` : `${eur.format(pr.adult)} p.p.`;
}

type MoneyKey = 'adult' | 'child' | 'infant' | 'privateBase' | 'privateExtra' | 'costPerGuest' | 'fixedCost';

/** Price profile on the product page. Amounts are the guide's own; the app ships none. */
function PriceFields({ pricing: pr, onChange }: { pricing: PriceProfile; onChange: (p: PriceProfile) => void }) {
  const set = (x: Partial<PriceProfile>) => onChange({ ...pr, ...x });
  const money = (label: string, key: MoneyKey) => (
    <label class="narrow">{label}<input inputMode="decimal" value={dec(pr[key])} onChange={(e) => set({ [key]: num(e.currentTarget.value) })} /></label>
  );
  const channels = (Object.keys(CHANNELS) as BookingChannel[]).filter((c) => c !== 'direct');
  const example = { adults: 2, children: 0, infants: 0 };
  const direct = suggestedPrice(pr, 'direct', example);
  const withCommission = channels.filter((c) => commissionRate(pr, c) > 0);
  return (
    <fieldset class="price-form">
      <legend>Prijzen en kosten</legend>
      <div class="seg seg--choice" role="radiogroup" aria-label="Soort prijs">
        {([['per-persoon', 'Per persoon'], ['prive', 'Privétour']] as const).map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={pr.kind === k} onClick={() => set({ kind: k })}>{l}</button>
        ))}
      </div>
      {pr.kind === 'per-persoon' ? (
        <div class="row">{money('Volwassene (€)', 'adult')}{money('Kind (€)', 'child')}{money('Baby (€)', 'infant')}</div>
      ) : (
        <div class="row">
          {money('Vaste prijs (€)', 'privateBase')}
          <label class="narrow">t/m gasten<input type="number" min={1} value={pr.privateIncluded} onInput={(e) => set({ privateIncluded: Math.max(1, num(e.currentTarget.value)) })} /></label>
          {money('Per extra gast (€)', 'privateExtra')}
        </div>
      )}
      <div class="row">{money('Kosten per gast (€)', 'costPerGuest')}{money('Kosten per vertrek (€)', 'fixedCost')}</div>
      <p class="meta">Per gast: tickets, proeverijen. Per vertrek: vaste kosten zoals vervoer.</p>
      <p class="price-form__sub">Commissie per kanaal</p>
      <div class="row">
        {channels.map((c) => (
          <label key={c} class="narrow">{CHANNELS[c]} (%)<input inputMode="decimal" value={dec(pr.commission[c] ?? 0)}
            onChange={(e) => set({ commission: { ...pr.commission, [c]: Math.min(95, num(e.currentTarget.value)) } })} /></label>
        ))}
      </div>
      <label class="check"><input type="checkbox" checked={pr.grossUp} onChange={(e) => set({ grossUp: e.currentTarget.checked })} />Prijs op commissiekanalen ophogen, zodat je netto gelijk blijft</label>
      {hasPrices(pr) && (
        <p class="meta">
          Voorbeeld 2 volwassenen: direct {eur.format(direct.total)}
          {withCommission.map((c) => { const s = suggestedPrice(pr, c, example); return ` · ${CHANNELS[c]} ${eur.format(s.total)} (netto ${eur.format(s.total - s.commission)})`; }).join('')}
        </p>
      )}
    </fieldset>
  );
}
