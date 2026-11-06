// Practical information per site: opening hours, dress code, toilets and so on. Rule from the plan: only from a
// verified source and with a date, never invented. So a note cannot be saved without both, and old notes are flagged.
import { addMonths } from './agenda';
import { newId } from './factory';
import type { Landmark, PracticalKind, PracticalNote } from './types';

export const PRACTICAL_KINDS: Record<PracticalKind, string> = {
  openingstijden: 'Openingstijden', gesloten: 'Gesloten op', kleding: 'Kleding', toilet: 'Toilet', schaduw: 'Schaduw', water: 'Water', anders: 'Anders',
};
const STALE_AFTER_MONTHS = 12;

export function createPracticalNote(today: string): PracticalNote {
  return { id: newId(), kind: 'openingstijden', text: '', source: '', checkedOn: today };
}

/** What is still missing before a note may be saved; empty means it is fine. */
export function practicalProblems(n: PracticalNote, today: string): string[] {
  const out: string[] = [];
  if (!n.text.trim()) out.push('tekst');
  if (!n.source.trim()) out.push('bron');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n.checkedOn)) out.push('datum');
  else if (n.checkedOn > today) out.push('een datum die niet in de toekomst ligt');
  return out;
}

/** Older than a year: opening hours and the like change, so check again before relying on it. */
export const isStale = (n: PracticalNote, today: string) => addMonths(n.checkedOn, STALE_AFTER_MONTHS) < today;

export function withPractical(lm: Landmark, note: PracticalNote): Landmark {
  const list = lm.practical ?? [];
  return { ...lm, practical: list.some((n) => n.id === note.id) ? list.map((n) => (n.id === note.id ? note : n)) : [...list, note] };
}

export function withoutPractical(lm: Landmark, id: string): Landmark {
  return { ...lm, practical: (lm.practical ?? []).filter((n) => n.id !== id) };
}
