// Small pieces shared by the agenda, the departure page and the tour products.
import { useState } from 'preact/hooks';
import { isoDate, type Fill } from '../domain/agenda';
import type { BookingStatus, Departure, TourProduct } from '../domain/types';

export const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
export const BOOKING_STATUS: Record<BookingStatus, string> = { geboekt: 'Geboekt', geannuleerd: 'Geannuleerd', 'no-show': 'No-show' };
export const UPCOMING = 6;
export const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
export const num = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);
/** A number for an input field, with a decimal comma. */
export const dec = (n: number) => String(n).replace('.', ',');
export const longDate = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('nl-NL', opts);
};
export const shortDate = (d: string) => longDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  return isoDate(new Date(y, m - 1 + n, 1)).slice(0, 7);
};
export const hours = (min: number) => (min % 60 ? `${min} min` : `${min / 60} uur`);

/** Name of a departure's product; a deleted product keeps its name, marked as such. */
export function productName(p: TourProduct | undefined): string {
  if (!p) return 'Onbekend touraanbod';
  return p.deleted ? `${p.name} (verwijderd)` : p.name;
}

export type FillState = 'ok' | 'low' | 'full' | 'cancelled';

/** One word or two for how a departure stands: vol, 2 tekort, 4 vrij, geannuleerd. */
export function fillStatus(dep: Departure, f: Fill, minGuests: number): { state: FillState; label: string } {
  if (dep.status === 'geannuleerd') return { state: 'cancelled', label: 'geannuleerd' };
  if (dep.private && f.booked > 0) return { state: 'full', label: 'privé' };
  if (f.full) return { state: 'full', label: 'vol' };
  if (f.belowMinimum) return { state: 'low', label: `${minGuests - f.booked} tekort` };
  return { state: 'ok', label: `${f.free} vrij` };
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

export function FillBar({ booked, capacity, state }: { booked: number; capacity: number; state: FillState }) {
  const pct = capacity ? Math.min(100, (booked / capacity) * 100) : 0;
  return (
    <span class="fill" role="img" aria-label={`${booked} van ${capacity} plaatsen bezet`}>
      <span class={`fill__bar fill__bar--${state}`}><span style={{ width: `${pct}%` }} /></span>
      <span class="fill__num">{booked}/{capacity}</span>
    </span>
  );
}
