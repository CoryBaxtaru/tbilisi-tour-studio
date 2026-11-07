// Dutch messages to guests: booking confirmation, a reminder the day before and a review request. Only details the
// guide entered are used, and a missing detail is reported rather than guessed. The app never sends anything itself:
// the guide copies the text or opens it in WhatsApp or a mail app.
import { isoDate } from './agenda';
import { arrivedCount } from './checkin';
import { bookingAmounts } from './pricing';
import { isWebUrl } from './research';
import type { Booking, Departure, MessageKind, TourProduct } from './types';
import { departureForecast, symbolLabel, type Forecast, type WeatherWarning } from './weather';

export const MESSAGE_LABELS: Record<MessageKind, string> = { bevestiging: 'Bevestiging', herinnering: 'Herinnering', review: 'Reviewverzoek' };
export const MESSAGE_KINDS = Object.keys(MESSAGE_LABELS) as MessageKind[];
const MEETING_PLACEHOLDER = '[verzamelpunt invullen]';
const REVIEW_WINDOW_DAYS = 7;

export interface MessageInput {
  booking: Booking;
  departure: Departure;
  product?: TourProduct;
  forecast?: Forecast | null;
  /** The guide's name under the message. */
  signature?: string;
  today: string;
}

export interface Message {
  subject: string;
  text: string;
  /** Details to fill in on the product page for a better message. */
  missing: string[];
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

const longDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const firstName = (b: Booking) => (b.anonymizedAt ? '' : b.leadName.trim().split(/\s+/)[0] ?? '');
const hello = (b: Booking) => (firstName(b) ? `Hallo ${firstName(b)},` : 'Hallo,');
const count = (n: number, one: string, many: string) => (n ? [`${n} ${n === 1 ? one : many}`] : []);
const party = (b: Booking) => [...count(b.adults, 'volwassene', 'volwassenen'), ...count(b.children, 'kind', 'kinderen'), ...count(b.infants, "baby", "baby's")].join(', ');
const duration = (min: number) => (min % 60 ? `${min} minuten` : `${min / 60} uur`);

const WEATHER_TIP: Partial<Record<WeatherWarning, string>> = {
  regen: 'Neem een regenjas of paraplu mee.',
  onweer: 'Neem een regenjas of paraplu mee.',
  sneeuw: 'Kleed je warm aan en draag stevige schoenen.',
  kou: 'Kleed je warm aan.',
  hitte: 'Neem water en iets tegen de zon mee.',
};

/** A line about the weather, only when the real forecast reaches the tour. Climate averages are no forecast. */
function weatherLines(input: MessageInput): string[] {
  const { forecast, departure, product } = input;
  const w = forecast && departureForecast(forecast, departure.date, departure.startTime, product?.durationMin ?? 120);
  if (!w) return [];
  const temp = Math.round(w.tempMin) === Math.round(w.tempMax) ? `${Math.round(w.tempMax)} graden` : `${Math.round(w.tempMin)} tot ${Math.round(w.tempMax)} graden`;
  const tips = [...new Set(w.warnings.flatMap((x) => WEATHER_TIP[x] ?? []))];
  return [`Het weerbericht: ${symbolLabel(w.symbol).label.toLowerCase()}, ${temp}. Dat kan nog veranderen.`, ...tips];
}

function meetingLines(p: TourProduct | undefined, missing: string[]): string[] {
  const place = p?.meetingPoint?.trim();
  if (!place) missing.push('verzamelpunt');
  const url = p?.meetingMapUrl?.trim();
  if (url && !isWebUrl(url)) missing.push('geldige kaartlink');
  return [`Verzamelpunt: ${place || MEETING_PLACEHOLDER}`, ...(url && isWebUrl(url) ? [`Op de kaart: ${url}`] : [])];
}

const closing = (signature?: string) => ['', 'Groet,', ...(signature?.trim() ? [signature.trim()] : [])];

export function buildMessage(kind: MessageKind, input: MessageInput): Message {
  const { booking: b, departure: d, product: p, today } = input;
  const name = p?.name?.trim() || 'de wandeltour';
  const missing: string[] = [];
  const when = [`Datum: ${longDate(d.date)}`, `Tijd: ${d.startTime}`];

  if (kind === 'bevestiging') {
    const amount = bookingAmounts(b).gross;
    // GetYourGuide handles the payment itself, so its bookings get no payment line.
    const payment = b.channel === 'getyourguide' || amount <= 0 ? [] : [b.paid ? 'Je hebt al betaald, dank je wel.' : `Nog te betalen: ${eur.format(amount)}`];
    const lines = [
      hello(b), '', `Bedankt voor je boeking! Je bent van harte welkom bij ${name}.`, '',
      ...when,
      ...(p?.durationMin ? [`Duur: ongeveer ${duration(p.durationMin)}`] : []),
      `Met: ${party(b)}`,
      ...meetingLines(p, missing),
      ...(p?.included?.trim() ? [`Inbegrepen: ${p.included.trim()}`] : []),
      ...payment,
      '', 'Heb je een vraag, of verandert er iets? Laat het me gerust weten.',
      ...closing(input.signature),
    ];
    return { subject: `Bevestiging: ${name} op ${longDate(d.date)}`, text: lines.join('\n'), missing };
  }

  if (kind === 'herinnering') {
    const tomorrow = addDays(today, 1) === d.date;
    const lines = [
      hello(b), '', `${tomorrow ? 'Morgen' : `Op ${longDate(d.date)}`} is het zover: ${name}!`, '',
      `We zien elkaar om ${d.startTime}.`,
      ...meetingLines(p, missing),
      ...weatherLines(input),
      ...(p?.bring?.trim() ? [`Neem mee: ${p.bring.trim()}`] : []),
      '', 'Lukt het toch niet? Laat het me dan even weten.', '', tomorrow ? 'Tot morgen!' : 'Tot dan!',
      ...closing(input.signature),
    ];
    return { subject: `Herinnering: ${name}, ${d.startTime}`, text: lines.join('\n'), missing };
  }

  const url = p?.reviewUrl?.trim();
  const link = url && isWebUrl(url) ? url : '';
  if (!link) missing.push('reviewlink');
  const lines = [
    hello(b), '', `Bedankt dat je mee was met ${name}! Ik vond het leuk om je de stad te laten zien.`, '',
    ...(link ? ['Wil je een korte review schrijven? Daar help je me echt mee:', link] : ['Wil je me laten weten wat je ervan vond? Daar help je me echt mee.']),
    ...closing(input.signature),
  ];
  return { subject: `Bedankt voor het meelopen: ${name}`, text: lines.join('\n'), missing };
}

/** A WhatsApp link, only for a number in international format: a local number could reach the wrong person. */
export function whatsappLink(contact: string, text: string): string | null {
  const c = contact.trim();
  if (!/^(\+|00)[\d\s().-]{7,}$/.test(c)) return null;
  const digits = c.replace(/\D/g, '').replace(/^00/, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** An Instagram name, written as @name or as a profile link. */
export function instagramHandle(contact: string): string | null {
  const c = contact.trim();
  const m = c.match(/^@([A-Za-z0-9._]{1,30})$/) ?? c.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?$/i);
  return m ? m[1] : null;
}

/** Opens a direct message in Instagram. Instagram cannot take a ready text, so the text is copied first. */
export function instagramLink(contact: string): string | null {
  const h = instagramHandle(contact);
  return h ? `https://ig.me/m/${h}` : null;
}

export function mailLink(contact: string, subject: string, text: string): string | null {
  const c = contact.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return null;
  return `mailto:${c}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

export function withMessageSent(b: Booking, kind: MessageKind, at: string): Booking {
  return { ...b, messagesSent: { ...b.messagesSent, [kind]: at } };
}

export interface PendingMessage { kind: MessageKind; booking: Booking; departure: Departure; productName: string }

/**
 * Messages still to send: a reminder for tomorrow's tours, a review request up to a week after a tour, and a
 * confirmation for direct bookings on a later day. Without a contact there is nobody to write to. GetYourGuide confirms
 * its own bookings, and a walk-in is already standing in front of the guide.
 */
export function pendingMessages(products: TourProduct[], departures: Departure[], bookings: Booking[], today: string): PendingMessage[] {
  const deps = new Map(departures.filter((d) => !d.deleted && d.status !== 'geannuleerd').map((d) => [d.id, d]));
  const names = new Map(products.map((p) => [p.id, p.name]));
  const out: PendingMessage[] = [];
  for (const b of bookings) {
    const departure = deps.get(b.departureId);
    if (!departure || b.deleted || b.anonymizedAt || !b.contact.trim() || b.status === 'geannuleerd') continue;
    const add = (kind: MessageKind) => out.push({ kind, booking: b, departure, productName: names.get(departure.productId) ?? 'Onbekend' });
    const sent = b.messagesSent ?? {};
    if (departure.date > today && !sent.bevestiging && (b.channel === 'direct' || b.channel === 'whatsapp' || b.channel === 'instagram')) add('bevestiging');
    if (departure.date === addDays(today, 1) && !sent.herinnering) add('herinnering');
    // A tour the guide has closed in guide mode counts as finished the same day.
    const finished = (departure.date < today || (departure.date === today && departure.status === 'afgerond')) && departure.date >= addDays(today, -REVIEW_WINDOW_DAYS);
    if (finished && !sent.review && b.status === 'geboekt' && (arrivedCount(b) > 0 || b.arrived === undefined)) add('review');
  }
  return out.sort((x, y) => x.departure.date.localeCompare(y.departure.date) || MESSAGE_KINDS.indexOf(x.kind) - MESSAGE_KINDS.indexOf(y.kind));
}
