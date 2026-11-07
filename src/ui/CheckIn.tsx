// Guest list at the meeting point: who came, who did not, the headcount and who still has to pay. Works offline;
// changes sync later like any other booking change.
import { arrivedCount, checkInSummary, guestList, partySize, withArrived, withNoShow } from '../domain/checkin';
import { bookingAmounts } from '../domain/pricing';
import type { Booking, Departure } from '../domain/types';
import { currentRecord, saveRecord, useAppState } from '../state/store';

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const isPhone = (c: string) => /^[+\d][\d\s().-]{5,}$/.test(c.trim());

function update(id: string, change: (b: Booking) => Booking) {
  const cur = currentRecord('bookings', id);
  if (cur) void saveRecord('bookings', change(cur));
}

/** "5 van 8 aanwezig", with no-shows when there are any. */
export function useHeadcount(departureId: string): string {
  const { bookings } = useAppState();
  const s = checkInSummary(guestList(departureId, bookings));
  return `${s.arrived} van ${s.expected} aanwezig${s.noShow ? ` · ${s.noShow} no-show` : ''}`;
}

function GuestRow({ b }: { b: Booking }) {
  const size = partySize(b);
  const here = arrivedCount(b);
  const noShow = b.status === 'no-show';
  const amount = bookingAmounts(b).gross;
  const who = [b.adults && `${b.adults} volw.`, b.children && `${b.children} kind`, b.infants && `${b.infants} baby`].filter(Boolean).join(', ');
  const contact = b.contact.trim();
  return (
    <li class={`guest ${noShow ? 'guest--gone' : here >= size && size > 0 ? 'guest--here' : ''}`}>
      <div class="guest__who">
        <strong>{b.anonymizedAt ? 'Gegevens gewist' : b.leadName || 'Geen naam'}</strong>
        <span class="meta">{who || '0 gasten'}{b.reference ? ` · ${b.reference}` : ''}</span>
        {contact && (isPhone(contact) ? <a class="meta" href={`tel:${contact.replace(/[^\d+]/g, '')}`}>{contact}</a> : <span class="meta">{contact}</span>)}
        {b.notes && <span class="meta">{b.notes}</span>}
      </div>
      {noShow ? (
        <div class="guest__controls">
          <span class="guest__state">No-show</span>
          <button type="button" class="btn" onClick={() => update(b.id, (x) => withArrived(x, partySize(x)))}>Toch gekomen</button>
        </div>
      ) : (
        <div class="guest__controls">
          <button type="button" class="btn guest__step" aria-label={`Eén minder aanwezig bij ${b.leadName || 'deze boeking'}`} disabled={here === 0} onClick={() => update(b.id, (x) => withArrived(x, arrivedCount(x) - 1))}>−</button>
          <span class="guest__count" aria-live="polite">{here}/{size}</span>
          <button type="button" class="btn guest__step" aria-label={`Eén meer aanwezig bij ${b.leadName || 'deze boeking'}`} disabled={here >= size} onClick={() => update(b.id, (x) => withArrived(x, arrivedCount(x) + 1))}>+</button>
          {here < size && <button type="button" class="btn" onClick={() => update(b.id, (x) => withArrived(x, partySize(x)))}>Iedereen</button>}
          {here === 0 && <button type="button" class="btn" onClick={() => update(b.id, withNoShow)}>No-show</button>}
        </div>
      )}
      {!noShow && !b.paid && amount > 0 && b.channel !== 'getyourguide' && (
        <div class="guest__pay">
          <span class="is-unpaid">Nog te betalen: {eur.format(amount)}</span>
          <button type="button" class="btn btn--small" onClick={() => update(b.id, (x) => ({ ...x, paid: true }))}>Betaald</button>
        </div>
      )}
    </li>
  );
}

/** `hideTotal` when the headcount already shows in the heading above the list. */
export function CheckIn({ departure, hideTotal }: { departure: Departure; hideTotal?: boolean }) {
  const { bookings } = useAppState();
  const list = guestList(departure.id, bookings);
  if (!list.length) return <p class="hint">Nog geen gasten voor dit vertrek.</p>;
  const s = checkInSummary(list);
  return (
    <>
      {!hideTotal && <p class="guest-total"><strong>{s.arrived} van {s.expected} aanwezig</strong>{s.waiting > 0 && <span class="meta"> · {s.waiting} nog niet</span>}{s.noShow > 0 && <span class="meta"> · {s.noShow} no-show</span>}</p>}
      <ul class="guest-list">{list.map((b) => <GuestRow key={b.id} b={b} />)}</ul>
    </>
  );
}
