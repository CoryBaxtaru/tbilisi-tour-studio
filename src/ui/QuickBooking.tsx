// "Nieuwe boeking": a message comes in, and product, day, time and guest go in one form. The booking joins the
// departure at that time, or a new departure is made. Used on Vandaag and in the agenda.
import { useState } from 'preact/hooks';
import { CHANNELS, createBooking, createDeparture, departureFill, isoDate } from '../domain/agenda';
import { blockedOn, clashes } from '../domain/planning';
import { hasPrices, pricingOf, suggestedPrice } from '../domain/pricing';
import { departureFor } from '../domain/quickBooking';
import type { BookingChannel } from '../domain/types';
import { saveRecord, useAppState } from '../state/store';
import { navigate } from './router';

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
const KEY = { product: 'laatste-aanbod', channel: 'laatste-kanaal' };

function remembered(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}
export function remember(key: 'product' | 'channel', value: string) {
  try { localStorage.setItem(KEY[key], value); } catch { /* not stored, no harm */ }
}
/** The product the guide used last, so forms open on it. */
export const lastProductId = () => remembered(KEY.product);

export function QuickBooking({ date: startDate, onClose }: { date?: string; onClose: () => void }) {
  const { products, departures, bookings, blocked } = useAppState();
  const active = products.filter((p) => !p.deleted && p.active);
  const [productId, setProductId] = useState(() => lastProductId());
  const [date, setDate] = useState(startDate ?? isoDate(new Date()));
  const [time, setTime] = useState('10:00');
  const [channel, setChannel] = useState<BookingChannel>(() => (remembered(KEY.channel) as BookingChannel) || 'direct');
  const [leadName, setLeadName] = useState('');
  const [contact, setContact] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [notes, setNotes] = useState('');
  const [privateGroup, setPrivateGroup] = useState(false);
  const [override, setOverride] = useState(false);

  if (!active.length) {
    return (
      <section class="quick-booking">
        <h2>Nieuwe boeking</h2>
        <p class="hint">Maak eerst een <a href="#/aanbod">touraanbod</a>; daarna kun je hier in één keer boeken.</p>
        <button type="button" class="btn btn--ghost" onClick={onClose}>Sluiten</button>
      </section>
    );
  }
  const product = active.find((p) => p.id === productId) ?? active[0];
  const existing = date && time ? departureFor(departures, product.id, date, time) : undefined;
  const fill = existing ? departureFill(existing, bookings, product.minGuests) : null;
  const party = adults + children;
  const othersBooked = !!fill && fill.booked > 0;
  const asPrivate = privateGroup && !othersBooked && !existing?.private;
  const draftDep = { ...createDeparture(product, date, time), ...(asPrivate ? { private: true } : {}) };
  const draft = { ...createBooking(existing?.id ?? draftDep.id), channel, leadName: leadName.trim(), contact: contact.trim(), adults, children, notes: notes.trim() };
  const pr = pricingOf(product);
  const price = hasPrices(pr) ? suggestedPrice(pr, channel, draft) : null;

  const dayBlocked = !existing && !!blockedOn(date, blocked);
  const overlap = existing ? [] : clashes(draftDep, departures, products);
  const tooMany = existing?.private ? party : fill && !asPrivate ? Math.max(0, party - fill.free) : 0;
  const needsOverride = dayBlocked || overlap.length > 0 || tooMany > 0;
  const ready = !!date && !!time && party > 0 && (!needsOverride || override);

  async function save(e: Event) {
    e.preventDefault();
    if (!ready) return;
    let departureId = existing?.id;
    if (existing) {
      if (asPrivate) await saveRecord('departures', { ...existing, private: true });
    } else {
      await saveRecord('departures', draftDep);
      departureId = draftDep.id;
    }
    await saveRecord('bookings', { ...draft, departureId: departureId!, priceTotal: price?.total ?? 0, commission: price?.commission ?? 0 });
    remember('product', product.id);
    remember('channel', channel);
    onClose();
    navigate(`/vertrek/${departureId}`);
  }

  return (
    <form class="quick-booking" onSubmit={save}>
      <h2>Nieuwe boeking</h2>
      <div class="row">
        <label>Touraanbod
          <select value={product.id} onChange={(e) => setProductId(e.currentTarget.value)}>
            {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label class="narrow">Datum<input type="date" value={date} onChange={(e) => setDate(e.currentTarget.value)} /></label>
        <label class="narrow">Starttijd<input type="time" value={time} onInput={(e) => setTime(e.currentTarget.value)} /></label>
      </div>
      <p class="meta quick-booking__where">
        {existing
          ? `Komt bij het vertrek van ${existing.startTime}${existing.private ? ', een privégroep' : `: nu ${fill!.booked} van ${fill!.capacity} plaatsen bezet`}.`
          : 'Er wordt een nieuw vertrek gemaakt.'}
      </p>
      <div class="row">
        <label class="narrow">Kanaal
          <select value={channel} onChange={(e) => setChannel(e.currentTarget.value as BookingChannel)}>
            {Object.entries(CHANNELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>Naam hoofdboeker<input value={leadName} autoComplete="off" onInput={(e) => setLeadName(e.currentTarget.value)} /></label>
        <label>Telefoon, e-mail of @instagram<input value={contact} autoComplete="off" placeholder="+995 …, naam@… of @naam" onInput={(e) => setContact(e.currentTarget.value)} /></label>
      </div>
      <div class="row">
        <label class="narrow">Volwassenen<input type="number" min={0} value={adults} onInput={(e) => setAdults(num(e.currentTarget.value))} /></label>
        <label class="narrow">Kinderen<input type="number" min={0} value={children} onInput={(e) => setChildren(num(e.currentTarget.value))} /></label>
        <label class="check"><input type="checkbox" checked={privateGroup} disabled={othersBooked} onChange={(e) => setPrivateGroup(e.currentTarget.checked)} />Privé: niemand anders erbij</label>
      </div>
      {othersBooked && <p class="hint">Privé kan niet: er staan al andere gasten op dit vertrek.</p>}
      <label>Notities (bijv. dieetwensen)<textarea rows={2} value={notes} onInput={(e) => setNotes(e.currentTarget.value)} /></label>
      <p class="meta">{price ? `Prijs: ${eur.format(price.total)} (${price.how})` : 'Geen prijzen ingesteld voor dit touraanbod; de prijs vul je later in bij de boeking.'}</p>
      {needsOverride && (
        <div class="overbook" role="alert">
          {dayBlocked && <strong>Deze dag is geblokkeerd.</strong>}
          {overlap.length > 0 && <strong>Dit overlapt met het vertrek van {overlap[0].startTime}.</strong>}
          {tooMany > 0 && <strong>{existing?.private ? 'Dit vertrek is privé.' : `${tooMany === 1 ? 'Dit is 1 gast' : `Dit zijn ${tooMany} gasten`} te veel.`}</strong>}
          <label class="check"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.currentTarget.checked)} />Toch boeken</label>
        </div>
      )}
      <div class="claim__actions">
        <button class="btn btn--primary" type="submit" disabled={!ready}>Boeking opslaan</button>
        <button class="btn btn--ghost" type="button" onClick={onClose}>Annuleren</button>
      </div>
    </form>
  );
}
