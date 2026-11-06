// Practical information per site. Editing lives on the research page; guide mode only reads it.
import { useState } from 'preact/hooks';
import { isoDate } from '../domain/agenda';
import { createPracticalNote, isStale, PRACTICAL_KINDS, practicalProblems, withoutPractical, withPractical } from '../domain/practical';
import { isWebUrl } from '../domain/research';
import type { Landmark, PracticalKind, PracticalNote } from '../domain/types';

const niceDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** One note with its source and date; a note older than a year says so. */
export function PracticalLine({ note }: { note: PracticalNote }) {
  const today = isoDate(new Date());
  const src = note.source.trim();
  return (
    <>
      <span><strong>{PRACTICAL_KINDS[note.kind]}:</strong> {note.text}</span>
      <span class="meta">
        {isWebUrl(src) ? <a href={src} target="_blank" rel="noopener">Bron</a> : src} · {niceDate(note.checkedOn)}
        {isStale(note, today) && <span class="is-unpaid"> · ouder dan een jaar, controleer dit</span>}
      </span>
    </>
  );
}

export function PracticalEditor({ landmark, apply }: { landmark: Landmark; apply: (edit: (l: Landmark) => Landmark) => Promise<void> }) {
  const today = isoDate(new Date());
  const [draft, setDraft] = useState<PracticalNote | null>(null);
  const notes = landmark.practical ?? [];
  const patch = (p: Partial<PracticalNote>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const problems = draft ? practicalProblems(draft, today) : [];
  async function save(e: Event) {
    e.preventDefault();
    if (!draft || problems.length) return;
    await apply((l) => withPractical(l, { ...draft, text: draft.text.trim(), source: draft.source.trim() }));
    setDraft(null);
  }
  return (
    <section class="practical">
      <h2>Praktisch</h2>
      <p class="hint">Openingstijden, kleding, toilet, schaduw en water. Alleen wat je zelf hebt gezien of uit een bron hebt, altijd met een datum.</p>
      {notes.length > 0 && (
        <ul class="practical__list">
          {notes.map((n) => (
            <li key={n.id}>
              <div class="practical__text"><PracticalLine note={n} /></div>
              <span class="practical__actions">
                <button type="button" class="btn btn--small btn--ghost" onClick={() => setDraft(n)}>Bewerken</button>
                <button type="button" class="btn btn--small btn--ghost" onClick={() => void apply((l) => withoutPractical(l, n.id))}>Verwijderen</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {draft ? (
        <form class="practical__form" onSubmit={save}>
          <label class="narrow">Soort
            <select value={draft.kind} onChange={(e) => patch({ kind: e.currentTarget.value as PracticalKind })}>
              {Object.entries(PRACTICAL_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label>Wat<input value={draft.text} placeholder="Bijv. schouders en knieën bedekt" onInput={(e) => patch({ text: e.currentTarget.value })} /></label>
          <label>Bron<input value={draft.source} placeholder="Een link, of: zelf gezien" onInput={(e) => patch({ source: e.currentTarget.value })} /></label>
          <label class="narrow">Gecontroleerd op<input type="date" value={draft.checkedOn} max={today} onChange={(e) => patch({ checkedOn: e.currentTarget.value })} /></label>
          <div class="claim__actions">
            <button type="submit" class="btn btn--primary btn--small" disabled={problems.length > 0}>Opslaan</button>
            <button type="button" class="btn btn--ghost btn--small" onClick={() => setDraft(null)}>Annuleren</button>
            {problems.length > 0 && <span class="meta">Nog nodig: {problems.join(', ')}</span>}
          </div>
        </form>
      ) : <button type="button" class="btn" onClick={() => setDraft(createPracticalNote(today))}>Praktische info toevoegen</button>}
    </section>
  );
}
