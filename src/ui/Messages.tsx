// A message to one guest: pick a template, change the text if you want, then copy it or open it in WhatsApp or
// mail. The app itself sends nothing. Copying or opening marks it as sent, so Vandaag stops asking for it.
import { useEffect, useState } from 'preact/hooks';
import { isoDate } from '../domain/agenda';
import { buildMessage, instagramLink, mailLink, MESSAGE_KINDS, MESSAGE_LABELS, whatsappLink, withMessageSent } from '../domain/messages';
import type { Booking, Departure, MessageKind, TourProduct } from '../domain/types';
import { currentRecord, saveRecord } from '../state/store';
import { useForecast } from '../weather/metno';
import { copyText } from './clipboard';

const SIGNATURE_KEY = 'bericht-afzender';
const sentDay = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
function loadSignature(): string {
  try { return localStorage.getItem(SIGNATURE_KEY) ?? ''; } catch { return ''; }
}

export function MessagePanel({ booking, departure, product, start }: { booking: Booking; departure: Departure; product?: TourProduct; start?: MessageKind }) {
  const { forecast } = useForecast();
  const [kind, setKind] = useState<MessageKind>(start ?? (departure.date < isoDate(new Date()) ? 'review' : 'bevestiging'));
  const [signature, setSignature] = useState(loadSignature);
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState<'' | 'ok' | 'mislukt'>('');
  const message = buildMessage(kind, { booking, departure, product, forecast, signature, today: isoDate(new Date()) });
  const text = edited ?? message.text;
  useEffect(() => { setEdited(null); setCopied(''); }, [kind]);

  function markSent() {
    const cur = currentRecord('bookings', booking.id);
    if (cur) void saveRecord('bookings', withMessageSent(cur, kind, new Date().toISOString()));
  }
  async function copy() {
    const ok = await copyText(text);
    setCopied(ok ? 'ok' : 'mislukt');
    if (ok) markSent();
  }
  function changeSignature(v: string) {
    setSignature(v);
    setEdited(null);
    try { localStorage.setItem(SIGNATURE_KEY, v); } catch { /* not remembered */ }
  }

  const wa = whatsappLink(booking.contact, text);
  const mail = mailLink(booking.contact, message.subject, text);
  const ig = instagramLink(booking.contact);
  const sent = booking.messagesSent?.[kind];
  return (
    <div class="message-panel">
      <div class="seg seg--choice" role="radiogroup" aria-label="Soort bericht">
        {MESSAGE_KINDS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>{MESSAGE_LABELS[k]}</button>
        ))}
      </div>
      <label>Bericht<textarea rows={11} value={text} onInput={(e) => setEdited(e.currentTarget.value)} /></label>
      <label class="narrow">Jouw naam onder het bericht<input value={signature} onInput={(e) => changeSignature(e.currentTarget.value)} /></label>
      {message.missing.length > 0 && product && (
        <p class="hint hint--warn">Nog niet ingevuld: {message.missing.join(', ')}. Vul het in bij <a href={`#/aanbod/${product.id}`}>{product.name}</a>.</p>
      )}
      <div class="claim__actions">
        <button type="button" class="btn btn--primary" onClick={() => void copy()}>Kopiëren</button>
        {wa && <a class="btn" href={wa} target="_blank" rel="noopener" onClick={markSent}>Openen in WhatsApp</a>}
        {mail && <a class="btn" href={mail} onClick={markSent}>Openen in mail</a>}
        {ig && <a class="btn" href={ig} target="_blank" rel="noopener" onClick={() => { void copy(); }}>Kopiëren en openen in Instagram</a>}
        {copied === 'ok' && <span class="status status--ok">Gekopieerd.</span>}
      </div>
      {copied === 'mislukt' && <p class="hint hint--warn">Kopiëren lukte niet. Selecteer de tekst hierboven en kopieer hem zelf.</p>}
      {ig && <p class="hint">Instagram kan geen klaar bericht openen: de tekst staat op je klembord, plak hem in het gesprek.</p>}
      {!wa && !mail && !ig && booking.contact.trim() && <p class="hint">WhatsApp werkt alleen met een nummer in internationale vorm, zoals +31 6 12345678.</p>}
      {sent && <p class="meta">Eerder verstuurd op {sentDay(sent)}.</p>}
    </div>
  );
}
