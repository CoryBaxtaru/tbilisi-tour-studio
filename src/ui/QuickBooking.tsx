// "Nieuwe boeking": a message comes in, and product, day, time and guest go in one form. The booking joins the
// departure at that time, or a new departure is made. Used on Vandaag and in the agenda.
import { useState } from 'preact/hooks';
import { CHANNELS, createBooking, createDeparture, departureFill, isoDate } from '../domain/agenda';
import { DM_QUESTIONS, parseDm, type DmFacts } from '../domain/dmBooking';
import { blockedOn, clashes } from '../domain/planning';
import { hasPrices, pricingOf, suggestedPrice } from '../domain/pricing';
import { departureFor } from '../domain/quickBooking';
import type { BookingChannel } from '../domain/types';
import { saveRecord, useAppState } from '../state/store';
import { copyText } from './clipboard';
import { navigate } from './router';

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
const KEY = { product: 'laatste-aanbod', channel: 'laatste-kanaal' };
const dayLabel = (isoDay: string) => new Date(`${isoDay}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });

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
  // A pasted message from the guest; it fills the form and is not stored itself.
  const [dm, setDm] = useState('');
  const [facts, setFacts] = useState<DmFacts | null>(null);
  const [dmHint, setDmHint] = useState('');

  /** Fills the fields the message is clear about; the rest stays as it was. */
  function readMessage(text: string) {
    setDm(text);
    setDmHint('');
    const f = parseDm(text, new Date(), active);
    const before = facts ?? {};
    setFacts(f);
    // A field the new message says nothing about goes back to its start value when the last message filled it
    // and nobody changed it since, so one guest's name never stays on the next guest's booking.
    const fill = <K extends keyof DmFacts>(key: K, current: DmFacts[K], set: (v: NonNullable<DmFacts[K]>) => void, start: NonNullable<DmFacts[K]>) => {
      if (f[key] !== undefined) set(f[key] as NonNullable<DmFacts[K]>);
      else if (before[key] !== undefined && before[key] === current) set(start);
    };
    fill('productId', productId, setProductId, lastProductId());
    fill('date', date, setDate, startDate ?? isoDate(new Date()));
    fill('time', time, setTime, '10:00');
    fill('adults', adults, setAdults, 2);
    fill('children', children, setChildren, 0);
    fill('leadName', leadName, setLeadName, '');
    fill('contact', contact, setContact, '');
    fill('notes', notes, setNotes, '');
    fill('privateGroup', privateGroup, setPrivateGroup, false);
    // A message without a phone number or e-mail address came in through Instagram.
    if (!f.contact || f.contact.startsWith('@')) setChannel('instagram');
  }
  async function pasteMessage() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) readMessage(text);
      else setDmHint('Het klembord is leeg. Kopieer eerst het bericht.');
    } catch {
      setDmHint('Plakken lukte niet. Plak het bericht zelf in het vak.');
    }
  }
  async function copyQuestions() {
    setDmHint(await copyText(DM_QUESTIONS) ? 'Vragen gekopieerd. Plak ze in je antwoord aan de gast.' : 'Kopiëren lukte niet.');
  }

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
      <div class="dm-paste">
        <label>Bericht van de gast (Instagram, WhatsApp)
          <textarea rows={3} value={dm} placeholder="Plak hier het bericht. Datum, tijd, aantal, naam en wensen worden hieronder ingevuld." onInput={(e) => readMessage(e.currentTarget.value)} />
        </label>
        <div class="claim__actions">
          <button type="button" class="btn btn--small" onClick={() => void pasteMessage()}>Plak van klembord</button>
          <button type="button" class="btn btn--small btn--ghost" onClick={() => void copyQuestions()}>Kopieer vragen voor de gast</button>
        </div>
        {dmHint && <p class="hint" role="status">{dmHint}</p>}
        {facts && dm.trim() && <DmResult facts={facts} productName={facts.productId ? active.find((p) => p.id === facts.productId)?.name : undefined} />}
      </div>
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

/** What the message filled in, and what the guide still has to ask or type. */
function DmResult({ facts: f, productName }: { facts: DmFacts; productName?: string }) {
  const found = [
    f.date && dayLabel(f.date),
    f.time,
    f.adults !== undefined && (f.adults === 1 ? '1 volwassene' : `${f.adults} volwassenen`),
    f.children !== undefined && (f.children === 1 ? '1 kind' : `${f.children} kinderen`),
    f.leadName && 'naam',
    f.contact && 'contact',
    f.notes && 'wensen',
    f.privateGroup && 'privé',
    productName,
  ].filter(Boolean);
  const missing = [!f.date && 'datum', !f.time && 'starttijd', f.adults === undefined && 'aantal gasten'].filter(Boolean);
  return (
    <p class="dm-paste__result" role="status">
      {found.length ? <span>Ingevuld: {found.join(' · ')}.</span> : <span>Niets herkend in dit bericht.</span>}
      {missing.length > 0 && <span class="hint--warn"> Niet gevonden: {missing.join(', ')}.</span>}
      <span class="meta"> Controleer de velden. Het bericht zelf wordt niet bewaard.</span>
    </p>
  );
}
