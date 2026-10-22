// Business hub: month calendar of departures (#/agenda/YYYY-MM), a departure with its bookings (#/vertrek/<id>)
// and the tour products (#/aanbod, #/aanbod/<id>). Everything is entered by the guide; guests never use the app.
import { useState } from 'preact/hooks';
import {
  CHANNELS, createBooking, createDeparture, createProduct, DEPARTURE_STATUS, departureFill, departureMoney, isoDate,
  monthGrid, RETENTION_MONTHS, type Fill,
} from '../domain/agenda';
import type { Booking, BookingChannel, BookingStatus, Departure, DepartureStatus, TourProduct } from '../domain/types';
import { currentRecord, deleteRecord, saveRecord, useAppState } from '../state/store';
import { navigate } from './router';

const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const BOOKING_STATUS: Record<BookingStatus, string> = { geboekt: 'Geboekt', geannuleerd: 'Geannuleerd', 'no-show': 'No-show' };
const UPCOMING = 6;
const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const num = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);
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
  if (f.full) return { state: 'full', label: 'vol' };
  if (f.belowMinimum) return { state: 'low', label: `${minGuests - f.booked} tekort` };
  return { state: 'ok', label: `${f.free} vrij` };
}

// ---- Month calendar ----

export function Agenda({ month }: { month?: string }) {
  const { products, departures, bookings } = useAppState();
  const today = isoDate(new Date());
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const [picked, setPicked] = useState<string | null>(null);
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
        <a class="btn btn--ghost agenda__products" href="#/aanbod">Touraanbod</a>
      </div>

      <div class="agenda__body">
        <section class="cal" aria-label="Kalender">
          <div class="cal__grid" role="grid">
            {WEEKDAYS.map((w) => <div key={w} class="cal__wd" role="columnheader">{w}</div>)}
            {monthGrid(y, m).flat().map((d) => {
              const list = onDay(d);
              const inMonth = d.startsWith(ym);
              return (
                <button key={d} role="gridcell" aria-selected={d === day}
                  aria-label={`${longDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${list.length ? `, ${list.length} vertrek${list.length > 1 ? 'ken' : ''}` : ''}`}
                  class={`cal__day ${inMonth ? '' : 'is-other'} ${d === today ? 'is-today' : ''} ${d === day ? 'is-picked' : ''}`}
                  onClick={() => setPicked(d)}>
                  <span class="cal__num">{Number(d.slice(8))}</span>
                  <span class="cal__dots" aria-hidden="true">
                    {list.slice(0, 3).map((x) => <span key={x.id} class={`dot dot--${status(x).state}`} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <p class="cal__legend meta">
            <span class="dot dot--ok" /> loopt <span class="dot dot--low" /> onder minimum <span class="dot dot--full" /> vol
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
          <span class={`fill-tag fill-tag--${s.state}`}>{s.label}</span>
        </span>
        <span class="dep-card__name lit">{productName(product)}</span>
        <FillBar booked={f.booked} capacity={f.capacity} state={s.state} />
      </a>
    </li>
  );
}

function DayPanel({ date, deps, products }: { date: string; deps: Departure[]; products: TourProduct[] }) {
  const live = products.filter((p) => !p.deleted);
  const active = live.filter((p) => p.active);
  const [productId, setProductId] = useState('');
  const [time, setTime] = useState('10:00');
  const chosen = active.find((p) => p.id === productId) ?? active[0];

  async function add() {
    if (!chosen) return;
    const d = createDeparture(chosen, date, time);
    await saveRecord('departures', d);
    navigate(`/vertrek/${d.id}`);
  }

  return (
    <section class="day-panel">
      <h2 class="day-panel__date lit">{capitalize(longDate(date))}</h2>
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
          <button class="btn btn--primary" onClick={add}>Vertrek plannen</button>
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
function ConfirmDelete({ label, question, onConfirm, small }: { label: string; question: string; onConfirm: () => void; small?: boolean }) {
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
  const { departures, products, bookings } = useAppState();
  const dep = departures.find((d) => d.id === id && !d.deleted);
  const [editing, setEditing] = useState<string | null>(null);
  if (!dep) return <main class="page"><p>Vertrek niet gevonden. <a href="#/agenda">Terug naar de agenda</a></p></main>;
  const product = products.find((p) => p.id === dep.productId);
  const min = product?.minGuests ?? 0;
  const mine = bookings.filter((b) => b.departureId === dep.id && !b.deleted).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const f = departureFill(dep, bookings, min);
  const s = fillStatus(dep, f, min);
  const money = departureMoney(dep.id, bookings);
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
      {s.state === 'low' && <p class="hint hint--warn">Nog {min - f.booked} gast(en) nodig voor het minimum van {min}; dit vertrek gaat nog niet door.</p>}
      {dep.notes && <p class="departure__note">{dep.notes}</p>}

      <div class="tiles" aria-label="Geld">
        <div class="tile"><span class="tile__label">Omzet</span><span class="tile__value">{eur.format(money.gross)}</span></div>
        <div class="tile"><span class="tile__label">Commissie</span><span class="tile__value">{eur.format(money.commission)}</span></div>
        <div class="tile tile--net"><span class="tile__label">Netto</span><span class="tile__value">{eur.format(money.net)}</span></div>
      </div>

      <h2>Gasten <span class="meta">({mine.length} {mine.length === 1 ? 'boeking' : 'boekingen'})</span></h2>
      {mine.length ? (
        <ul class="booking-list">
          {mine.map((b) => (
            <li key={b.id} class={`booking booking--${b.status}`}>
              {editing === b.id
                ? <BookingForm initial={b} onDone={() => setEditing(null)} />
                : <BookingRow b={b} onEdit={() => setEditing(b.id)} />}
            </li>
          ))}
        </ul>
      ) : <p class="hint">Nog geen boekingen voor dit vertrek.</p>}
      {editing === 'new'
        ? <div class="booking"><BookingForm initial={createBooking(dep.id)} onDone={() => setEditing(null)} /></div>
        : <button class="btn btn--primary" onClick={() => setEditing('new')}>Boeking toevoegen</button>}
      <p class="hint">Naam, contact en notities van gasten worden {RETENTION_MONTHS} maanden na de tour automatisch gewist; aantallen en bedragen blijven.</p>

      <details class="departure__edit">
        <summary>Vertrek wijzigen</summary>
        <div class="departure__fields">
          <label>Datum<input type="date" value={dep.date} onChange={(e) => e.currentTarget.value && set({ date: e.currentTarget.value })} /></label>
          <label>Starttijd<input type="time" value={dep.startTime} onChange={(e) => e.currentTarget.value && set({ startTime: e.currentTarget.value })} /></label>
          <label>Plaatsen<input type="number" min={1} value={dep.capacity} onChange={(e) => set({ capacity: Math.max(1, num(e.currentTarget.value)) })} /></label>
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

function BookingRow({ b, onEdit }: { b: Booking; onEdit: () => void }) {
  const people = [b.adults && `${b.adults} volw.`, b.children && `${b.children} kind`, b.infants && `${b.infants} baby`].filter(Boolean).join(', ');
  return (
    <div class="booking__row">
      <div class="booking__main">
        <span class="booking__name">{b.anonymizedAt ? <em class="meta">gegevens gewist</em> : b.leadName || <em class="meta">geen naam</em>}</span>
        <span class="meta">{CHANNELS[b.channel]}{b.reference ? ` ${b.reference}` : ''} · {people || '0 gasten'}{b.status !== 'geboekt' ? ` · ${BOOKING_STATUS[b.status]}` : ''}</span>
      </div>
      <span class="booking__price">{eur.format(b.priceTotal)}<span class={`meta ${b.paid ? 'is-paid' : 'is-unpaid'}`}>{b.paid ? 'betaald' : 'open'}</span></span>
      <button class="btn btn--small btn--ghost" onClick={onEdit}>Bewerken</button>
    </div>
  );
}

function BookingForm({ initial, onDone }: { initial: Booking; onDone: () => void }) {
  const [b, setB] = useState(initial);
  const patch = (p: Partial<Booking>) => setB((x) => ({ ...x, ...p }));
  const isNew = !currentRecord('bookings', initial.id);
  async function save(e: Event) {
    e.preventDefault();
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
          <label>Telefoon of e-mail<input value={b.contact} autoComplete="off" onInput={(e) => patch({ contact: e.currentTarget.value })} /></label>
        </div>
      )}
      <div class="row">
        <label class="narrow">Volwassenen<input type="number" min={0} value={b.adults} onInput={(e) => patch({ adults: num(e.currentTarget.value) })} /></label>
        <label class="narrow">Kinderen<input type="number" min={0} value={b.children} onInput={(e) => patch({ children: num(e.currentTarget.value) })} /></label>
        <label class="narrow">Baby's<input type="number" min={0} value={b.infants} onInput={(e) => patch({ infants: num(e.currentTarget.value) })} /></label>
      </div>
      <div class="row">
        <label class="narrow">Totaalprijs (€)<input inputMode="decimal" value={String(b.priceTotal)} onChange={(e) => patch({ priceTotal: num(e.currentTarget.value) })} /></label>
        <label class="narrow">Commissie (€)<input inputMode="decimal" value={String(b.commission)} onChange={(e) => patch({ commission: num(e.currentTarget.value) })} /></label>
        <label class="check"><input type="checkbox" checked={b.paid} onChange={(e) => patch({ paid: e.currentTarget.checked })} />Betaald</label>
        <label>Status
          <select value={b.status} onChange={(e) => patch({ status: e.currentTarget.value as BookingStatus })}>
            {Object.entries(BOOKING_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      {!b.anonymizedAt && <label>Notities (bijv. dieetwensen)<textarea rows={2} value={b.notes} onInput={(e) => patch({ notes: e.currentTarget.value })} /></label>}
      <div class="claim__actions">
        <button class="btn btn--primary btn--small" type="submit">{isNew ? 'Boeking opslaan' : 'Opslaan'}</button>
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
  async function add() {
    const p = createProduct();
    await saveRecord('products', p);
    navigate(`/aanbod/${p.id}`);
  }
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
                  <span class="meta">{p.durationMin} min · {p.minGuests}–{p.maxGuests} gasten · {upcoming} komende vertrek(ken){p.active ? '' : ' · niet actief'}</span>
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
  const { products, tours } = useAppState();
  const saved = products.find((p) => p.id === id && !p.deleted);
  const [p, setP] = useState<TourProduct | undefined>(saved);
  const [msg, setMsg] = useState('');
  if (!saved || !p) return <main class="page"><p>Touraanbod niet gevonden. <a href="#/aanbod">Terug</a></p></main>;
  const patch = (x: Partial<TourProduct>) => { setMsg(''); setP((cur) => (cur ? { ...cur, ...x } : cur)); };
  async function save(e: Event) {
    e.preventDefault();
    const minGuests = Math.min(p!.minGuests, p!.maxGuests);
    await saveRecord('products', { ...p!, name: p!.name.trim() || 'Naamloos touraanbod', minGuests });
    setMsg('Opgeslagen.');
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
            <select value={p.tourId ?? ''} onChange={(e) => patch({ tourId: e.currentTarget.value || null })}>
              <option value="">—</option>
              {tours.filter((t) => !t.deleted).map((t) => <option key={t.id} value={t.id}>{t.title || 'Naamloze tour'}</option>)}
            </select>
          </label>
          <label class="narrow">Duur (min)<input type="number" min={15} step={15} value={p.durationMin} onInput={(e) => patch({ durationMin: num(e.currentTarget.value) })} /></label>
          <label class="narrow">Taal<input value="Nederlands" disabled /></label>
        </div>
        <div class="row">
          <label class="narrow">Max. gasten<input type="number" min={1} value={p.maxGuests} onInput={(e) => patch({ maxGuests: Math.max(1, num(e.currentTarget.value)) })} /></label>
          <label class="narrow">Min. gasten<input type="number" min={1} value={p.minGuests} onInput={(e) => patch({ minGuests: Math.max(1, num(e.currentTarget.value)) })} /></label>
          <label class="check"><input type="checkbox" checked={p.active} onChange={(e) => patch({ active: e.currentTarget.checked })} />Actief (te plannen)</label>
        </div>
        <label>Verzamelpunt<textarea rows={2} value={p.meetingPoint} placeholder="Bijv. bij de klokkentoren van het Gabriadze-theater" onInput={(e) => patch({ meetingPoint: e.currentTarget.value })} /></label>
        <label>Inbegrepen<textarea rows={2} value={p.included} onInput={(e) => patch({ included: e.currentTarget.value })} /></label>
        <label>Notities<textarea rows={2} value={p.notes} onInput={(e) => patch({ notes: e.currentTarget.value })} /></label>
        <div class="claim__actions">
          <button class="btn btn--primary" type="submit">Opslaan</button>
          {msg && <span class="status status--ok">{msg}</span>}
        </div>
      </form>
      <details class="danger-zone">
        <summary>Touraanbod verwijderen</summary>
        <ConfirmDelete label="Touraanbod verwijderen" question="Dit touraanbod verwijderen? Bestaande vertrekken blijven in de agenda staan."
          onConfirm={() => void remove()} />
      </details>
    </main>
  );
}
