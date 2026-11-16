// One departure with its bookings (#/vertrek/<id>): guests, check-in, messages, money and the weather.
import { useState } from 'preact/hooks';
import { CHANNELS, createBooking, DEPARTURE_STATUS, departureFill, isoDate, RETENTION_MONTHS } from '../domain/agenda';
import { blockedOn, clashes } from '../domain/planning';
import { commissionRate, departureFinance, gelToEur, hasPrices, overbookedBy, pricingOf, suggestedPrice } from '../domain/pricing';
import type { Booking, BookingChannel, BookingStatus, Departure, DepartureStatus, TourProduct } from '../domain/types';
import { currentRecord, deleteRecord, saveRecord, useAppState } from '../state/store';
import { navigate } from './router';
import { CheckIn, useHeadcount } from './CheckIn';
import { BadWeatherBox, GelFields, GygReminder, StartGuiding } from './DepartureBits';
import { FeedbackLog } from './FeedbackLog';
import { MessagePanel } from './Messages';
import { WeatherPanel } from './Weather';
import { BOOKING_STATUS, eur, num, dec, longDate, capitalize, hours, productName, fillStatus, ConfirmDelete, FillBar } from './AgendaBits';

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
        : dep.status !== 'geannuleerd' && product && <StartGuiding product={product} departure={dep} primary={dep.date === isoDate(new Date())} />}
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
        : <button class={`btn ${dep.date > isoDate(new Date()) ? 'btn--primary' : ''}`} onClick={() => setEditing('new')}>Boeking toevoegen</button>}
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
