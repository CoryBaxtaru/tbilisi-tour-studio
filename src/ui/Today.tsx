// Vandaag (#/vandaag): one screen for the phone. Today's departures with guests, meeting point and weather,
// and what still needs doing.
import { departureFill, isoDate } from '../domain/agenda';
import { MESSAGE_LABELS, pendingMessages } from '../domain/messages';
import { planningProblems } from '../domain/planning';
import { bookingAmounts, needsGygClosing, openPayments } from '../domain/pricing';
import type { Departure } from '../domain/types';
import { useState } from 'preact/hooks';
import { useAppState } from '../state/store';
import { QuickBooking } from './QuickBooking';
import { CheckIn } from './CheckIn';
import { BadWeatherBox, GygReminder, StartGuiding } from './DepartureBits';
import { WeatherPanel } from './Weather';

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const dayName = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('nl-NL', opts);
};
const SOON_DAYS = 7;
const OPEN_SHOWN = 5;

function DepartureCard({ dep, today }: { dep: Departure; today: string }) {
  const { products, bookings } = useAppState();
  const product = products.find((p) => p.id === dep.productId);
  const min = product?.minGuests ?? 0;
  const f = departureFill(dep, bookings, min);
  const guests = bookings.filter((b) => b.departureId === dep.id && !b.deleted && b.status !== 'geannuleerd');
  return (
    <section class="today__dep">
      <h2 class="lit"><a href={`#/vertrek/${dep.id}`}>{dep.startTime} · {product?.name ?? 'Onbekend touraanbod'}</a></h2>
      <p class="meta">{dep.date === today ? 'Vandaag' : dayName(dep.date)} · {f.booked} van {f.capacity} gasten{f.belowMinimum ? ` · nog ${min - f.booked} nodig voor het minimum` : ''}</p>
      {product?.meetingPoint && <p><strong>Verzamelen:</strong> {product.meetingPoint}</p>}
      {dep.status === 'afgerond'
        ? <p class="today__done">Tour afgerond. <a href={`#/vertrek/${dep.id}`}>Betaling en terugblik</a></p>
        : product && <StartGuiding product={product} departure={dep} />}
      <GygReminder dep={dep} product={product} />
      <WeatherPanel date={dep.date} startTime={dep.startTime} durationMin={product?.durationMin ?? 120} today={today} />
      {product && <BadWeatherBox dep={dep} product={product} />}
      {dep.date === today && <CheckIn departure={dep} />}
      {dep.date !== today && guests.length > 0 && (
        <ul class="today__guests">
          {guests.map((b) => (
            <li key={b.id}>
              <span>
                {b.anonymizedAt ? 'Gegevens gewist' : b.leadName || 'Geen naam'} · {b.adults + b.children + b.infants} {b.adults + b.children + b.infants === 1 ? 'gast' : 'gasten'}
                {b.contact ? <><br /><span class="meta">{b.contact}</span></> : null}
                {b.notes ? <><br /><span class="meta">{b.notes}</span></> : null}
              </span>
              <span class={b.paid ? 'is-paid' : 'is-unpaid'}>{b.paid ? 'betaald' : `open ${eur.format(bookingAmounts(b).gross)}`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Today() {
  const { products, departures, bookings, blocked } = useAppState();
  const today = isoDate(new Date());
  const soonEnd = isoDate(new Date(Date.now() + SOON_DAYS * 86400_000));
  const active = departures.filter((d) => !d.deleted && d.status !== 'geannuleerd')
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const todays = active.filter((d) => d.date === today);
  const next = active.find((d) => d.date > today);
  const productOf = (d: Departure) => products.find((p) => p.id === d.productId);
  const open = openPayments(products, departures, bookings).filter((p) => p.departure.status !== 'geannuleerd' || p.booking.cancelFee);
  const openTotal = open.reduce((n, p) => n + p.amount, 0);
  const toClose = active.filter((d) => needsGygClosing(d, productOf(d), bookings, today));
  const messages = pendingMessages(products, departures, bookings, today);
  const problems = planningProblems(departures, products, blocked, today);
  const [booking, setBooking] = useState(false);
  const short = active.filter((d) => d.date >= today && d.date <= soonEnd && departureFill(d, bookings, productOf(d)?.minGuests ?? 0).belowMinimum);

  return (
    <main class="page">
      <div class="page__head">
        <div><h1>Vandaag</h1><span class="meta">{dayName(today)}</span></div>
        {!booking && <button type="button" class="btn btn--primary" onClick={() => setBooking(true)}>Nieuwe boeking</button>}
      </div>
      {booking && <QuickBooking onClose={() => setBooking(false)} />}
      {todays.map((d) => <DepartureCard key={d.id} dep={d} today={today} />)}
      {!todays.length && (next
        ? <><p class="hint">Vandaag geen vertrekken. Dit is het volgende:</p><DepartureCard dep={next} today={today} /></>
        : <div class="empty"><h2>Geen vertrekken gepland</h2><p>Komt er een boeking binnen? Gebruik "Nieuwe boeking", of plan een vertrek in de <a href="#/agenda">agenda</a>.</p></div>)}

      {problems.length > 0 && (
        <>
          <h2>Planning klopt niet</h2>
          <ul class="todo-list">
            {problems.map((p) => (
              <li key={p.departure.id + p.kind}>
                <a href={`#/vertrek/${p.departure.id}`}>{dayName(p.departure.date, { weekday: 'short', day: 'numeric', month: 'short' })} {p.departure.startTime} · {productOf(p.departure)?.name}</a>
                <span class="meta">{p.kind === 'dubbel' ? 'dubbel gepland' : `geblokkeerde dag${p.detail ? `: ${p.detail}` : ''}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {messages.length > 0 && (
        <>
          <h2>Berichten versturen</h2>
          <ul class="todo-list">
            {messages.slice(0, OPEN_SHOWN).map((m) => (
              <li key={m.booking.id + m.kind}>
                <a href={`#/vertrek/${m.departure.id}`}>{m.booking.leadName || 'Geen naam'} · {dayName(m.departure.date, { day: 'numeric', month: 'short' })}</a>
                <span class="meta">{MESSAGE_LABELS[m.kind]}</span>
              </li>
            ))}
          </ul>
          {messages.length > OPEN_SHOWN && <p class="hint">En nog {messages.length - OPEN_SHOWN}.</p>}
        </>
      )}
      {toClose.length > 0 && (
        <>
          <h2>Dichtzetten op GetYourGuide</h2>
          <ul class="todo-list">
            {toClose.map((d) => <li key={d.id}><a href={`#/vertrek/${d.id}`}>{dayName(d.date, { weekday: 'short', day: 'numeric', month: 'short' })} {d.startTime} · {productOf(d)?.name}</a><span class="meta">vol</span></li>)}
          </ul>
        </>
      )}
      {short.length > 0 && (
        <>
          <h2>Te weinig gasten deze week</h2>
          <ul class="todo-list">
            {short.map((d) => {
              const p = productOf(d);
              const f = departureFill(d, bookings, p?.minGuests ?? 0);
              return <li key={d.id}><a href={`#/vertrek/${d.id}`}>{dayName(d.date, { weekday: 'short', day: 'numeric', month: 'short' })} {d.startTime} · {p?.name}</a><span class="meta">nog {(p?.minGuests ?? 0) - f.booked} nodig</span></li>;
            })}
          </ul>
        </>
      )}
      {open.length > 0 && (
        <>
          <h2>Nog te betalen <span class="meta">{eur.format(openTotal)}</span></h2>
          <ul class="todo-list">
            {open.slice(0, OPEN_SHOWN).map((p) => (
              <li key={p.booking.id}>
                <a href={`#/vertrek/${p.departure.id}`}>{p.booking.leadName || 'Geen naam'} · {dayName(p.departure.date, { day: 'numeric', month: 'short' })}</a>
                <span>{eur.format(p.amount)}</span>
              </li>
            ))}
          </ul>
          {open.length > OPEN_SHOWN && <p class="hint">En nog {open.length - OPEN_SHOWN}. <a href={`#/geld/${today.slice(0, 4)}`}>Alles bekijken</a>.</p>}
        </>
      )}
    </main>
  );
}
